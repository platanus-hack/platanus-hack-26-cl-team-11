import test from 'node:test';
import assert from 'node:assert/strict';
import { initialLedger, operate, requestPrices } from '../web/lib/exchange-service.mjs';

function fixture(t) {
  let clock = Date.parse('2026-11-21T16:10:00Z');
  const start = clock;
  t.mock.method(Date, 'now', () => clock);
  const ledger = initialLedger();
  const teams = Array.from({ length: 10 }, (_, i) => ({
    id: 'id-' + i,
    team: 'team-' + i,
    price: (12 - i) / 100,
  }));
  const board = () => Promise.resolve({ at: clock, event: '26-cl', status: 'open', teams });
  const prices = (history = async () => []) => requestPrices(board, history);
  const request = (actor, action, selected, source = prices()) =>
    operate(ledger, { actor, action, selected }, source).then((x) => x.result);
  return {
    ledger,
    teams,
    request,
    prices,
    start,
    advance: (ms) => {
      clock = start + ms;
    },
  };
}

test('a new desk quotes all nine kinds, preserves filled quantity on migration, and leaves participant orders intact', async (t) => {
  const f = fixture(t);
  let state = await f.request(null, null);
  assert.equal(state.markets.length, 9);
  assert(state.markets.every((m) => m.bestBid >= 1 && m.bestBid < m.bestAsk && m.bestAsk <= 99 && m.starterQuote));
  const m = state.markets.find((m) => m.kind === 'linear');
  assert(m.bestAsk < 20);
  await f.request('one', { type: 'join' });
  const take = { type: 'order', marketId: m.id, side: 'buy', qty: 1, price: m.bestAsk, nonce: 'take' };
  await f.request('one', take, m.id);
  await f.request('one', { type: 'order', marketId: m.id, side: 'buy', qty: 1, price: 1, nonce: 'leave' }, m.id);
  delete f.ledger.deskQuotes[m.id]; // simulate open quotes inherited from the earlier release
  state = await f.request('one', null, m.id);
  assert.equal(state.book.asks[0].qty, 2);
  assert.equal(state.wallet.orders[0].price, 1);
  assert.equal(state.fills.length, 1);
  const closedSource = requestPrices(
    async () => {
      throw Error('offline');
    },
    async () => [],
  );
  const repeated = await f.request('one', take, m.id, closedSource);
  assert.equal(repeated.view.fills.length, 1);
  const check = await f.request(null, null, m.id);
  assert.deepEqual(check.book, state.book);
});

test('missing oracle data retains collateral, then refunds each side once the grace period has elapsed', async (t) => {
  const f = fixture(t);
  await f.request('buyer', { type: 'join' });
  await f.request('seller', { type: 'join' });
  const spec = { kind: 'binary', team: 'team-1', expiry: f.start + 60000, strike: 900 };
  const listing = await f.request('buyer', { type: 'list', spec, nonce: 'list' });
  const id = listing.result.marketId;
  await f.request('seller', { type: 'order', marketId: id, side: 'sell', qty: 1, price: 37, nonce: 'post' }, id);
  await f.request('buyer', { type: 'order', marketId: id, side: 'buy', qty: 1, price: 40, nonce: 'take' }, id);
  f.advance(61000);
  assert.equal((await f.request('buyer', null, id)).market.status, 'pending');
  f.advance(3600000 + 61000);
  const before = await f.request('buyer', null, id);
  assert.equal(before.market.status, 'voided');
  assert.equal(before.wallet.available, 1000);
  const after = await f.request('seller', null, id);
  assert.equal(after.wallet.available, 1000);
  assert.equal(after.wallet.settlements.length, 1);
});
