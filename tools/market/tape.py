"""Rebuild every trade of the 26-cl market from the public price histories.

Each trade adds one point to all 48 histories. Only the traded team moves against
the rest, so the price ratios give the team and the number of shares.
"""
import argparse
import json
import math
import time
from datetime import datetime, timezone
from statistics import median

from monitor import DATA, read_json

HISTORY = DATA / "history"
LIQUIDITY = 12000
FEE_BPS = 150


def refresh():
    HISTORY.mkdir(parents=True, exist_ok=True)
    for project in read_json("state")["projects"]:
        target = HISTORY / (project["teamSlug"] + ".json")
        tmp = target.with_suffix(".tmp")
        tmp.write_text(json.dumps(read_json("history/" + project["id"])["points"]))
        tmp.replace(target)
        time.sleep(0.4)


def tracks():
    series = {}
    for path in sorted(HISTORY.glob("team-*.json")):
        points = json.loads(path.read_text())
        series[path.stem] = [(datetime.fromisoformat(p["t"].replace("Z", "+00:00")).timestamp(), p["price"])
                             for p in points]
    if len(series) != 48:
        raise SystemExit("use --refresh to fetch all 48 histories")
    return series


def opening(series):
    return {team: points[0][1] for team, points in series.items()}


def trades(series):
    """Rows of dict(t, team, shares, before, after, bananas). Buys are positive."""
    by_time = {team: dict(points) for team, points in series.items()}
    prices = opening(series)
    rows = []
    for t in sorted({t for points in series.values() for t, _ in points})[1:]:
        seen = {team: by_time[team][t] for team in series if t in by_time[team]}
        if len(seen) != len(series):
            continue
        ratios = {team: seen[team] / prices[team] for team in series}
        rest = median(ratios.values())
        movers = [team for team in series if abs(math.log(ratios[team] / rest)) > 1e-9]
        if len(movers) == 1:
            team = movers[0]
            shares = LIQUIDITY * math.log(ratios[team] / rest)
            before = prices[team]
            bananas = LIQUIDITY * math.log(1 - before + before * math.exp(shares / LIQUIDITY))
            rows.append(dict(t=t, team=team, shares=shares, before=before, after=seen[team], bananas=bananas))
        prices = seen
    return rows


def fee(amount):
    return max(1, math.ceil(amount * FEE_BPS / 10000)) if amount > 0 else 0


class World:
    """The market with our own orders added. Other buyers spend the same bananas, sellers sell the same shares."""

    def __init__(self, start):
        self.x = dict(start)
        self.total = sum(self.x.values())

    def price(self, team):
        return self.x[team] / self.total

    def scale(self, team, factor):
        self.total += self.x[team] * (factor - 1)
        self.x[team] *= factor

    def replay(self, row):
        if row["shares"] > 0:
            self.scale(row["team"], 1 + math.expm1(row["bananas"] / LIQUIDITY) * self.total / self.x[row["team"]])
        else:
            self.scale(row["team"], math.exp(row["shares"] / LIQUIDITY))

    def buy(self, team, order):
        """Returns (shares, bananas paid) for an order of `order` bananas."""
        charge = fee(order)
        shares = math.floor(LIQUIDITY * math.log1p(math.expm1((order - charge) / LIQUIDITY) * self.total / self.x[team]))
        before = self.total
        self.scale(team, math.exp(shares / LIQUIDITY))
        return shares, math.floor(LIQUIDITY * math.log(self.total / before)) + charge

    def quote(self, team, shares):
        after = self.total + self.x[team] * math.expm1(-shares / LIQUIDITY)
        gross = math.floor(LIQUIDITY * math.log(self.total / after))
        return gross - fee(gross)

    def sell(self, team, shares):
        net = self.quote(team, shares)
        self.scale(team, math.exp(-shares / LIQUIDITY))
        return net


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="download the 48 public histories again")
    parser.add_argument("--last", type=int, default=30, help="print this many recent trades")
    args = parser.parse_args()
    if args.refresh:
        refresh()
    rows = trades(tracks())
    with (DATA / "tape.jsonl").open("w") as out:
        for row in rows:
            out.write(json.dumps(row) + "\n")
    buys = [r for r in rows if r["shares"] > 0]
    print(len(rows), "trades,", len(buys), "buys worth", round(sum(r["bananas"] for r in buys)), "bananas,",
          len(rows) - len(buys), "sells worth", round(-sum(r["bananas"] for r in rows if r["shares"] < 0)))
    for row in rows[-args.last:]:
        clock = datetime.fromtimestamp(row["t"], timezone.utc).strftime("%H:%M:%S")
        print(clock, row["team"].ljust(8), f'{row["shares"]:+8.0f} sh {row["bananas"]:+8.1f} b  {row["before"]:.5f} -> {row["after"]:.5f}')
