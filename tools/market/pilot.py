"""One-lot pilot for the 26-cl event. Run from a dedicated clean main checkout."""
import argparse
import fcntl
import getpass
import json
import math
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
from urllib.request import urlopen

from dealer import Dealer, TEAM11
from monitor import DATA, END, PORT, quote

ROOT = Path(__file__).resolve().parents[2]
JOURNAL = Path("docs/MARKET-ORDERS.md")
BOOK = DATA / "orders.jsonl"
TARGET = 1001
BANKROLL = 1000


def ledger():
    if BOOK.exists():
        return [json.loads(line) for line in BOOK.read_text().splitlines()]
    return []


def git(*args):
    return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()


def publish(entries):
    path = ROOT / JOURNAL
    content = path.read_text() if path.exists() else (
        "# Órdenes verificadas · Santiago 2026\n\n"
        "Cada fila corresponde a un recibo encontrado en la cartola posterior a la orden. "
        "El valor total incluye la valorización de las acciones abiertas. Horarios en UTC.\n\n"
        "| Hora | Equipo | Lado | Acciones | Comisión | Cambio en caja | Caja | Valor total | Recibo |\n"
        "|---|---|---|---:|---:|---:|---:|---:|---|\n")
    for r in entries:
        if r["id"] not in content:
            content += (f'| {r["time"]} | {r["team"]} | {r["side"]} | {r["shares"]} | '
                        f'{r["fee"]} | {r["cashDelta"]:+d} | {r["cash"]} | '
                        f'{r["markedValue"]} | {r["id"]} |\n')
    if entries and (not path.exists() or path.read_text()!=content):
        path.write_text(content)
    if not entries:
        return
    if git("status","--porcelain","--",str(JOURNAL)):
        git("add",str(JOURNAL))
        git("commit","--only","-m","docs: registra operación verificada del mercado","--",str(JOURNAL))
    for attempt in range(3):
        try:
            git("pull","--rebase","origin","main")
            git("push","origin","main")
            return
        except subprocess.CalledProcessError:
            if attempt==2:
                raise
            time.sleep(2)


def local(route):
    with urlopen(f"http://127.0.0.1:{PORT}/"+route,timeout=3) as response:
        return json.load(response)


def decision(entries, portfolio, exits_only=False):
    snapshot = local("movers?seconds=120")
    if snapshot["status"] != "open":
        return "stop", "market "+snapshot["status"]
    if abs(snapshot["ageSeconds"])>20 or not snapshot["windowAvailable"]:
        return "wait", "waiting for fresh two-minute window"
    projects = {p["team"]:p for p in snapshot["projects"]}
    market = local("state")["market"]
    b, f = market["liquidityB"],market["feeBps"]
    last = entries[-1] if entries else None
    held = last if last and last["side"]=="buy" else None
    cash = portfolio["cashBananas"]
    positions = portfolio["positions"]
    if cash>=TARGET and not positions:
        return "stop", f"verified cash {cash}"
    if held:
        team = held["team"]
        shares = held["shares"]
        if not any(p["projectId"]==projects[team]["id"] and p["shares"]==shares for p in positions):
            return "stop", "position changed outside pilot"
        credit = quote(projects[team]["price"],b,f,"sell",shares)["cashDelta"]
        gain = credit+held["cashDelta"]
        age = time.time()-datetime.fromisoformat(held["time"]).timestamp()
        if gain>=2 or gain<=-4 or age>=360:
            if credit < 1:
                return "wait","position below one net banana"
            # Keep the profit threshold during an upward exit.
            floor = -held["cashDelta"]+2 if gain>=2 else max(1,credit-1)
            return "order",(team,"sell",shares,floor)
        return "wait",f"{team} exit quote {credit}, lot P&L {gain:+}"
    if any(p["projectId"]!=TEAM11 for p in positions):
        return "stop","unrecognized open position"
    if positions:
        shares = positions[0]["shares"]
        credit = quote(projects["team-11"]["price"],b,f,"sell",shares)["cashDelta"]
        if cash+credit>=TARGET:
            return "order",("team-11","sell",shares,TARGET-cash)
    if exits_only:
        if not positions:
            return "stop","no remaining position"
        return "wait",f"existing position returns {credit}; {TARGET-cash} needed for target"
    pnl = sum(r["cashDelta"] for r in entries if r["team"]!="team-11")
    if pnl<=-12 or sum(r["side"]=="buy" for r in entries)>=8:
        return "stop",f"pilot budget reached, closed-lot P&L {pnl:+}"
    if last and time.time()-datetime.fromisoformat(last["time"]).timestamp()<120:
        return "wait","cooldown after exit"
    if time.time()>END-600:
        return "stop","event ending"
    eligible = [p for p in projects.values() if p["team"]!="team-11" and "changePct" in p]
    center = median(math.log1p(p["changePct"]/100) for p in projects.values() if "changePct" in p)
    p = max(eligible,key=lambda p:p["changePct"])
    if math.log1p(p["changePct"]/100)-center<math.log(1.12) or p["netShares"]<=0:
        return "wait","no qualifying inflow"
    limit = quote(p["price"],b,f,"buy",25)["priceAfter"]*1.005
    return "order",(p["team"],"buy",25,limit)


def run(exits_only):
    if git("branch","--show-current")!="main" or git("diff","--cached","--name-only"):
        raise RuntimeError("use a dedicated main checkout")
    dealer=Dealer(getpass.getpass("Event session: ").strip())
    if dealer.pending.exists():
        raise RuntimeError("reconcile pending order before starting")
    entries=ledger()
    publish(entries)
    portfolio=dealer.account()
    last_report=0
    while time.time()<END:
        action, reason = decision(entries,portfolio,exits_only)
        if action=="stop":
            print(reason,flush=True)
            return
        if action=="order":
            try:
                line = dealer.order(*reason)
            except ValueError as exc:
                if dealer.pending.exists() or not any(x in str(exc) for x in ("outside limit","PRICE_MOVED","stale market state")):
                    raise
                print("Skipped quote:",str(exc),flush=True)
            else:
                print(json.dumps(line),flush=True)
                entries=ledger()
                publish(entries)
                portfolio=dealer.account()
                continue
        if time.time()-last_report>=60:
            print(datetime.now(timezone.utc).isoformat(),reason,flush=True)
            portfolio=dealer.account()
            last_report=time.time()
        time.sleep(10)


if __name__=="__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--exits-only", action="store_true", help="watch existing holdings without new purchases")
    args = parser.parse_args()
    os.umask(0o077)
    DATA.mkdir(exist_ok=True,parents=True)
    with (DATA/"dealer.lock").open("a") as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        run(args.exits_only)
