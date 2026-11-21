import { initialLedger, createManual, resolveManual, refundExpiredQuestions } from '../lib/exchange-service.mjs';
import { view } from '../lib/exchange-engine.mjs';
import { isOwner } from '../lib/exchange-owner.mjs';
import { attendance } from '../lib/exchange-stats.mjs';
import { transact } from '../lib/exchange-store.mjs';

export default async function owner(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Authorization');
  if (!isOwner(req.headers.authorization, process.env.EXCHANGE_OWNER_KEY_SHA256))
    return res.status(401).json({ error: 'Ingresa la clave de organizador.' });
  if (!['GET','POST'].includes(req.method))
    return res.status(405).setHeader('Allow','GET, POST').end();
  const change = req.method === 'POST';
  if (change && (!['create','resolve'].includes(req.body?.action) || JSON.stringify(req.body).length > 5000))
    return res.status(400).json({ error: 'Acción o contenido inválido.' });
  try {
    const result = await transact(initialLedger, ledger => {
      const now = Date.now();
      let receipt = null;
      if (change) {
        receipt = req.body.action === 'create'
          ? createManual(ledger, req.body.spec, now)
          : resolveManual(ledger, req.body.decision, now);
      }
      const refunded = refundExpiredQuestions(ledger, now);
      const questions = view(ledger.engine, null, null, now).markets.filter(m => m.kind === 'manual');
      return { changed:change || refunded > 0, result:{ stats:attendance(ledger,now), questions, receipt } };
    });
    return res.json(result);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 503;
    return res.status(status).json({ error: status < 500 ? error.message : 'El panel está reconectando. Reintenta.' });
  }
}
