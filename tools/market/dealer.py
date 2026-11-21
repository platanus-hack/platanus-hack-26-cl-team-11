"""Interactive game orders. The session cookie is entered at a hidden prompt."""
import fcntl
import getpass
import http.cookiejar
import json
import os
import shlex
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser

from monitor import DATA, END, ORIGIN, quote

EDITION = "26-cl"
MARKET_ID = "dc7d3432-3ee8-4631-9c2a-ef8ed5eede67"
CAP = 25
TEAM11 = "4a76d609-35b3-433e-9f55-48a5554ad448"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


class Page(HTMLParser):
    csrf = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "meta" and a.get("name") == "csrf-token":
            self.csrf = a.get("content")


class Dealer:
    def __init__(self, session):
        jar = http.cookiejar.CookieJar()
        jar.set_cookie(http.cookiejar.Cookie(
            0, "_hack_session", session, None, False, "hack.platan.us", False,
            False, "/", True, True, None, True, None, None, {}, False))
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), NoRedirect())
        self.http.addheaders = [("User-Agent", "PlatanusMarketMonitor/1.0")]
        self.pending = DATA / "pending.json"
        self.log = DATA / "orders.jsonl"

    def api(self, route, order=None, csrf=None):
        req = urllib.request.Request(ORIGIN + "/api/market/" + route + "?event=" + EDITION)
        if order:
            req.data = json.dumps(order).encode()
            req.add_header("Content-Type", "application/json")
            req.add_header("Origin", ORIGIN)
            req.add_header("X-CSRF-Token", csrf)
        with self.http.open(req, timeout=12) as res:
            return json.load(res)

    def account(self):
        pf = self.api("portfolio")
        return {k:pf[k] for k in ("cashBananas","totalValueBananas","positions","recentTrades")}

    def order(self, team, side, size, limit):
        if self.pending.exists():
            raise ValueError("pending order requires reconciliation")
        if time.time() >= END:
            raise ValueError("event ended")
        with self.http.open(ORIGIN + "/26-cl/market", timeout=12) as r:
            page = Page()
            page.feed(r.read().decode())
        if not page.csrf:
            raise ValueError("missing CSRF token")
        before = self.account()
        state = self.api("state")
        m = state["market"]
        if m["id"] != MARKET_ID or m["status"] != "open" or not state["canTrade"]:
            raise ValueError("market unavailable")
        if abs(time.time() - state["serverTs"]/1000) > 10:
            raise ValueError("stale market state")
        project = next(p for p in state["projects"] if p["teamSlug"] == team)
        pid = project["id"]
        holdings = {p["projectId"]:p["shares"] for p in before["positions"]}
        if side == "buy" and not m["minTradeBananas"] <= size <= min(CAP,before["cashBananas"]):
            raise ValueError("buy outside pilot limits")
        if side == "sell" and not 0 < size <= holdings.get(pid,0):
            raise ValueError("invalid sale size")
        est = quote(project["price"], m["liquidityB"], m["feeBps"], side, size)
        if side == "sell" and est["cashDelta"] < limit or side == "buy" and est["priceAfter"] > limit:
            raise ValueError("quote outside limit")
        req = dict(projectId=pid, side=side, expectedPriceAfter=est["priceAfter"], slippageBps=0)
        req["bananas" if side == "buy" else "shares"] = size
        with self.pending.open("x") as f:
            json.dump(dict(request=req, cash=before["cashBananas"], shares=holdings.get(pid,0)), f)
            f.flush()
            os.fsync(f.fileno())
        try:
            result = self.api("trade", req, page.csrf)
        except urllib.error.HTTPError as exc:
            try:
                result = json.loads(exc.read())
            except ValueError:
                raise ValueError(f"HTTP {exc.code}, verify portfolio before retry")
            if exc.code >= 500:
                raise ValueError("uncertain server result, verify portfolio")
        if not result.get("ok"):
            if result.get("error") in ("PRICE_MOVED","MARKET_NOT_OPEN","INSUFFICIENT_FUNDS",
                                       "INSUFFICIENT_SHARES","TRADE_TOO_SMALL","HACKERS_ONLY"):
                self.pending.unlink()
            raise ValueError("order rejected: " + str(result.get("error","unknown")))
        receipt = result["trade"]
        after = self.account()
        filled = next((t for t in after["recentTrades"] if t["id"] == receipt["id"]),None)
        balance = after["cashBananas"]
        actual = next((p["shares"] for p in after["positions"] if p["projectId"]==pid),0)
        expected = holdings.get(pid,0) + (1 if side=="buy" else -1)*receipt["shares"]
        if not filled or balance != result["newBalance"] or actual != expected:
            raise ValueError("fill needs reconciliation")
        line = dict(time=receipt["createdAt"], id=receipt["id"], team=team, side=side,
                    shares=receipt["shares"], fee=receipt["feeBananas"], price=receipt["priceAtTrade"],
                    cashDelta=balance-before["cashBananas"], cash=balance, held=actual,
                    markedValue=after["totalValueBananas"])
        with self.log.open("a") as f:
            f.write(json.dumps(line)+"\n")
            f.flush()
            os.fsync(f.fileno())
        self.pending.unlink()
        return line


if __name__ == "__main__":
    os.umask(0o077)
    DATA.mkdir(parents=True, exist_ok=True)
    with (DATA/"dealer.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        dealer = Dealer(getpass.getpass("Event session: ").strip())
        print("Commands: account | buy TEAM BANANAS MAX_POST_PRICE | sell TEAM SHARES MIN_NET | quit")
        while True:
            try:
                parts = shlex.split(input("market> "))
                if parts == ["quit"]:
                    break
                if parts == ["account"]:
                    print(json.dumps(dealer.account()))
                elif len(parts)==4 and parts[0] in ("buy","sell"):
                    print(json.dumps(dealer.order(parts[1],parts[0],int(parts[2]),float(parts[3]))))
            except EOFError:
                break
            except Exception as exc:
                print(type(exc).__name__, str(exc))
