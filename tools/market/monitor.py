"""Read-only local API for the Platanus Hack 26-cl market (Python 3)."""
import json
import math
import os
import sqlite3
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

ORIGIN = "https://hack.platan.us"
MARKET = ORIGIN + "/api/market/"
END = datetime.fromisoformat("2026-11-22T16:00:00-03:00").timestamp()
DATA = Path.home() / ".local/state/platanus-market-26"
DB = DATA / "observations.sqlite"
PORT = 18726
INTERVAL = 10


def read_json(path):
    req = Request(MARKET + path + "?event=26-cl", headers={"Accept": "application/json", "User-Agent": "PlatanusMarketMonitor/1.0"})
    with urlopen(req, timeout=12) as response:
        return json.load(response)


def fee(amount, bps):
    return max(1, math.ceil(amount * bps / 10000)) if amount > 0 else 0


def quote(price, liquidity, bps, side, size):
    if side not in ("buy", "sell") or not 1 <= size <= 10_000_000:
        raise ValueError("invalid side or size")
    if side == "buy":
        charge = fee(size, bps)
        budget = size - charge
        if budget / liquidity > 500:
            raise ValueError("amount too large")
        shares = math.floor(liquidity * math.log1p(math.expm1(budget / liquidity) / price))
        change = shares
    else:
        shares = size
        change = -size
    delta = price * math.expm1(change / liquidity)
    gross = math.floor(abs(liquidity * math.log1p(delta)))
    charge = fee(gross, bps) if side == "sell" else charge
    cash = gross - charge if side == "sell" else -(gross + charge)
    return dict(shares=shares, cashDelta=cash, fee=charge,
                priceAfter=(price + delta) / (1 + delta))


def collect():
    delay = INTERVAL
    with sqlite3.connect(DB) as db:
        while time.time() < END:
            try:
                state = read_json("state")
                ts = state["serverTs"] / 1000
                market = state["market"]
                rows = [dict(team=p["teamSlug"], id=p["id"], name=p["name"],
                             price=p["price"], q=state["qVector"][p["id"]],
                             presenting=p["isCurrentlyPresenting"]) for p in state["projects"]]
                db.execute("insert or replace into snapshots values(?,?,?)",
                           (ts, json.dumps(market), json.dumps(rows)))
                db.commit()
                if market["status"] in ("settled", "resolved", "closed", "cancelled"):
                    return
                delay = INTERVAL
            except Exception as exc:
                print("Market read failed:", type(exc).__name__, flush=True)
                delay = min(300, delay * 2)
                if isinstance(exc, HTTPError):
                    retry = exc.headers.get("Retry-After", "")
                    if retry.isdigit():
                        delay = max(delay, int(retry))
            time.sleep(delay)


def respond(path, params):
    with sqlite3.connect(DB) as db:
        latest = db.execute("select * from snapshots order by ts desc limit 1").fetchone()
        if not latest:
            return 503, {"status": "waiting for first snapshot"}
        ts, market, projects = latest[0], json.loads(latest[1]), json.loads(latest[2])
        meta = dict(serverTs=ts, ageSeconds=round(time.time()-ts, 1), status=market["status"])
        if path == "/":
            return 200, dict(**meta, endpoints=["/state", "/movers?seconds=60",
                             "/history?team=team-11", "/quote?team=team-11&side=buy&size=25"])
        if path == "/state":
            return 200, dict(**meta, market=market, projects=projects)
        if path == "/movers":
            seconds = max(1, min(86400, int(params.get("seconds", 60))))
            prev = db.execute("select ts,projects from snapshots where ts<=? order by ts desc limit 1",
                              (ts-seconds,)).fetchone()
            if not prev:
                return 200, dict(**meta, windowAvailable=False, projects=[])
            by_id = {p["id"]: p for p in json.loads(prev[1])}
            for p in projects:
                old = by_id.get(p["id"])
                if old:
                    p.update(changePct=100*(p["price"]/old["price"]-1), netShares=p["q"]-old["q"])
            return 200, dict(**meta, windowAvailable=True, actualSeconds=ts-prev[0],
                             projects=sorted(projects, key=lambda p:p.get("changePct",0), reverse=True))
        team = params.get("team")
        p = next((p for p in projects if p["team"] == team), None)
        if not p or path not in ("/history", "/quote"):
            return 404, {"error": "unknown team or endpoint"}
        if path == "/history":
            points = db.execute("""select ts,json_extract(p.value,'$.price'),json_extract(p.value,'$.q')
                from snapshots,json_each(projects) p where json_extract(p.value,'$.team')=?
                order by ts desc limit 2000""", (team,)).fetchall()
            return 200, dict(**meta, team=team, columns=["unixSeconds","price","q"], points=points[::-1])
        side, size = params.get("side"), int(params.get("size",0))
        if side == "buy" and size < market["minTradeBananas"]:
            raise ValueError("below minimum order")
        return 200, dict(**meta, team=team, side=side, size=size,
                         estimate=quote(p["price"], market["liquidityB"], market["feeBps"], side, size))


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        route = urlparse(self.path)
        try:
            status, content = respond(route.path, {k:v[-1] for k,v in parse_qs(route.query).items()})
        except (ValueError, OverflowError):
            status, content = 400, {"error": "invalid quote or window"}
        payload = json.dumps(content, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    os.umask(0o077)
    DATA.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB) as db:
        db.execute("pragma journal_mode=WAL")
        db.execute("create table if not exists snapshots(ts real primary key, market text, projects text)")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=collect, daemon=True).start()
    server.serve_forever()
