"""Replay momentum vs. reversal using archived public histories, one lot at a time."""
import bisect
import json
import math
from datetime import datetime
from statistics import median

from monitor import DATA, quote

STEP = 10
LOOKBACK = 120
BUDGET = 25
B = 12000
BPS = 150


def candidates(now, prior):
    moves = {t:math.log(now[t]/prior[t]) for t in now}
    center = median(moves.values())
    return sorted(((v-center,t) for t,v in moves.items()))


def backtest(series, start, end, mode):
    trades = []
    lot = None
    for tick in range(start+LOOKBACK,end,STEP):
        prices = series[tick]
        if lot:
            team,shares,debit,at = lot
            # Keep our own buy in the counterfactual inventory until exit.
            p = prices[team]
            factor = math.exp(shares/B)
            post = p*factor / (1-p+p*factor)
            net = quote(post,B,BPS,"sell",shares)["cashDelta"]
            if net-debit >= 2 or net-debit <= -4 or tick-at>=360 or tick+STEP>=end:
                trades.append(net-debit)
                lot = None
            continue
        prior = tick-STEP
        ordered = candidates(series[prior],series[prior-LOOKBACK])
        move,team = ordered[-1] if mode=="momentum" else ordered[0]
        if abs(move)<math.log(1.12) or tick+2*STEP>=end:
            continue
        fill = quote(prices[team],B,BPS,"buy",BUDGET)
        lot = team,fill["shares"],-fill["cashDelta"],tick
    return dict(pnl=sum(trades), wins=sum(x>0 for x in trades), trades=len(trades))


if __name__=="__main__":
    files = sorted((DATA/"history").glob("team-*.json"))
    tracks = {}
    for f in files:
        points=json.loads(f.read_text())
        times=[datetime.fromisoformat(p["t"]).timestamp() for p in points]
        tracks[f.stem]=times,[p["price"] for p in points]
    start=math.ceil(max(times[0] for times,_ in tracks.values())/STEP)*STEP
    end=math.floor(min(times[-1] for times,_ in tracks.values())/STEP)*STEP
    series={tick:{t:prices[bisect.bisect_right(times,tick)-1] for t,(times,prices) in tracks.items()}
            for tick in range(start,end+STEP,STEP)}
    mid=start+(end-start)//(2*STEP)*STEP
    for mode in ("momentum","reversal"):
        for a,b in ((start+STEP,mid),(mid,end)):
            print(mode,datetime.fromtimestamp(a).isoformat(),backtest(series,a,b,mode))
