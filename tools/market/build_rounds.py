"""Build portable five-minute challenges from the public histories saved by replay.py."""
import bisect
import json
from datetime import datetime
from pathlib import Path

from monitor import DATA

series = {}
for path in sorted((DATA / "history").glob("team-*.json")):
    points = json.loads(path.read_text())
    series[path.stem] = ([datetime.fromisoformat(p["t"]).timestamp() for p in points],
                         [p["price"] for p in points])

def price(team, t):
    times, prices = series[team]
    return prices[bisect.bisect_right(times, t) - 1]

start = int(max(times[0] for times, _ in series.values())) + 301
end = int(min(times[-1] for times, _ in series.values())) - 300
rounds = []
for t in range(start, end, 900):
    change = {team: price(team, t) / price(team, t-300) - 1 for team in series}
    fast = max(change, key=change.get)
    favorite = max((team for team in series if team != fast), key=lambda team: price(team, t))
    choices = []
    for team in sorted([fast, favorite]):
        choices.append(dict(team=team, price=price(team, t), before=change[team],
                            after=price(team, t+300)/price(team, t)-1))
    gap = choices[0]["after"] - choices[1]["after"]
    winner = "tie" if abs(gap) < 1e-9 else max(choices, key=lambda c: c["after"])["team"]
    rounds.append(dict(at=t*1000, impulse=fast, favorite=favorite, choices=choices, winner=winner))
out = Path(__file__).parent / "web/public/rounds.json"
out.write_text(json.dumps(rounds, separators=(",", ":"))+"\n")
print(f"{len(rounds)} rounds")
