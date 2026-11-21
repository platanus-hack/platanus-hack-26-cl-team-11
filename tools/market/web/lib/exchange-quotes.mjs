import { evaluate } from './exchange-contracts.mjs';

const scenarioPercents = [80, 92, 100, 108, 120];
const halfSpread = 3;

function scenarios(board, slug, oracleId) {
  const project = board.teams.find((entry) => entry.team === slug && entry.id === oracleId);
  if (!Number.isFinite(project?.price) || project.price < 0 || project.price > 1) {
    throw new Error('Falta una cotización oficial válida para ' + slug + '.');
  }
  return scenarioPercents.map((percent) => Math.min(1, project.price * percent / 100));
}

// Scenario marks seed the demo book. Only the hypothetical payouts leave this function.
export function starterQuote(market, board) {
  const spots = scenarios(board, market.team, market.teamId);
  const rivalSpots = market.kind === 'race' ? scenarios(board, market.rival, market.rivalId) : null;
  let total = 0;
  for (const spot of spots) {
    const tape = { [market.team]: [[market.expiry, spot]] };
    if (rivalSpots) {
      for (const rivalSpot of rivalSpots) {
        tape[market.rival] = [[market.expiry, rivalSpot]];
        total += evaluate(market, tape).payout;
      }
    } else {
      total += evaluate(market, tape).payout;
    }
  }
  const reference = Math.round(total / (spots.length * (rivalSpots?.length ?? 1)));
  return {
    bid: Math.max(1, reference - halfSpread),
    ask: Math.min(99, reference + halfSpread),
    reference,
  };
}
