"""Forward-test small orders with a full observation of entry and exit latency."""
import json
import math
import os
import sqlite3
import time
from statistics import median

from monitor import DATA, DB, END, quote


def run():
    lot = None
    pending = None
    last_exit = 0
    last_ts = 0
    with sqlite3.connect(DB) as db:
        while time.time() < END:
            row = db.execute("select ts,market,projects from snapshots order by ts desc limit 1").fetchone()
            if not row or row[0] == last_ts or abs(time.time()-row[0]) > 20:
                time.sleep(3)
                continue
            ts, market, projects = row[0], json.loads(row[1]), json.loads(row[2])
            last_ts = ts
            if market["status"] != "open":
                return
            b, fee = market["liquidityB"], market["feeBps"]
            teams = {p["team"]:p for p in projects}
            if pending and not lot:
                p = teams[pending]["price"]
                fill = quote(p, b, fee, "buy", 15)
                if fill["priceAfter"]/p <= 1.30:
                    lot = dict(team=pending, shares=fill["shares"], debit=-fill["cashDelta"], entry=ts)
                    print("Paper entry", json.dumps(lot), flush=True)
                pending = None
                continue
            if lot:
                p = teams[lot["team"]]["price"]
                factor = math.exp(lot["shares"]/b)
                virtual_price = p*factor/(1+p*(factor-1))
                credit = quote(virtual_price,b,fee,"sell",lot["shares"])["cashDelta"]
                pnl = credit-lot["debit"]
                if pending:
                    record = dict(**lot, exit=ts, credit=credit, pnl=pnl)
                    with (DATA/"forward.jsonl").open("a") as log:
                        log.write(json.dumps(record)+"\n")
                    print("Paper exit", json.dumps(record), flush=True)
                    last_exit, lot, pending = ts, None, None
                elif pnl>=3 or pnl<=-4 or ts-lot["entry"]>=600:
                    pending="exit"
                continue
            if ts-last_exit<120:
                continue
            old = db.execute("select ts,projects from snapshots where ts<=? order by ts desc limit 1",
                             (ts-120,)).fetchone()
            if not old or ts-old[0]>145:
                continue
            prior = {p["team"]:p for p in json.loads(old[1])}
            moves = {team:math.log(p["price"]/prior[team]["price"])
                     for team,p in teams.items() if team in prior}
            center = median(moves.values())
            eligible = [t for t in moves if t!="team-11" and teams[t]["q"]>prior[t]["q"]]
            if eligible:
                team=max(eligible,key=moves.get)
                if moves[team]-center>=math.log(1.12):
                    pending=team


if __name__=="__main__":
    os.umask(0o077)
    run()
