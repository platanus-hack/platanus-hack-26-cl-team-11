import { snapshot, history } from '../lib/feed.mjs';
import { parseCredential, exchangePrincipal } from '../lib/exchange-auth.mjs';
import { initialLedger, operate, requestPrices } from '../lib/exchange-service.mjs';
import { touchPresence } from '../lib/exchange-stats.mjs';
import { transact } from '../lib/exchange-store.mjs';

export default async function exchange(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Authorization');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }
  try {
    const credential = parseCredential(req.headers.authorization);
    const action = req.method === 'POST' ? req.body : null;
    if (req.method === 'POST') {
      if (!credential) return res.status(401).json({ error: 'Se necesita una billetera.' });
      if (!['join', 'list', 'bet', 'order', 'cancel'].includes(action?.type))
        return res.status(400).json({ error: 'Acción desconocida.' });
      if (JSON.stringify(action).length > 4096)
        return res.status(413).json({ error: 'Orden demasiado grande.' });
    }
    const selected = typeof req.query.marketId === 'string' ? req.query.marketId : undefined;
    const visitorHeader = req.headers['x-exchange-visitor'];
    const visitor = typeof visitorHeader === 'string' && /^[0-9a-f]{32}$/.test(visitorHeader) ? visitorHeader : null;
    const prices = requestPrices(snapshot, history);
    const result = await transact(initialLedger, async (ledger) => {
      // Authorization and the operation share a conditional write with revocation.
      const now = Date.now();
      const { actor, channel } = exchangePrincipal(ledger, credential, action, now);
      const presenceChanged = touchPresence(ledger, { actor, visitor, channel }, now);
      const update = await operate(ledger, { actor, action, selected }, prices);
      return { ...update, changed: update.changed || presenceChanged };
    });
    return res.json(result);
  } catch (err) {
    const expected = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599;
    if (!expected) console.error('exchange unavailable');
    return res.status(expected ? err.status : 503).json({
      error: expected ? err.message : 'La bolsa está reconectando. Reintenta con la misma orden.',
      ...(expected && err.code ? { code: err.code } : {}),
    });
  }
}
