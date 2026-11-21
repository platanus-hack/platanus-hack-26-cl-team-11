import { createHash } from 'node:crypto';
import { snapshot, history } from '../lib/feed.mjs';
import { initialLedger, operate, requestPrices } from '../lib/exchange-service.mjs';
import { transact } from '../lib/exchange-store.mjs';

export default async function exchange(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Authorization');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).setHeader('Allow', 'GET, POST').end();
  const auth = req.headers.authorization;
  let actor = null;
  if (auth !== undefined) {
    const match = /^Bearer ([0-9a-f]{64})$/.exec(auth);
    if (!match) return res.status(401).json({ error: 'Clave de billetera inválida.' });
    actor = 'player:' + createHash('sha256').update(match[1]).digest('hex');
  }
  const action = req.method === 'POST' ? req.body : null;
  if (
    req.method === 'POST' &&
    (!actor || !action?.type || !['join', 'list', 'order', 'cancel'].includes(action.type))
  ) {
    return res
      .status(actor ? 400 : 401)
      .json({ error: actor ? 'Acción desconocida.' : 'Se necesita una billetera.' });
  }
  if (action && JSON.stringify(action).length > 4096)
    return res.status(413).json({ error: 'Orden demasiado grande.' });
  try {
    const selected = typeof req.query.marketId === 'string' ? req.query.marketId : undefined;
    const prices = requestPrices(snapshot, history);
    const result = await transact(initialLedger, (ledger) => operate(ledger, { actor, action, selected }, prices));
    return res.json(result);
  } catch (err) {
    const expected = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599;
    if (!expected) console.error('exchange unavailable', err.name, err.code ?? '');
    return res
      .status(expected ? err.status : 503)
      .json({
        error: expected ? err.message : 'La bolsa está reconectando. Reintenta con la misma orden.',
        code: err.code,
      });
  }
}
