import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, initialState, view } from '../web/lib/exchange-engine.mjs';
import { createManual, initialLedger, operate, requestPrices, resolveManual } from '../web/lib/exchange-service.mjs';
import { DECISION_WINDOW } from '../web/lib/exchange-predictions.mjs';
import { EVENT_END } from '../web/lib/exchange-contracts.mjs';

const start = Date.parse('2026-11-21T16:10:00Z');
const expiry = start + 60000;
const spec = { question: '¿El equipo mostrará la demo?', rule: 'Se decide al cierre.\nCuenta la demo en vivo.', expiry };
const bet = (marketId, outcome, qty, maxPrice, nonce = 'bet') => ({ type: 'bet', marketId, outcome, qty, maxPrice, nonce });
const offline = requestPrices(async () => { throw Error('offline'); }, async () => { throw Error('offline'); });
function fixture() {
  const state = initialState();
  const act = (actor, action) => apply(state, actor, action, start);
  for (const player of ['alice', 'bob', 'carol']) act(player, { type: 'join' });
  for (const kind of ['binary', 'range', 'call', 'race'])
    act('alice', { type: 'list', market: { id: kind, kind, expiry } });
  const order = (actor, marketId, side, qty, price, nonce) => act(actor, { type: 'order', marketId, side, price, qty, nonce });
  return { state, act, order };
}

for (const outcome of ['yes', 'no']) {
  test(outcome + ' pays actual maker prices across levels, with just enough cash for fills', () => {
    const { state, act, order } = fixture();
    order('alice', 'range', 'buy', 10, 91, 'lock');  // leaves 90 free
    const yes = outcome === 'yes';
    order('bob', 'binary', yes ? 'sell' : 'buy', 1, yes ? 32 : 68, 'b');
    order('carol', 'binary', yes ? 'sell' : 'buy', 2, yes ? 28 : 72, 'c');
    const action = bet('binary', outcome, 3, 99);
    const result = act('alice', action);
    assert.equal(result.cost, 88);
    assert.equal(result.maxPayout, 300);
    assert.equal(result.remaining, 0);
    const data = view(state, 'alice', 'binary', start);
    assert.equal(data.wallet.available, 2);
    assert.equal(data.wallet.orders.length, 1);
    assert.deepEqual(data.wallet.positions.map(p => [p.side, p.qty, p.collateral]), [[yes ? 'long' : 'short', 3, 88]]);
    assert.deepEqual(data.fills.map(f => f.qty), [1, 2]);
    const before = structuredClone(state);
    assert.deepEqual(apply(state, 'alice', action, expiry + 1), result);
    assert.deepEqual(state, before);
    assert.throws(() => act('alice', { ...action, maxPrice: 98 }), { code: 'nonce_conflict' });
    assert.throws(() => order('alice', 'binary', 'buy', 1, 12, action.nonce), { code: 'nonce_conflict' });
  });
}

test('a bet skips own offers, never rests or partly fills, and rejects unsupported terms without touching trades', () => {
  const { state, act, order } = fixture();
  order('alice', 'binary', 'sell', 2, 25, 'self');
  order('bob', 'binary', 'sell', 3, 31, 'other');
  const before = structuredClone(state);
  const failures = [
    [bet('binary', 'yes', 4, 99), 'insufficient_depth'], [bet('binary', 'yes', 1, 30), 'insufficient_depth'],
    [bet('binary', 'yes', 0, 25), 'invalid_qty'], [bet('binary', 'maybe', 1, 31), 'invalid_outcome'],
    [bet('binary', 'yes', 1, 100), 'invalid_price'], [bet('binary', 'no', 1, 0), 'invalid_price'],
    [bet('race', 'yes', 1, 30), 'not_binary'], [bet('call', 'no', 1, 31), 'not_binary'],
    [{ ...bet('binary', 'yes', 1, 31), nonce: undefined }, 'invalid_nonce'],
  ];
  for (const [action, code] of failures) {
    assert.throws(() => act('alice', action), { code });
    assert.deepEqual(state, before);
  }
  assert.equal(act('alice', bet('binary', 'yes', 2, 31)).cost, 62);
  assert.deepEqual(view(state, 'alice', 'binary', start).book.asks, [{ price: 25, qty: 2 }, { price: 31, qty: 1 }]);
  assert(state.fills.every(f => f.buyer !== f.seller));
  order('carol', 'binary', 'buy', 1, 20, 'buy');
  const after = structuredClone(state);
  assert.throws(() => act('alice', bet('binary', 'no', 1, 81, 'closing')), { code: 'opposite_position' });
  assert.deepEqual(state, after);
  order('alice', 'binary', 'sell', 2, 90, 'pledge');
  assert.throws(() => act('alice', bet('binary', 'no', 1, 81, 'closing-pledged')), { code: 'opposite_position' });
});

test('a cash shortfall at actual matched prices aborts the whole bet', () => {
  const { state, act, order } = fixture();
  order('alice', 'range', 'buy', 10, 96, 'lock');
  order('bob', 'binary', 'sell', 1, 20, 'small');
  order('carol', 'binary', 'sell', 1, 21, 'large');
  const before = structuredClone(state);
  assert.throws(() => act('alice', bet('binary', 'yes', 2, 90)), { code: 'insufficient_funds' });
  assert.deepEqual(state, before);
});

test('owner publication is idempotent, shares finite collateral, and can publish when that wallet runs out', () => {
  const ledger = initialLedger();
  const creation = createManual(ledger, spec, start);
  const before = structuredClone(ledger);
  assert.deepEqual(createManual(ledger, { ...spec, question: '  ' + spec.question, rule: spec.rule.replace('\n', '\r\n') }, expiry), creation);
  assert.deepEqual(ledger, before);
  assert.equal(creation.seededQty, 2);
  for (let i = 1; i <= 5; i++) {
    const result = createManual(ledger, { ...spec, question: '¿Pregunta ' + i + '?' }, start);
    if (i === 5) {
      assert.equal(result.seededQty, 0);
      assert.deepEqual(view(ledger.engine, null, result.marketId, start).book, { bids: [], asks: [] });
    }
  }
  assert.equal(Object.keys(ledger.engine.wallets).length, 1);
  const { wallet } = view(ledger.engine, 'desk:manual', creation.marketId, start);
  assert.equal(wallet.available + wallet.locked, 1000);
  assert.equal(wallet.locked, 980);
  for (const bad of [{ question: ' ' }, { rule: '' }, { question: 'x'.repeat(181) }, { rule: 'a\x00b' },
    { expiry: EVENT_END + 1 }, { expiry: start }, { expiry: 'tomorrow' }])
    assert.throws(() => createManual(ledger, { ...spec, ...bad }, start), { status: 400 });
});

function manualFixture(t) {
  let now = start;
  t.mock.method(Date, 'now', () => now);
  const ledger = initialLedger();
  const { marketId } = createManual(ledger, spec, now);
  const request = async (actor, action) => (await operate(ledger, { actor, action, selected: marketId }, offline)).result;
  return { ledger, marketId, request, advance: at => { now = at; } };
}

for (const outcome of ['yes', 'no', 'void']) {
  test('manual ' + outcome + ' pays both sides correctly once and retains public decision evidence', async t => {
    const { ledger, marketId, request, advance } = manualFixture(t);
    const action = bet(marketId, 'yes', 1, 55);
    for (const player of ['yes-player', 'no-player']) await request(player, { type: 'join' });
    const { result } = await request('yes-player', action);
    assert.equal(result.cost, 51);
    assert.equal((await request('no-player', bet(marketId, 'no', 1, 51))).result.cost, 51);
    const decision = { marketId, outcome, reason: 'Registro público.\nSegunda línea.' };
    assert.throws(() => resolveManual(ledger, decision, expiry - 1), { status: 409 });
    advance(expiry + 3600000);
    assert.equal((await request(null, null)).market.status, 'pending');
    assert.deepEqual(ledger.missingSince, {});
    assert.deepEqual(ledger.nextOracle, {});
    const resolved = resolveManual(ledger, decision, Date.now());
    const before = structuredClone(ledger);
    assert.deepEqual(resolveManual(ledger, decision, Date.now() + 1), resolved);
    assert.throws(() => resolveManual(ledger, { ...decision, reason: 'Nueva razón' }, Date.now()), { status: 409 });
    assert.deepEqual(ledger, before);
    const final = await request('yes-player', null);
    assert.equal(final.market.resolver, 'Mati');
    assert.equal(final.market.status, outcome === 'void' ? 'voided' : 'settled');
    assert.equal(final.market.evidence.outcome, outcome);
    assert.equal(final.market.evidence.reason, decision.reason);
    assert.equal(final.market.evidence.at, Date.now());
    assert.equal(final.wallet.available, outcome === 'void' ? 1000 : outcome === 'yes' ? 1049 : 949);
    assert.equal((await request('no-player', null)).wallet.available, outcome === 'void' ? 1000 : outcome === 'no' ? 1049 : 949);
    assert.deepEqual((await request('yes-player', action)).result, result);
  });
}

test('the decision deadline refunds each original contribution, including when the owner is the first late caller', async t => {
  const { ledger, marketId, request, advance } = manualFixture(t);
  await request('player', { type: 'join' });
  await request('player', bet(marketId, 'no', 2, 51));
  advance(expiry + DECISION_WINDOW - 1);
  assert.equal((await request('player', null)).wallet.available, 898);
  advance(expiry + DECISION_WINDOW);
  const late = structuredClone(ledger);
  assert.equal(resolveManual(late, { marketId, outcome: 'yes', reason: 'Decisión tardía.' }, Date.now()).automatic, true);
  const final = await request('player', null);
  assert.equal(final.wallet.available, 1000);
  assert.equal(final.wallet.settlements.length, 1);
  assert.equal(final.market.evidence.automatic, true);
  assert.equal(final.market.status, 'voided');
  assert.equal(final.market.evidence.outcome, 'void');
  assert.throws(() => resolveManual(ledger, { marketId, outcome: 'no', reason: 'Ya pasó el plazo.' }, Date.now()), { status: 409 });
  assert.deepEqual(late.engine, ledger.engine);
});

test('a live legacy strip gains funded questions across teams while old wallets, orders and automatic contracts keep their terms', async t => {
  t.mock.method(Date, 'now', () => start);
  const ledger = initialLedger();
  const teams = Array.from({ length: 6 }, (_, i) => ({ id: 't' + i, team: 'team-' + i, name: 'Proyecto ' + i, price: (10 - i) / 100 }));
  const prices = requestPrices(async () => ({ event: '26-cl', status: 'open', at: start, teams }), async () => []);
  const req = (actor, action, source = prices) => operate(ledger, { actor, action }, source).then(x => x.result);
  ledger.predictionStrip = Date.parse('2026-11-21T17:00:00Z');
  await req('player', { type: 'join' });
  const legacy = structuredClone(ledger.engine);
  const [old] = Object.values(legacy.markets);
  assert.throws(() => resolveManual(ledger, { marketId: old.terms.id, outcome: 'yes', reason: 'x' }, expiry));
  delete ledger.predictionStrip;
  const refreshed = await req(null, null);
  for (const field of ['markets', 'orders', 'wallets'])
    for (const [id, record] of Object.entries(legacy[field])) assert.deepEqual(ledger.engine[field][id], record);
  const questions = refreshed.markets.filter(m => m.kind === 'binary');
  assert.equal(questions.length, 5);
  assert(questions.every(m => m.bestBid > 0 && m.bestAsk < 100 && m.question.includes('Proyecto')));
  const m = questions[1];
  const action = bet(m.id, 'no', 1, 100 - m.bestBid);
  const accepted = await req('player', action);
  assert.deepEqual((await req('player', action, offline)).result, accepted.result);
  await assert.rejects(req('player', { ...action, nonce: 'new' }, offline));
  await assert.rejects(req('player', { type: 'list', spec: { kind: 'manual', ...spec }, nonce: 'not-owner' }), { status: 400 });
});
