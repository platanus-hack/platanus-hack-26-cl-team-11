import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, apply, replay, view, settle, expireOrders } from '../web/lib/exchange-engine.mjs';

const T = 1000;
const END = 10000;
const terms = { id: 'px-abc123', kind: 'call', team: 'ronda', strike: 140, expiry: END, title: 'Call Ronda' };
const evidence = { source: 'local-fixture', at: END };

function setup(actors = ['a', 'b', 'c']) {
  const state = initialState();
  apply(state, 'admin', { type: 'list', market: terms }, T);
  for (const a of actors) apply(state, a, { type: 'join' }, T);
  return state;
}

function order(s, actor, side, price, qty, nonce, marketId = terms.id) {
  return apply(s, actor, { type: 'order', marketId, side, price, qty, nonce }, T);
}

const wallet = (s, actor, at = T) => view(s, actor, null, at).wallet;
const fails = (code) => (error) => error.code === code;
const cancel = (s, actor, orderId, nonce) => apply(s, actor, { type: 'cancel', orderId, nonce }, T);

test('grants once per actor, safely handles JSON round trips and prototype names', () => {
  const s = setup(['__proto__', 'constructor']);
  apply(s, '__proto__', { type: 'join' }, T);
  apply(s, 'admin', { type: 'list', market: { ...terms, id: '__proto__' } }, T);
  order(s, 'constructor', 'buy', 44, 2, '__proto__', '__proto__');
  order(s, '__proto__', 'sell', 44, 1, '__proto__', '__proto__');
  assert.equal(wallet(s, '__proto__').available, 944);
  assert.equal(wallet(s, 'constructor').locked, 44);
  assert.deepEqual(view(JSON.parse(JSON.stringify(s)), 'constructor', '__proto__', T), view(s, 'constructor', '__proto__', T));
  assert.equal(view(s, 'unregistered', null, T).wallet, null);
});

test('idempotency on join, list, order and cancel, keyed by actor and full action', () => {
  const s = setup();
  const req = { type: 'order', marketId: terms.id, side: 'buy', price: 50, qty: 3, nonce: 'a-id' };
  const first = apply(s, 'a', req, T);
  assert.deepEqual(apply(s, 'a', { nonce: 'a-id', qty: 3, price: 50, side: 'buy', marketId: terms.id, type: 'order' }, T), first);
  assert.equal(wallet(s, 'a').locked, 150);
  assert.throws(() => apply(s, 'a', { ...req, qty: 2 }, T), fails('nonce_conflict'));
  assert.throws(() => cancel(s, 'a', first.orderId, 'a-id'), fails('nonce_conflict'));
  assert.doesNotThrow(() => apply(s, 'b', req, T));
  const canceled = cancel(s, 'a', first.orderId, 'a-cancel');
  assert.equal(canceled.canceled, 3);
  assert.deepEqual(cancel(s, 'a', first.orderId, 'a-cancel'), canceled);
  assert.equal(wallet(s, 'a').available, 1000);
  assert.throws(() => cancel(s, 'a', first.orderId, 'a-cancel2'), fails('order_not_found'));
  assert.deepEqual(apply(s, 'a', req, END), first);
  apply(s, 'admin', { type: 'list', market: terms }, T);
  assert.throws(() => apply(s, 'admin', { type: 'list', market: { ...terms, strike: 150 } }, T), fails('market_conflict'));
  assert.equal(view(s, null, null, T).markets.length, 1);
});

test('receipt-only replay is pure, distinguishes actors, and works after expiry without an oracle', () => {
  const s = setup();
  const action = { type: 'order', marketId: terms.id, side: 'buy', price: 33, qty: 2, nonce: 'retry' };
  assert.equal(replay(s, 'a', action), null);
  const receipt = apply(s, 'a', action, T);
  const snapshot = structuredClone(s);
  const replayed = replay(s, 'a', action);
  assert.deepEqual(replayed, receipt);
  replayed.remaining = 999;
  assert.equal(replay(s, 'a', action).remaining, 2);
  assert.equal(replay(s, 'b', action), null);
  assert.throws(() => replay(s, 'a', { ...action, price: 45 }), fails('nonce_conflict'));
  assert.deepEqual(s, snapshot);
  expireOrders(s, END);
  assert.deepEqual(replay(s, 'a', action), receipt);
});

test('crossing matches best price then FIFO, partial fills, price improvement, and private tape', () => {
  const s = setup(['a', 'b', 'c', 'd']);
  order(s, 'a', 'sell', 40, 2, '1');
  const second = order(s, 'b', 'sell', 40, 5, '2');
  order(s, 'c', 'sell', 35, 1, '3');
  assert.deepEqual(view(s, null, terms.id, T).book.asks, [{ price: 35, qty: 1 }, { price: 40, qty: 7 }]);
  const crossed = order(s, 'd', 'buy', 60, 5, '4');
  assert.deepEqual([crossed.filled, crossed.remaining], [5, 0]);
  const snapshot = view(s, 'd', terms.id, T);
  assert.deepEqual(snapshot.book.asks, [{ price: 40, qty: 3 }]);
  assert.deepEqual(snapshot.fills.map(f => [f.price, f.qty]), [[40, 2], [40, 2], [35, 1]]);
  assert.equal(snapshot.market.volume, 5);
  assert.equal(snapshot.market.lastPrice, 40);
  assert.equal(snapshot.wallet.available, 805);
  assert.deepEqual(snapshot.wallet.positions, [{ marketId: terms.id, side: 'long', qty: 5, collateral: 195, pledged: 0, mark: 40, value: 200, unrealizedPnl: 5 }]);
  assert.equal(wallet(s, 'a').orders.length, 0);
  assert.equal(wallet(s, 'b').locked, 180);
  assert.equal(wallet(s, 'b').fills[0].side, 'sell');
  assert.equal(wallet(s, 'c').fills.length, 1);
  assert.throws(() => cancel(s, 'd', second.orderId, '5'), fails('order_not_found'));
  assert.equal(cancel(s, 'b', second.orderId, '6').canceled, 3);
  assert.equal(wallet(s, 'b').available, 880);
  assert.ok(snapshot.fills.every(f => !('buyer' in f) && !('seller' in f)));
  const resting = order(s, 'd', 'sell', 80, 4, '7');
  order(s, 'a', 'buy', 90, 2, '8');
  assert.equal(wallet(s, 'd').orders[0].id, resting.orderId);
  assert.equal(wallet(s, 'd').orders[0].remaining, 2);
});

test('mark uses two-sided midpoint, then last fill, then the average entry for each side', () => {
  const s = setup(['a', 'b', 'c', 'd']);
  order(s, 'a', 'buy', 40, 3, 'a40');
  order(s, 'b', 'sell', 40, 3, 'b40');
  order(s, 'a', 'buy', 50, 1, 'a50');
  order(s, 'b', 'sell', 50, 1, 'b50');
  const ask = order(s, 'a', 'sell', 75, 2, 'ask');
  const bid = order(s, 'c', 'buy', 54, 1, 'bid');
  const [long, short] = ['a', 'b'].map(actor => wallet(s, actor));
  assert.deepEqual(long.positions[0], { marketId: terms.id, side: 'long', qty: 4, pledged: 2,
    collateral: 170, mark: 64.5, value: 258, unrealizedPnl: 88 });
  assert.deepEqual(short.positions[0], { marketId: terms.id, side: 'short', qty: 4, pledged: 0,
    collateral: 230, mark: 35.5, value: 142, unrealizedPnl: -88 });
  assert.equal(long.markedEquity, 1088);
  assert.equal(short.markedPnl, -88);
  assert.equal(wallet(s, 'c').markedPnl, 0); // Unfilled cash reserve is included exactly once.
  cancel(s, 'c', bid.orderId, 'cancel-bid');
  assert.equal(wallet(s, 'a').positions[0].mark, 50);
  assert.equal(wallet(s, 'a').markedPnl, 30);
  cancel(s, 'a', ask.orderId, 'cancel-ask');
  delete Object.values(s.markets)[0].lastPrice; // Old snapshot missing a trade price.
  assert.deepEqual(['a', 'b'].map(a => wallet(s, a).positions[0].mark), [42.5, 57.5]);
  assert.deepEqual(['a', 'b'].map(a => wallet(s, a).markedPnl), [0, 0]);
  settle(s, terms.id, 65, evidence, END);
  assert.deepEqual(['a', 'b'].map(a => wallet(s, a, END).markedEquity), [1090, 910]);
  assert.deepEqual(['a', 'b'].map(a => wallet(s, a, END).markedPnl), [90, -90]);
});

test('sell crossing a higher resting bid receives price improvement and escrow stays exact', () => {
  const s = setup();
  order(s, 'a', 'buy', 80, 2, '1');
  order(s, 'b', 'sell', 60, 4, '2');
  assert.equal(wallet(s, 'b').available, 880);
  assert.equal(wallet(s, 'b').locked, 80);
  assert.equal(wallet(s, 'b').collateral, 40);
  assert.equal(wallet(s, 'a').collateral, 160);
  const active = wallet(s, 'b').orders[0];
  cancel(s, 'b', active.id, '3');
  assert.equal(wallet(s, 'b').available, 960);
});

test('self-match prevention is atomic, including a better-priced partial match preceding own quote', () => {
  const s = setup();
  order(s, 'a', 'sell', 10, 1, '1');
  order(s, 'b', 'sell', 20, 1, '2');
  const before = structuredClone(s);
  assert.throws(() => order(s, 'b', 'buy', 30, 2, '3'), fails('self_match'));
  assert.deepEqual(s, before);
  assert.equal(order(s, 'b', 'buy', 30, 1, '4').filled, 1);
});

test('limits require safe integers, valid symbols, sufficient collateral and bounded open orders', () => {
  const s = setup();
  for (const n of [NaN, Infinity, -1, 0.1, 101, '1', null]) {
    assert.throws(() => order(s, 'a', 'buy', n, 1, '1'), fails('invalid_price'));
  }
  for (const n of [NaN, Infinity, -1, 0, 0.1, 1001, '3', Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => order(s, 'a', 'buy', 1, n, '1'), fails('invalid_qty'));
  }
  assert.throws(() => order(s, 'a', 'long', 20, 2, '1'), fails('invalid_side'));
  assert.throws(() => order(s, 'a', 'sell', 0, 11, '1'), fails('insufficient_funds'));
  assert.throws(() => order(s, 'a', 'buy', 100, 11, '1'), fails('insufficient_funds'));
  assert.throws(() => order(s, 'a', 'sell', 1, 1, '1', '../who'), fails('invalid_market'));
  assert.throws(() => order(s, 'a', 'sell', 1, 1, '1', 'no-market'), fails('market_not_found'));
  assert.throws(() => order(s, 'a', 'sell', 1, 1, undefined), fails('invalid_nonce'));
  assert.throws(() => order(s, 'new', 'sell', 1, 1, '1'), fails('join_required'));
  for (let i = 0; i < 32; i++) order(s, 'a', 'buy', 0, 1, 'n' + i);
  assert.throws(() => order(s, 'a', 'buy', 0, 1, 'too-many'), fails('order_limit'));
  order(s, 'b', 'sell', 100, 1, 'outside');
  assert.equal(order(s, 'a', 'buy', 100, 1, 'instant').filled, 1);
});

test('expiry refunds rest, pending view is read-only, settlement is final and idempotent', () => {
  const s = setup();
  const bid = order(s, 'a', 'buy', 30, 5, '1');
  order(s, 'b', 'sell', 20, 3, '2');
  assert.equal(wallet(s, 'a').locked, 60);
  const before = structuredClone(s);
  const pending = view(s, 'a', terms.id, END);
  assert.deepEqual(s, before);
  assert.equal(pending.market.status, 'pending');
  assert.equal(pending.wallet.available, 910);
  assert.equal(pending.wallet.locked, 0);
  assert.deepEqual(pending.book.bids, []);
  assert.deepEqual(pending.wallet.orders, []);
  assert.throws(() => settle(s, terms.id, 82, evidence, END - 1), fails('not_expired'));
  assert.throws(() => settle(s, terms.id, 0.5, evidence, END), fails('invalid_payout'));
  assert.throws(() => settle(s, terms.id, 82, null, END), fails('invalid_evidence'));
  assert.equal(expireOrders(s, END), 1);
  assert.equal(expireOrders(s, END), 0);
  assert.throws(() => cancel(s, 'a', bid.orderId, 'cancel'), fails('order_not_found'));
  assert.throws(() => apply(s, 'a', { type: 'order', marketId: terms.id, side: 'buy', price: 70, qty: 2, nonce: '3' }, END), fails('market_closed'));
  const result = settle(s, terms.id, 82, evidence, END);
  assert.deepEqual(settle(s, terms.id, 82, { source: 'other' }, END + 1), result);
  assert.throws(() => settle(s, terms.id, null, evidence, END + 1), fails('resolution_conflict'));
  assert.equal(wallet(s, 'a', END).available, 1156);
  assert.equal(wallet(s, 'b', END).available, 844);
  assert.deepEqual(wallet(s, 'b', END).settlements[0], { marketId: terms.id, amount: 54, payout: 82, at: END });
  assert.deepEqual(view(s, null, terms.id, END).market.evidence, evidence);
});

test('entirely invested account closes with no new margin and cannot pledge inventory twice', () => {
  const s = setup();
  order(s, 'b', 'sell', 50, 20, '1');
  order(s, 'a', 'buy', 50, 20, '2');
  assert.equal(wallet(s, 'a').available, 0);
  const hedge = order(s, 'a', 'sell', 75, 20, '3');
  assert.equal(wallet(s, 'a').positions[0].pledged, 20);
  assert.throws(() => order(s, 'a', 'sell', 10, 1, '4'), fails('insufficient_funds'));
  order(s, 'c', 'buy', 75, 4, '5');
  assert.equal(wallet(s, 'a').available, 200);
  assert.equal(wallet(s, 'a').settlementCredit, 100);
  assert.equal(wallet(s, 'a').positions[0].qty, 16);
  cancel(s, 'a', hedge.orderId, '6');
  assert.equal(wallet(s, 'a').positions[0].pledged, 0);

  const voided = structuredClone(s);
  settle(voided, terms.id, null, evidence, END);
  assert.equal(view(voided, 'a', terms.id, END).market.status, 'voided');
  assert.ok(['a', 'b', 'c'].every(a => wallet(voided, a, END).available === 1000));
  settle(s, terms.id, 80, evidence, END);
  assert.equal(wallet(s, 'a', END).available, 1580);
  assert.equal(wallet(s, 'b', END).available, 400);
  assert.equal(wallet(s, 'c', END).available, 1020);
});

test('a canceled inventory-backed order releases capital against a newer opposite position', () => {
  const s = setup();
  order(s, 'b', 'sell', 35, 2, 'b-ask');
  order(s, 'a', 'buy', 35, 2, 'a-bid');
  const pledged = order(s, 'a', 'sell', 90, 2, 'a-ask');
  order(s, 'c', 'buy', 60, 2, 'c-bid');
  order(s, 'a', 'sell', 60, 2, 'a-sell');
  assert.equal(wallet(s, 'a').positions.length, 2);
  cancel(s, 'a', pledged.orderId, 'release');
  assert.deepEqual(wallet(s, 'a').positions, []);
  assert.equal(wallet(s, 'a').available, 1000);
  assert.equal(wallet(s, 'a').settlementCredit, 50);
  assert.equal(wallet(s, 'a').markedEquity, 1050);
  settle(s, terms.id, 70, evidence, END);
  assert.equal(wallet(s, 'a', END).available, 1050);
});

test('closing a loser retains the exact void refund and mixed orders escrow only excess units', () => {
  const s = setup();
  order(s, 'a', 'buy', 60, 4, '1');
  order(s, 'b', 'sell', 60, 4, '2');
  order(s, 'a', 'sell', 30, 7, '3');
  assert.equal(wallet(s, 'a').locked, 210);
  order(s, 'c', 'buy', 30, 7, '4');
  const w = wallet(s, 'a');
  assert.equal(w.available, 670);
  assert.equal(w.positions[0].side, 'short');
  assert.equal(w.positions[0].qty, 3);
  assert.equal(w.voidCredit, 120);
  assert.equal(w.collateral, 330);
  assert.equal(w.markedEquity, 880); // The 120 credit is paid only if the market is voided.
  settle(s, terms.id, null, evidence, END);
  assert.equal(wallet(s, 'a', END).markedEquity, 1000);
  assert.ok(['a', 'b', 'c'].every(a => wallet(s, a, END).available === 1000));
});

test('deterministic mixed-order simulation conserves cash under integer payout, void, retries and cancels', () => {
  const actors = ['a', 'b', 'c', 'd', 'e', 'f'];
  const s = setup(actors);
  const second = 'px-other';
  apply(s, 'admin', { type: 'list', market: { ...terms, id: second } }, T);
  let seed = 2381041;
  const random = (max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 4294967296 * max);
  };
  for (let i = 0; i < 1300; i++) {
    const actor = actors[random(actors.length)];
    const current = wallet(s, actor);
    const marketId = random(2) ? terms.id : second;
    if (current.orders.length && random(4) === 0) {
      cancel(s, actor, current.orders[random(current.orders.length)].id, 'c' + i);
    } else {
      const action = { type: 'order', marketId, side: random(2) ? 'buy' : 'sell', price: random(101), qty: random(6) + 1, nonce: 'o' + i };
      try {
        const accepted = apply(s, actor, action, T);
        if (random(5) === 0) assert.deepEqual(apply(s, actor, action, T), accepted);
      } catch (e) {
        if (!['insufficient_funds', 'self_match', 'order_limit'].includes(e.code)) throw e;
      }
    }
    if (i % 13 === 0) {
      for (const actor of actors) {
        const w = wallet(s, actor);
        assert.equal(w.available + w.locked + w.collateral, 1000);
        assert.ok([w.available, w.locked, w.collateral, w.voidCredit, w.settlementCredit].every(n => Number.isSafeInteger(n) && n >= 0));
        assert.ok(w.positions.every(p => p.pledged <= p.qty && p.qty > 0));
      }
    }
  }
  assert.ok(s.fills.length > 80);
  for (const [p1, p2] of [[null, null], [0, 100], [42, 66], [null, 95], [77, null]]) {
    const replica = JSON.parse(JSON.stringify(s));
    settle(replica, terms.id, p1, evidence, END);
    settle(replica, second, p2, evidence, END);
    const wallets = actors.map(a => wallet(replica, a, END));
    assert.equal(wallets.reduce((n, w) => n + w.available, 0), actors.length * 1000);
    assert.ok(wallets.every(w => w.available >= 0 && w.locked === 0 && w.collateral === 0 && !w.positions.length && !w.orders.length));
    if (p1 === null && p2 === null) assert.ok(wallets.every(w => w.available === 1000));
  }
});
