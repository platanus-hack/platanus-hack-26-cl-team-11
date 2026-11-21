import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { parseCredential, exchangePrincipal, manageSessions } from '../web/lib/exchange-auth.mjs';
import { apply } from '../web/lib/exchange-engine.mjs';
import { initialLedger } from '../web/lib/exchange-service.mjs';
import { EVENT_END } from '../web/lib/exchange-contracts.mjs';

const now = EVENT_END - 2 * 86400000;
const httpStatus = (status) => (err) => err.status === status;
function wallet(ledger) {
  const key = randomBytes(32).toString('hex');
  const credential = parseCredential('Bearer ' + key);
  apply(ledger.engine, credential.actor, { type: 'join' }, now);
  return credential;
}
function create(ledger, owner, scope = 'read', at = now) {
  return manageSessions(ledger, owner, { action: 'create', scope }, at).result;
}

test('keeps root wallet identities stable and rejects other authorization schemes', () => {
  const known = 'a'.repeat(64);
  const wallet = parseCredential('Bearer ' + known);
  assert.equal(wallet.actor, 'player:ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb');
  assert.deepEqual(exchangePrincipal({}, null, null, now), { actor: null, channel: 'browser' });
  assert.deepEqual(exchangePrincipal({}, wallet, { type: 'list' }, now), { actor: wallet.actor, channel: 'wallet' });
  assert.throws(() => exchangePrincipal({}, null, { type: 'bet' }, now), httpStatus(401));
  for (const bad of ['Basic ' + known, 'Cookie=value', 'Bearer invalid', 'Bearer ' + known.toUpperCase(), ['Bearer ' + known]])
    assert.throws(() => parseCredential(bad), httpStatus(401));
});

test('a token is returned once; list and persistent storage omit credentials', () => {
  const ledger = initialLedger();
  const owner = wallet(ledger);
  const { token, session } = create(ledger, owner);
  const credential = parseCredential('Bearer ' + token);
  assert.match(token, /^mxs_[0-9a-f]{64}$/);
  assert(!JSON.stringify(ledger).includes(token));
  assert(Object.keys(ledger.agentSessions).includes(credential.digest));
  assert.deepEqual(manageSessions(ledger, owner, null, now).result, { sessions: [session] });
  assert.deepEqual(Object.keys(session).sort(), ['createdAt', 'expiresAt', 'id', 'scope']);
  assert.deepEqual(exchangePrincipal(ledger, credential, null, now), { actor: owner.actor, channel: 'agent' });
  for (const type of ['bet', 'order', 'cancel', 'join', 'list'])
    assert.throws(() => exchangePrincipal(ledger, credential, { type }, now), httpStatus(403));
  assert.throws(() => manageSessions(ledger, credential, null, now), httpStatus(403));
  assert.throws(() => manageSessions(ledger, credential, { action: 'create', scope: 'trade' }, now), httpStatus(403));
});

test('a trading token uses the same wallet, cannot list markets, and stops on revocation', () => {
  const ledger = initialLedger();
  const owner = wallet(ledger);
  const other = wallet(ledger);
  const { token, session } = create(ledger, owner, 'trade');
  const credential = parseCredential('Bearer ' + token);
  for (const type of ['bet', 'order', 'cancel'])
    assert.equal(exchangePrincipal(ledger, credential, { type }, now).actor, owner.actor);
  for (const type of ['list', 'join', 'unknown'])
    assert.throws(() => exchangePrincipal(ledger, credential, { type }, now), httpStatus(403));
  const revoke = { action: 'revoke', id: session.id };
  assert.throws(() => manageSessions(ledger, credential, revoke, now), httpStatus(403));
  assert.deepEqual(manageSessions(ledger, other, null, now).result.sessions, []);
  assert.equal(manageSessions(ledger, other, revoke, now).changed, false);
  assert.equal(manageSessions(ledger, owner, revoke, now).changed, true);
  assert.equal(manageSessions(ledger, owner, revoke, now).changed, false);
  assert.throws(() => exchangePrincipal(ledger, credential, null, now), httpStatus(401));
});

test('TTL and event close bound validity; only active, registered wallets may create sessions', () => {
  const ledger = initialLedger();
  const owner = wallet(ledger);
  const unknown = parseCredential('Bearer ' + randomBytes(32).toString('hex'));
  assert.throws(() => create(ledger, unknown), httpStatus(403));
  assert.throws(() => create(ledger, null), httpStatus(401));
  assert.throws(() => create(ledger, owner, 'admin'), httpStatus(400));
  const previous = process.env.EXCHANGE_AGENT_SESSION_TTL_SECONDS;
  try {
    process.env.EXCHANGE_AGENT_SESSION_TTL_SECONDS = '10';
    const { token, session } = create(ledger, owner);
    assert.equal(session.expiresAt, now + 10000);
    assert.throws(() => exchangePrincipal(ledger, parseCredential('Bearer ' + token), null, session.expiresAt), httpStatus(401));
    assert.deepEqual(manageSessions(ledger, owner, null, session.expiresAt).result.sessions, []);
    process.env.EXCHANGE_AGENT_SESSION_TTL_SECONDS = '172800';
    assert.equal(create(ledger, owner).session.expiresAt, now + 86400000);
    assert.equal(create(ledger, owner, 'trade', EVENT_END - 1).session.expiresAt, EVENT_END);
    assert.throws(() => create(ledger, owner, 'trade', EVENT_END), httpStatus(409));
  } finally {
    if (previous === undefined) delete process.env.EXCHANGE_AGENT_SESSION_TTL_SECONDS;
    else process.env.EXCHANGE_AGENT_SESSION_TTL_SECONDS = previous;
  }
});
