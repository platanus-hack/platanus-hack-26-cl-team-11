import { snapshot, history } from '../lib/feed.mjs';
import { issue, verify, score } from '../lib/calls.mjs';
export default async function calls(req, res) {
  res.setHeader('Cache-Control','no-store');
  try {
    if (req.method === 'POST') {
      const board = await snapshot();
      if (board.status !== 'open' || Math.abs(Date.now()-board.at)>30000)
        return res.status(409).json({error:'El mercado necesita una lectura abierta y reciente'});
      const pick = board.teams.find(t=>t.team===req.body?.team);
      if (!pick) return res.status(400).json({error:'Elige un equipo válido'});
      return res.status(201).json(issue(board, pick));
    }
    if (req.method !== 'GET') return res.status(405).setHeader('Allow','GET, POST').end();
    const call = verify(req.query.ticket);
    if (!call) return res.status(400).json({error:'Comprobante inválido'});
    if (Date.now()<call.end) return res.json({call,state:'open'});
    const tapes = await Promise.all([call.pick,call.rival].map(t=>history(t.id)));
    return res.json({call,...score(call,tapes)});
  } catch {
    return res.status(503).json({error:'Lectura temporalmente no disponible. Vuelve a consultar.'});
  }
}
