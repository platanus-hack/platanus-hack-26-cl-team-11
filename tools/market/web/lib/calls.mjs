import { createHmac, timingSafeEqual } from 'node:crypto';
import { atTime } from './feed.mjs';

function sign(text) {
  if (!process.env.CALL_SECRET) throw new Error('Firma no disponible');
  return createHmac('sha256', process.env.CALL_SECRET).update(text).digest('base64url');
}
export function issue(board, pick) {
  const rival = board.teams.find(t => t.team !== pick.team);
  const side = t => ({ team:t.team, id:t.id, price:t.price });
  const call = { event:board.event, start:board.at, end:board.at+300000, pick:side(pick), rival:side(rival) };
  const data = Buffer.from(JSON.stringify(call)).toString('base64url');
  return { call, ticket: data + '.' + sign(data) };
}
export function verify(ticket) {
  if (typeof ticket !== 'string' || ticket.length > 1500) return null;
  const [data, sig, ...extra] = ticket.split('.');
  if (!data || !sig || extra.length) return null;
  const expected = Buffer.from(sign(data));
  const input = Buffer.from(sig);
  if (input.length !== expected.length || !timingSafeEqual(input, expected)) return null;
  return JSON.parse(Buffer.from(data, 'base64url'));
}
export function score(call, tapes) {
  const moves = tapes.map((points,i) => {
    if (!points.length || points.at(-1)[0] < call.end) return null;
    const price = atTime(points, call.end);
    return price ? price / [call.pick, call.rival][i].price - 1 : null;
  });
  if (moves.includes(null)) return { state:'awaiting_history' };
  const gap = moves[0] - moves[1];
  return { state:'settled', moves, winner:Math.abs(gap) < 1e-9 ? 'tie' : gap > 0 ? 'pick' : 'rival' };
}
