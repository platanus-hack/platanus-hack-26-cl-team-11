"""Hold small lots across the cheapest teams and sell each lot into a buying spike.

Live mode asks for the event session at a hidden prompt. `--paper` needs no session.
Tunables live in trader.json next to the observations and are re-read while running.
At `until`, or 45 minutes before a published close, it sells everything it holds.
"""
import argparse
import fcntl
import getpass
import http.client
import json
import math
import os
import re
import threading
import time
from collections import deque
from datetime import datetime, timezone
from statistics import median

from feed import AGENT, EVENT, HOST, Feed
from monitor import DATA, END, quote, read_json

MARKET_ID = "dc7d3432-3ee8-4631-9c2a-ef8ed5eede67"
OWN_TEAM = "team-11"
SETTINGS = DATA / "trader.json"
STOP = DATA / "inventory.stop"
TAPE = DATA / "feed-tape.jsonl"
DEFAULTS = dict(buying=True, clip=20, clips=1, budget=300, floor=600, cheap=1.3,
                gain=0.5, edge=4, pace=4, calm=180, rest=180, liquidate=False, only=[], skip=[], sell=[],
                until="2026-11-22T15:00:00Z")
BOUNDS = dict(clip=(10, 66), clips=(1, 3), budget=(0, 700), floor=(300, 5000), cheap=(0.3, 2.0),
              gain=(0.2, 9.0), edge=(2, 500), pace=(2, 600), calm=(0, 3600), rest=(30, 7200))


def settings():
    values = dict(DEFAULTS)
    try:
        stored = json.loads(SETTINGS.read_text())
    except (OSError, ValueError):
        stored = {}
    for name, value in stored.items():
        if name in ("buying", "liquidate") and isinstance(value, bool):
            values[name] = value
        elif name in BOUNDS and isinstance(value, (int, float)) and not isinstance(value, bool):
            low, high = BOUNDS[name]
            values[name] = min(high, max(low, value))
        elif name in ("only", "skip", "sell") and isinstance(value, list):
            values[name] = [team for team in value if isinstance(team, str) and re.fullmatch(r"team-\d+", team) and team != OWN_TEAM]
        elif name == "until" and isinstance(value, str):
            values[name] = value
    values["clip"], values["clips"] = int(values["clip"]), int(values["clips"])
    try:
        values["deadline"] = datetime.fromisoformat(values["until"].replace("Z", "+00:00")).timestamp()
    except ValueError:
        values["deadline"] = datetime.fromisoformat(DEFAULTS["until"].replace("Z", "+00:00")).timestamp()
    return values


class SessionEnded(Exception):
    pass


class Book:
    """Latest public prices, fed by the live socket and by a slow poll."""

    def __init__(self):
        self.lock = threading.RLock()
        self.version = 0
        self.checked = 0.0
        self.market = None
        self.slug = {}
        self.ids = {}
        self.price = {}
        self.trail = {}
        self.shares = {}

    def load(self, state):
        with self.lock:
            self.market = state["market"]
            for project in state["projects"]:
                self.slug[project["id"]] = project["teamSlug"]
                self.ids[project["teamSlug"]] = project["id"]
            self.checked = time.time()
            if state["version"] >= self.version:
                self.version = state["version"]
                self.shares = dict(state.get("qVector") or self.shares)
                self.record({p["id"]: p["price"] for p in state["projects"]})

    def tick(self, message):
        with self.lock:
            state = message.get("state")
            if message.get("type") == "state" and isinstance(state, dict) and {"market", "projects", "version"} <= set(state):
                self.load(state)
                return True
            if message.get("type") != "trade" or message.get("version", 0) <= self.version:
                return False
            self.version = message["version"]
            self.checked = time.time()
            self.remember(message)
            self.record(message["prices"])
            return True

    def remember(self, message):
        """Append the trade behind a broadcast to a local tape, from the change in net shares."""
        held = message.get("qVector") or {}
        moved = [(pid, amount - self.shares[pid]) for pid, amount in held.items()
                 if pid in self.shares and amount != self.shares[pid]]
        self.shares = dict(held)
        if len(moved) == 1:
            pid, change = moved[0]
            row = dict(at=message.get("at"), team=self.slug.get(pid), shares=change,
                       before=self.price.get(pid), after=message["prices"].get(pid))
            with TAPE.open("a") as out:
                out.write(json.dumps(row) + "\n")

    def record(self, prices):
        now = time.time()
        for pid, price in prices.items():
            self.price[pid] = price
            trail = self.trail.setdefault(pid, deque())
            trail.append((now, price))
            while trail and now - trail[0][0] > 3600:
                trail.popleft()

    def low(self, pid, seconds):
        now = time.time()
        return min((p for t, p in self.trail.get(pid, ()) if now - t <= seconds), default=None)

    def covered(self, seconds):
        first = min((trail[0][0] for trail in self.trail.values() if trail), default=time.time())
        return time.time() - first >= seconds


class Account:
    """Authenticated orders over one kept-alive connection."""

    def __init__(self, session):
        self.cookie = session
        self.lock = threading.Lock()
        self.link = None
        self.csrf = None
        self.csrf_at = 0.0

    def call(self, method, path, body=None, extra=None, retry=True):
        headers = {"User-Agent": AGENT, "Accept": "application/json", "Cookie": "_hack_session=" + self.cookie}
        headers.update(extra or {})
        with self.lock:
            for attempt in range(2):
                try:
                    if self.link is None:
                        self.link = http.client.HTTPSConnection(HOST, timeout=12)
                    self.link.request(method, path, body=body, headers=headers)
                    response = self.link.getresponse()
                    data = response.read()
                    break
                except (OSError, http.client.HTTPException):
                    self.link = None
                    if attempt or not retry:
                        raise
            for name, value in response.getheaders():
                found = re.match(r"_hack_session=([^;]*)", value) if name.lower() == "set-cookie" else None
                if found and found.group(1):
                    self.cookie = found.group(1)
            if response.getheader("Connection", "").lower() == "close":
                self.link = None
        return response.status, data

    def token(self, refresh=False):
        if refresh or not self.csrf:
            status, data = self.call("GET", f"/{EVENT}/market", extra={"Accept": "text/html"})
            found = re.search(r'<meta name="csrf-token" content="([^"]+)"', data.decode(errors="replace"))
            if status != 200 or not found:
                raise SessionEnded("market page without a form token")
            self.csrf, self.csrf_at = found.group(1), time.time()
        return self.csrf

    def portfolio(self):
        status, data = self.call("GET", f"/api/market/portfolio?event={EVENT}")
        if status in (301, 302, 401, 403):
            raise SessionEnded("the event session is no longer accepted")
        folio = json.loads(data)
        if "cashBananas" not in folio:
            raise SessionEnded("portfolio unavailable: " + str(folio.get("error", status)))
        return folio

    def order(self, request):
        """One attempt. A transport failure after sending is reported as uncertain."""
        body = json.dumps(request).encode()
        for attempt in range(2):
            extra = {"Content-Type": "application/json", "Origin": "https://" + HOST,
                     "X-CSRF-Token": self.token(refresh=bool(attempt))}
            try:
                status, data = self.call("POST", f"/api/market/trade?event={EVENT}", body, extra, retry=False)
            except (OSError, http.client.HTTPException):
                return {"uncertain": True}
            if status == 422 and not attempt and b"PRICE_MOVED" not in data:
                continue
            try:
                result = json.loads(data)
            except ValueError:
                return {"uncertain": status >= 500, "error": f"HTTP {status}"}
            if status >= 500:
                result["uncertain"] = True
            return result


class Desk:
    def __init__(self, book, account, ledger_path, paper_cash=None):
        self.book = book
        self.account = account
        self.paper = account is None
        self.ledger_path = ledger_path
        self.lock = threading.RLock()
        self.lots = {}
        self.sold = {}
        self.realized = 0
        self.cash = paper_cash
        self.last_buy = 0.0
        self.halted = None
        self.note = "starting"
        self.fills = 0
        self.config = settings()
        for line in self.ledger():
            self.absorb(line)

    def ledger(self):
        if self.ledger_path.exists():
            return [json.loads(row) for row in self.ledger_path.read_text().splitlines() if row.strip()]
        return []

    def absorb(self, line):
        team = line["team"]
        if line["side"] == "buy":
            lot = self.lots.setdefault(team, dict(shares=0, cost=0, clips=0))
            lot["shares"] += line["shares"]
            lot["cost"] -= line["cashDelta"]
            lot["clips"] += 1
        else:
            lot = self.lots.pop(team, None)
            if lot:
                self.realized += line["cashDelta"] - lot["cost"]
            self.sold[team] = datetime.fromisoformat(line["time"].replace("Z", "+00:00")).timestamp()
        self.cash = line["cash"]
        self.fills += 1

    def write(self, line):
        with self.ledger_path.open("a") as out:
            out.write(json.dumps(line) + "\n")
            out.flush()
            os.fsync(out.fileno())
        self.absorb(line)
        print(json.dumps(line), flush=True)

    def estimate(self, team, side, size):
        market = self.book.market
        price = self.book.price[self.book.ids[team]]
        if self.paper and team in self.lots:
            factor = math.exp(self.lots[team]["shares"] / market["liquidityB"])
            price = price * factor / (1 + price * (factor - 1))
        return price, quote(price, market["liquidityB"], market["feeBps"], side, size)

    def reconcile(self):
        """Server holdings are the truth. The ledger only supplies what each lot cost."""
        if self.paper:
            return
        folio = self.account.portfolio()
        with self.lock:
            self.cash = folio["cashBananas"]
            held = {self.book.slug.get(p["projectId"]): p["shares"] for p in folio["positions"] if p["shares"] > 0}
            held.pop(OWN_TEAM, None)
            if None in held:
                self.halted = "unknown project in portfolio"
                return
            for team in [t for t in self.lots if t not in held]:
                print("Dropped lot missing on server:", team, flush=True)
                del self.lots[team]
            for team, shares in held.items():
                lot = self.lots.get(team)
                if lot and lot["shares"] == shares:
                    continue
                worth = self.estimate(team, "sell", shares)[1]["cashDelta"]
                cost = round(lot["cost"] * shares / lot["shares"]) if lot else max(1, worth)
                print("Adopted server position:", team, shares, "cost", cost, flush=True)
                self.lots[team] = dict(shares=shares, cost=cost, clips=lot["clips"] if lot else 1)

    def deadline(self):
        """When to sell everything: the configured time, or 45 minutes before a published close."""
        close = (self.book.market or {}).get("closesAt")
        limit = self.config["deadline"]
        if close:
            limit = min(limit, datetime.fromisoformat(close.replace("Z", "+00:00")).timestamp() - 2700)
        return limit

    def leaving(self):
        return self.config["liquidate"] or time.time() >= self.deadline()

    def fresh(self, feed):
        return (feed.alive() or time.time() - self.book.checked < 6) and self.book.market \
            and self.book.market["status"] == "open" and self.book.market["id"] == MARKET_ID

    def trade(self, team, side, size, wanted):
        """Returns the ledger line, or None when the order did not fill."""
        pid = self.book.ids[team]
        price, est = self.estimate(team, side, size)
        for attempt in range(3):
            if not wanted(est):
                return None
            if self.paper:
                result = dict(ok=True, newBalance=self.cash + est["cashDelta"], trade=dict(
                    id=f"paper-{time.time():.3f}", shares=est["shares"], feeBananas=est["fee"],
                    priceAtTrade=str(round(est["priceAfter"], 8)),
                    createdAt=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")))
            else:
                request = dict(projectId=pid, side=side, expectedPriceAfter=est["priceAfter"],
                               slippageBps=100 if side == "buy" else 200)
                request["bananas" if side == "buy" else "shares"] = size
                result = self.account.order(request)
            if result.get("ok"):
                receipt = result["trade"]
                held = self.lots.get(team, {}).get("shares", 0)
                held = held + receipt["shares"] if side == "buy" else 0
                line = dict(time=receipt["createdAt"], id=receipt["id"], team=team, side=side,
                            shares=receipt["shares"], fee=receipt["feeBananas"], price=receipt["priceAtTrade"],
                            cashDelta=result["newBalance"] - self.cash, cash=result["newBalance"], held=held)
                self.write(line)
                if side == "buy" and -line["cashDelta"] > size:
                    self.halted = "a purchase cost more than its order"
                return line
            if result.get("uncertain"):
                self.halted = "order outcome unknown, reconciling"
                return None
            error = result.get("error", "unknown")
            if error != "PRICE_MOVED" or "currentPriceAfter" not in result:
                self.note = f"{side} {team} rejected: {error}"
                if error in ("HACKERS_ONLY", "MARKET_NOT_OPEN"):
                    self.halted = error
                return None
            after = float(result["currentPriceAfter"])
            liquidity, bps = self.book.market["liquidityB"], self.book.market["feeBps"]
            if side == "sell":
                factor = math.exp(-size / liquidity)
                price = after / (factor + after * (1 - factor))
                est = quote(price, liquidity, bps, side, size)
            else:
                return None
        return None

    def exits(self):
        with self.lock:
            if self.halted or not self.book.market:
                return
            config = self.config
            for team, lot in list(self.lots.items()):
                if team not in self.book.ids or self.halted:
                    continue
                leave = self.leaving() or team in config["sell"]
                floor = 1 if leave else max(lot["cost"] * (1 + config["gain"]), lot["cost"] + config["edge"])
                self.trade(team, "sell", lot["shares"], lambda est: est["cashDelta"] >= floor)

    def entry(self):
        with self.lock:
            config = self.config
            now = time.time()
            if self.halted or self.leaving() or not config["buying"] or now - self.last_buy < config["pace"]:
                return
            if now >= self.deadline() - 5400:
                self.note = "no purchases in the 90 minutes before the exit time"
                return
            if not self.book.covered(config["calm"]):
                self.note = "watching prices before the first purchase"
                return
            committed = sum(lot["cost"] for lot in self.lots.values())
            clip = config["clip"]
            if committed + clip > config["budget"] or self.cash - clip < config["floor"]:
                self.note = f"inventory at budget, {committed} bananas in {len(self.lots)} lots"
                return
            ceiling = config["cheap"] * median(self.book.price.values())
            choices = []
            for team, pid in self.book.ids.items():
                price = self.book.price[pid]
                lot = self.lots.get(team)
                low = self.book.low(pid, config["calm"])
                if team == OWN_TEAM or price > ceiling or (lot and lot["clips"] >= config["clips"]):
                    continue
                if team in config["skip"] or team in config["sell"] or (config["only"] and team not in config["only"]):
                    continue
                if now - self.sold.get(team, 0) < config["rest"] or (low and price > low * 1.10):
                    continue
                choices.append((price, team))
            if not choices:
                self.note = "no calm cheap team to buy"
                return
            price, team = min(choices)
            limit = self.estimate(team, "buy", clip)[1]["priceAfter"] * 1.01
            self.last_buy = now
            if self.trade(team, "buy", clip, lambda est: est["priceAfter"] <= limit and est["shares"] > 0):
                self.note = f"bought {team}"

    def status(self, feed):
        with self.lock:
            worth, detail = 0, {}
            for team, lot in self.lots.items():
                if team in self.book.ids:
                    price, est = self.estimate(team, "sell", lot["shares"])
                    worth += max(0, est["cashDelta"])
                    detail[team] = dict(shares=lot["shares"], cost=lot["cost"], sellable=est["cashDelta"], price=round(price, 6))
            committed = sum(lot["cost"] for lot in self.lots.values())
            return dict(time=datetime.now(timezone.utc).isoformat(timespec="seconds"), paper=self.paper,
                        cash=self.cash, lots=len(self.lots), committed=committed, sellableNow=worth,
                        realized=self.realized, fills=self.fills, feed=feed.alive(), halted=self.halted,
                        note=self.note, config=self.config, detail=detail,
                        exitAt=datetime.fromtimestamp(self.deadline(), timezone.utc).isoformat(timespec="seconds"))


def take_over(lock):
    """Hold the trading lock. A trader that already holds it is asked to stop through the stop file."""
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return
    except BlockingIOError:
        print("Another trader is running. Asking it to stop.", flush=True)
    STOP.write_text("handover")
    try:
        for _ in range(30):
            time.sleep(1)
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return
            except BlockingIOError:
                continue
        raise SystemExit("The other trader did not stop. Close its window and start again.")
    finally:
        STOP.unlink(missing_ok=True)


def run(paper, cash, session=None):
    book = Book()
    book.load(read_json("state"))
    name = "paper" if paper else "inventory"
    account = None if paper else Account(session)
    desk = Desk(book, account, DATA / f"{name}-orders.jsonl", cash if paper else None)
    if paper and desk.cash is None:
        desk.cash = cash
    desk.reconcile()
    if account:
        account.token()
    print(json.dumps(dict(start=name, cash=desk.cash, lots=desk.lots, realized=desk.realized, config=desk.config)), flush=True)

    def on_message(message):
        try:
            if book.tick(message):
                desk.exits()
        except Exception as exc:
            desk.note = "error: " + type(exc).__name__
            print("Exit check failed:", type(exc).__name__, exc, flush=True)

    feed = Feed(on_message)
    feed.start()
    polled = reported = checked = renewed = time.time()
    while time.time() < END:
        time.sleep(1)
        now = time.time()
        desk.config = settings()
        if STOP.exists():
            print("Stop file present, leaving positions as they are.", flush=True)
            return
        if now - polled >= (15 if feed.alive() else 5):
            polled = now
            try:
                # The authenticated link doubles as the state reader so it stays warm for exits.
                book.load(json.loads(account.call("GET", f"/api/market/state?event={EVENT}")[1]) if account else read_json("state"))
            except Exception as exc:
                print("State read failed:", type(exc).__name__, flush=True)
        if book.market["status"] != "open":
            print("Market", book.market["status"], flush=True)
            return
        try:
            if account and now - renewed >= 300:
                renewed = now
                account.token(refresh=True)
            if desk.halted or now - checked >= 120:
                checked = now
                desk.reconcile()
                if desk.halted and "reconciling" in desk.halted:
                    desk.halted = None
            if desk.fresh(feed):
                desk.exits()
                desk.entry()
        except SessionEnded as exc:
            print("Stopped:", exc, flush=True)
            return
        except Exception as exc:
            desk.note = "error: " + type(exc).__name__
            print("Loop error:", type(exc).__name__, exc, flush=True)
            time.sleep(5)
        if desk.halted in ("HACKERS_ONLY", "MARKET_NOT_OPEN", "unknown project in portfolio", "a purchase cost more than its order"):
            print("Stopped:", desk.halted, flush=True)
            return
        if desk.leaving() and not desk.lots:
            print("Inventory sold.", flush=True)
            return
        if now - reported >= 30:
            reported = now
            status = desk.status(feed)
            (DATA / f"{name}-status.json").write_text(json.dumps(status))
            print(json.dumps({k: status[k] for k in ("time", "cash", "lots", "committed", "sellableNow", "realized", "note")}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--paper", action="store_true", help="simulate fills against live prices, no session and no orders")
    parser.add_argument("--cash", type=int, default=979, help="starting cash for --paper")
    args = parser.parse_args()
    os.umask(0o077)
    DATA.mkdir(parents=True, exist_ok=True)
    if args.paper:
        run(True, args.cash)
    else:
        secret = getpass.getpass("Event session: ").strip()
        with (DATA / "dealer.lock").open("a") as lock:
            take_over(lock)
            run(False, None, secret)
