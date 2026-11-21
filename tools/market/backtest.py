"""Replay the inventory rules of inventory.py over the rebuilt tape. Results are hypothetical."""
import argparse
from datetime import datetime, timezone

from tape import World, opening, tracks, trades

OWN_TEAM = "team-11"


def replay(rows, start_prices, begin, clip=20, budget=300, gain=0.5, edge=4, cheap=1.3, rest=180, delay=1.0):
    world = World(start_prices)
    teams = sorted(start_prices)
    lots, due, sold, gains = {}, {}, {}, []
    started = False

    def wanted(team):
        shares, cost = lots[team]
        net = world.quote(team, shares)
        return net >= cost * (1 + gain) and net - cost >= edge

    def fill(t):
        ordered = sorted((world.price(team), team) for team in teams)
        ceiling = cheap * (ordered[23][0] + ordered[24][0]) / 2
        for price, team in ordered:
            if sum(cost for _, cost in lots.values()) + clip > budget:
                return
            if price <= ceiling and team != OWN_TEAM and team not in lots and t - sold.get(team, 0) >= rest:
                lots[team] = world.buy(team, clip)

    for row in rows:
        t = row["t"]
        for team in [team for team, at in due.items() if at <= t]:
            at = due.pop(team)
            if team in lots and wanted(team):
                shares, cost = lots.pop(team)
                gains.append(world.sell(team, shares) - cost)
                sold[team] = at
        if not started and t >= begin:
            started = True
            fill(t)
        world.replay(row)
        if started:
            for team in lots:
                if team not in due and wanted(team):
                    due[team] = t + delay
            fill(t)
    cost = sum(cost for _, cost in lots.values())
    worth = sum(world.sell(team, shares) for team, (shares, _) in list(lots.items()))
    return dict(sales=len(gains), realized=sum(gains), best=max(gains, default=0), worst=min(gains, default=0),
                held=len(lots), cost=cost, worth=worth)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--clip", type=int, default=20)
    parser.add_argument("--budget", type=int, default=300)
    parser.add_argument("--gain", type=float, default=0.5)
    parser.add_argument("--delay", type=float, default=1.0, help="seconds between the signal and our sale")
    parser.add_argument("--every", type=int, default=30, help="minutes between start times")
    args = parser.parse_args()
    series = tracks()
    rows = trades(series)
    first, last = rows[0]["t"], rows[-1]["t"]
    print("start UTC  sales  realized  best  worst  lots  cost -> sellable")
    begin = (int(first) // 1800 + 1) * 1800
    while begin < last - 600:
        r = replay(rows, opening(series), begin, clip=args.clip, budget=args.budget, gain=args.gain, delay=args.delay)
        clock = datetime.fromtimestamp(begin, timezone.utc).strftime("%H:%M")
        print(f'{clock:>9}  {r["sales"]:5d}  {r["realized"]:+8d}  {r["best"]:+5d}  {r["worst"]:+5d}  {r["held"]:4d}  {r["cost"]:4d} -> {r["worth"]}')
        begin += args.every * 60
