import { history, snapshot } from '../lib/feed.mjs';
import { EVENT_END } from '../lib/exchange-contracts.mjs';
import { initialLedger, operate, requestPrices } from '../lib/exchange-service.mjs';
import { transact } from '../lib/exchange-store.mjs';

export default async function clock(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).setHeader('Allow', 'GET').end();
  if (Date.now() > EVENT_END + 27 * 3600000) return res.status(204).end();
  try {
    const prices = requestPrices(snapshot, history);
    const state = await transact(initialLedger, (ledger) =>
      operate(ledger, { actor: null, action: null }, prices),
    );
    return res.json({
      at: state.serverTs,
      open: state.markets.filter((m) => m.status === 'open').length,
      pending: state.markets.filter((m) => m.status === 'pending').length,
    });
  } catch {
    return res.status(503).json({ error: 'Liquidación pendiente de reintento.' });
  }
}
