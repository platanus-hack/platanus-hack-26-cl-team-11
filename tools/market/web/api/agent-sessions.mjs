import { parseCredential, manageSessions } from '../lib/exchange-auth.mjs';
import { initialLedger } from '../lib/exchange-service.mjs';
import { transact } from '../lib/exchange-store.mjs';

export default async function agentSessions(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }
  try {
    const credential = parseCredential(req.headers.authorization);
    if (!credential) return res.status(401).json({ error: 'Se necesita la billetera propietaria.' });
    if (credential.kind !== 'wallet') return res.status(403).json({ error: 'Solo la billetera propietaria administra accesos.' });
    const action = req.method === 'POST' ? req.body : null;
    if (req.method === 'POST' && (!action || typeof action !== 'object' || Array.isArray(action)))
      return res.status(400).json({ error: 'Acción inválida.' });
    if (action && JSON.stringify(action).length > 1024)
      return res.status(413).json({ error: 'Solicitud demasiado grande.' });
    const result = await transact(initialLedger, (ledger) => manageSessions(ledger, credential, action, Date.now()));
    return res.status(action?.action === 'create' ? 201 : 200).json(result);
  } catch (err) {
    const expected = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599;
    return res.status(expected ? err.status : 503).json({
      error: expected ? err.message : 'No se pudieron consultar los accesos. Inténtalo de nuevo.',
    });
  }
}
