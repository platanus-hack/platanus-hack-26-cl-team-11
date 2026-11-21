import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { register } from 'node:module';
import test from 'node:test';

// Runs in its own Node test worker. The handlers use the real transaction, auth and matching logic.
register('./fixtures/memory-blob.mjs', import.meta.url);
const { default: owner } = await import('../web/api/owner.mjs');
const { default: exchange } = await import('../web/api/exchange.mjs');

test('owner HTTP auth, publication, wallet bet, final decision, and durable GET-triggered refund', async t => {
  const organizer = 'org_' + randomBytes(32).toString('base64url');
  const wallet = randomBytes(32).toString('hex');
  process.env.EXCHANGE_OWNER_KEY_SHA256 = createHash('sha256').update(organizer).digest('hex');
  t.after(() => { delete process.env.EXCHANGE_OWNER_KEY_SHA256; });
  let now = Date.parse('2026-11-21T16:10:00Z');
  t.mock.method(Date, 'now', () => now);
  const send = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async () => { throw Error('Offline price feed in test'); });
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length) req.body = JSON.parse(Buffer.concat(chunks).toString());
    req.query = Object.fromEntries(url.searchParams);
    res.status = code => { res.statusCode = code; return res; };
    res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
    if (url.pathname === '/api/owner') await owner(req, res);
    else if (url.pathname === '/api/exchange') await exchange(req, res);
    else res.status(404).end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  async function request(path, token, body, expected = 200, method = body ? 'POST' : 'GET') {
    const response = await send(origin + path, { method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal(response.status, expected, method + ' ' + path);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    return response.headers.get('Content-Type')?.includes('application/json') ? response.json() : null;
  }
  const panel = (body, expected) => request('/api/owner', organizer, body, expected);
  const expiry = now + 60000;
  const create = question => ({ action: 'create', spec: { question, rule: 'Regla de prueba local.', expiry } });
  const decision = (id, outcome, reason = 'Evidencia local de prueba.') =>
    ({ action: 'resolve', decision: { marketId: id, outcome, reason } });

  await request('/api/owner', null, undefined, 401);
  await request('/api/owner', 'org_' + randomBytes(32).toString('base64url'), undefined, 401);
  await request('/api/owner', wallet, create('¿Publicada sin permiso?'), 401);
  await request('/api/owner', organizer, undefined, 405, 'DELETE');
  assert.deepEqual((await panel()).questions, []);
  const question = create('¿Primera pregunta de prueba?');
  const created = (await panel(question)).receipt;
  assert.equal(created.seededQty, 2);
  assert.deepEqual((await panel(question)).receipt, created);
  const second = (await panel(create('¿Segunda pregunta de prueba?'))).receipt.marketId;

  await request('/api/exchange', wallet, { type: 'join' });
  await request('/api/exchange', wallet, { type: 'resolve', ...decision(created.marketId, 'no') }, 400);
  const buy = (id, outcome, qty) => request('/api/exchange', wallet,
    { type: 'bet', marketId: id, outcome, qty, maxPrice: 51, nonce: id });
  const twins = await Promise.all([buy(created.marketId, 'yes', 1), buy(created.marketId, 'yes', 1)]);
  assert.equal(twins[0].result.cost, 51);
  assert.deepEqual(twins[0].result, twins[1].result);
  assert.equal(twins[1].view.market.volume, 1);
  assert.equal((await buy(second, 'no', 2)).result.cost, 102);
  await panel(decision(created.marketId, 'yes'), 409);
  now = expiry;
  const resolve = decision(created.marketId, 'yes');
  const completed = await panel(resolve);
  assert.equal(completed.receipt.payout, 100);
  assert.equal(completed.questions.find(q => q.id === created.marketId).evidence.reason, resolve.decision.reason);
  assert.deepEqual((await panel(resolve)).receipt, completed.receipt);
  await panel(decision(created.marketId, 'no'), 409);
  await panel(decision(created.marketId, 'yes', 'Cambio de motivo.'), 409);
  let snapshot = await request('/api/exchange?marketId=' + second, wallet);
  assert.equal(snapshot.market.status, 'pending');
  assert.equal(snapshot.wallet.available, 947);
  assert.equal(snapshot.wallet.settlements.length, 1);

  // Only the owner GET touches the store as the 24-hour grace period expires.
  now += 24 * 3600000;
  const afterDeadline = (await panel()).questions.find(q => q.id === second);
  assert.equal(afterDeadline.status, 'voided');
  assert.equal(afterDeadline.evidence.automatic, true);
  now++;
  assert.deepEqual((await panel()).questions.find(q => q.id === second), afterDeadline);
  await panel(decision(second, 'yes'), 409);
  snapshot = await request('/api/exchange?marketId=' + second, wallet);
  assert.equal(snapshot.wallet.settlements.length, 2);
  assert.equal(snapshot.wallet.available, 1049);
});
