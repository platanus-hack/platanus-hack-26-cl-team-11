import assert from 'node:assert/strict';
import test from 'node:test';
import { KINDS, propose } from '../web/lib/exchange-contracts.mjs';
import { starterQuote } from '../web/lib/exchange-quotes.mjs';

const now = Date.parse('2026-11-21T15:00:00Z');
const board = {
  event: '26-cl', at: now, status: 'open',
  teams: [{ team: 'a', id: 'id-a', price: 0.1 }, { team: 'b', id: 'id-b', price: 0.3 }],
};
function market(kind, terms = {}) {
  return propose({ kind, team: 'a', expiry: now + 60000, strike: 1000, width: 200, upper: 1200, rival: 'b', ...terms }, board, now);
}
function spots(a, b = 0.3) {
  return { ...board, teams: [{ ...board.teams[0], price: a }, { ...board.teams[1], price: b }] };
}

test('linear demo quote centers on the low-priced underlying', () => {
  assert.deepEqual(starterQuote(market('linear'), spots(0.03)), { bid: 1, ask: 6, reference: 3 });
  assert.deepEqual(starterQuote(market('linear'), spots(0.5)), { bid: 47, ask: 53, reference: 50 });
});

test('straddle and butterfly references reflect their opposite symmetric wings', () => {
  assert.deepEqual(starterQuote(market('butterfly'), board), { bid: 41, ask: 47, reference: 44 });
  assert.deepEqual(starterQuote(market('straddle'), board), { bid: 53, ask: 59, reference: 56 });
});

test('race prices use all 25 independent outcomes and reverse with the sides', () => {
  const forward = market('race');
  const reverse = market('race', { team: 'b', rival: 'a' });
  assert.equal(starterQuote(forward, board).reference, 50);
  const quotes = spots(0.12);
  assert.deepEqual(starterQuote(forward, quotes), { bid: 79, ask: 85, reference: 82 });
  assert.deepEqual(starterQuote(reverse, quotes), { bid: 15, ask: 21, reference: 18 });
});

test('every product keeps a valid bid and ask at extreme spots and the simulation clamps probability at one', () => {
  for (const kind of KINDS) {
    for (const spot of [0, 0.001, 0.99, 1]) {
      const quote = starterQuote(market(kind), spots(spot));
      for (const value of Object.values(quote)) assert.ok(Number.isInteger(value));
      assert.ok(quote.bid >= 1 && quote.bid < quote.ask && quote.ask <= 99, kind);
      assert.ok(quote.reference >= 0 && quote.reference <= 100, kind);
    }
  }
  assert.deepEqual(starterQuote(market('binary', { strike: 0 }), spots(1)), { bid: 97, ask: 99, reference: 100 });
  assert.deepEqual(starterQuote(market('binary', { strike: 10000 }), spots(0)), { bid: 1, ask: 3, reference: 0 });
  assert.equal(starterQuote(market('linear'), spots(1)).reference, 94);
});

test('missing or invalid official spot data cannot seed a quote', () => {
  assert.throws(() => starterQuote(market('linear'), { ...board, teams: [] }), /cotización/);
  assert.throws(() => starterQuote(market('race'), spots(0.1, NaN)), /cotización/);
  assert.throws(() => starterQuote(market('linear'), spots(1.1)), /cotización/);
  assert.throws(() => starterQuote({ ...market('linear'), teamId: 'other' }, board), /cotización/);
});
