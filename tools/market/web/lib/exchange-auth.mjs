import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { EVENT_END } from './exchange-contracts.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const problem = (message, status) => Object.assign(new Error(message), { status });
const maxSessions = 12;
const tradeActions = new Set(['bet', 'order', 'cancel']);

export function parseCredential(header) {
  if (header === undefined) return null;
  const token = typeof header === 'string' && header.slice(0, 7).toLowerCase() === 'bearer ' ? header.slice(7) : '';
  if (/^[0-9a-f]{64}$/.test(token)) return { kind: 'wallet', actor: 'player:' + digest(token) };
  if (/^mxs_[0-9a-f]{64}$/.test(token)) return { kind: 'agent', digest: digest(token) };
  throw problem('Credencial de la bolsa inválida.', 401);
}

export function exchangePrincipal(ledger, credential, action, now) {
  if (!credential) {
    if (action) throw problem('Se necesita una billetera.', 401);
    return { actor: null, channel: 'browser' };
  }
  if (credential.kind === 'wallet') return { actor: credential.actor, channel: 'wallet' };
  const session = ledger.agentSessions?.[credential.digest];
  if (!session || session.expiresAt <= now || now >= EVENT_END)
    throw problem('El acceso del agente es inválido o venció.', 401);
  if (action && (session.scope !== 'trade' || !tradeActions.has(action.type)))
    throw problem('Este acceso de agente no permite esa acción.', 403);
  return { actor: session.owner, channel: 'agent' };
}

function publicSession({ id, scope, createdAt, expiresAt }) {
  return { id, scope, createdAt, expiresAt };
}

function expiry(now) {
  const setting = Number(process.env.EXCHANGE_AGENT_SESSION_TTL_SECONDS);
  const seconds = Number.isSafeInteger(setting) && setting > 0 ? Math.min(setting, 86400) : 14400;
  return Math.min(EVENT_END, now + seconds * 1000);
}

export function manageSessions(ledger, credential, action, now) {
  if (!credential) throw problem('Se necesita la billetera propietaria.', 401);
  if (credential.kind !== 'wallet') throw problem('Solo la billetera propietaria administra accesos.', 403);
  const owner = credential.actor;
  if (!Object.hasOwn(ledger.engine.wallets, '$' + owner))
    throw problem('Primero abre tu billetera de la bolsa.', 403);

  const entries = Object.entries(ledger.agentSessions ?? {});
  const active = entries.filter(([, session]) => session.owner === owner && session.expiresAt > now);
  if (action === null) {
    const sessions = active.map(([, session]) => publicSession(session)).sort((a, b) => b.createdAt - a.createdAt);
    return { changed: false, result: { sessions } };
  }
  if (action?.action === 'revoke') {
    if (typeof action.id !== 'string' || !/^[0-9a-f-]{36}$/.test(action.id))
      throw problem('Identificador de acceso inválido.', 400);
    const owned = entries.find(([, session]) => session.owner === owner && session.id === action.id);
    if (owned) delete ledger.agentSessions[owned[0]];
    return { changed: Boolean(owned), result: { revoked: true } };
  }
  if (action?.action !== 'create' || !['read', 'trade'].includes(action.scope))
    throw problem('Selecciona un permiso válido.', 400);
  if (now >= EVENT_END) throw problem('La bolsa ya cerró.', 409);
  if (active.length >= maxSessions) throw problem('Revoca un acceso para crear otro.', 409);

  ledger.agentSessions ??= {};
  for (const [hash, session] of entries) {
    if (session.expiresAt <= now) delete ledger.agentSessions[hash];
  }
  const token = 'mxs_' + randomBytes(32).toString('hex');
  const session = { id: randomUUID(), scope: action.scope, createdAt: now, expiresAt: expiry(now) };
  ledger.agentSessions[digest(token)] = { ...session, owner };
  return { changed: true, result: { session, token } };
}
