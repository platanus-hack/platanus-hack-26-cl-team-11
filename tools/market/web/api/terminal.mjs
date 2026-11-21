import { snapshot, history, atTime } from '../lib/feed.mjs';

export default async function terminal(req, res) {
  if (req.method !== 'GET') return res.status(405).setHeader('Allow', 'GET').end();
  try {
    const board = await snapshot();
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=5');
    const slug = req.query.team;
    if (!slug) return res.json(board);
    const team = board.teams.find((t) => t.team === slug);
    if (!team) return res.status(404).json({ error: 'Equipo desconocido' });
    const points = (await history(team.id)).filter(([t]) => t <= board.at);
    const start = board.at - 30 * 60000;
    const base = atTime(points, start);
    const series = points.filter(([t]) => t > start && t < board.at);
    if (base) series.unshift([start, base]);
    series.push([board.at, team.price]);
    const prior = atTime(points, board.at - 300000);
    return res.json({ ...team, at: board.at, points: series, change5m: prior ? team.price / prior - 1 : null });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'No se pudo leer el mercado de Platanus' });
  }
}
