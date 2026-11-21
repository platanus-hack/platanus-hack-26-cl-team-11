import { readFileSync } from 'node:fs';
const rounds = JSON.parse(readFileSync(new URL('../public/rounds.json', import.meta.url)));
export default function replay(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).setHeader('Allow', 'GET, POST').end();
  const number = Number(req.query.round ?? 1),
    round = rounds[number - 1];
  if (!round || !Number.isInteger(number)) return res.status(404).json({ error: 'Ronda desconocida' });
  const view = {
    number,
    total: rounds.length,
    at: round.at,
    end: round.at + 300000,
    agents: { impulse: round.impulse, favorite: round.favorite },
    choices: round.choices.map(({ team, price, before }) => ({ team, price, before })),
  };
  if (req.method === 'GET') return res.json(view);
  const pick = round.choices.find((c) => c.team === req.body?.team);
  if (!pick) return res.status(400).json({ error: 'Elige uno de los dos equipos de la ronda' });
  return res.json({
    ...view,
    pick: pick.team,
    correct: pick.after === Math.max(...round.choices.map((c) => c.after)),
    outcome: round.choices.map(({ team, after }) => ({ team, change: after })),
  });
}
