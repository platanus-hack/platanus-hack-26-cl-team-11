import assert from 'node:assert/strict';
import test from 'node:test';
import { describe, evaluate, EVENT_END, KINDS, propose } from '../web/lib/exchange-contracts.mjs';

const now = Date.parse('2026-11-21T15:00:00Z');
const expiry = now + 60000;
const board = {
  event: '26-cl', at: now, status: 'open',
  teams: [{ team: 'a', id: 'id-a', price: 0.1 }, { team: 'b', id: 'id-b', price: 0.3 }],
};
const spec = { kind: 'binary', team: 'a', expiry, strike: 1000 };
const proposal = (params) => propose({ ...spec, ...params }, board, now);
const settleAt = (market, close) => evaluate(market, { a: [[market.expiry, close]] }).payout;

test('economic terms produce stable order books, even as display names and ordinary quotes change', () => {
  const first = proposal({});
  const refreshed = { ...board, at: now + 1000, teams: board.teams.map((t) => ({ ...t, name: 'Nuevo', price: 0.2 })) };
  assert.match(first.id, /^px-[0-9a-f]{24}$/);
  assert.equal(propose(spec, refreshed, now).id, first.id);
  assert.equal(propose({ ...spec, teamId: 'fake', title: 'custom' }, board, now).teamId, 'id-a');
  assert.notEqual(proposal({ strike: 1001 }).id, first.id);
  assert.notEqual(proposal({ expiry: expiry + 60000 }).id, first.id);
  assert.notEqual(proposal({ kind: 'call', width: 10 }).id, proposal({ kind: 'call', width: 20 }).id);
  assert.notEqual(proposal({ kind: 'range', upper: 2000 }).id, proposal({ kind: 'range', upper: 2001 }).id);
  const race = { ...spec, kind: 'race', rival: 'b' };
  const locked = propose(race, board, now);
  assert.notEqual(propose(race, refreshed, now).id, locked.id);
  assert.deepEqual(propose(race, { ...board, at: now + 1000 }, now + 1000), locked);
  assert.equal(locked.baseline, 1000);
  assert.equal(locked.rivalBaseline, 3000);
  for (const kind of KINDS) {
    const market = proposal({ kind, width: 100, upper: 2000, rival: 'b' });
    assert.equal(describe(market), market.description);
    assert.ok(market.title.includes('a'));
  }
});

test('creation requires a fresh open board, official identities, supported integer terms and a future UTC minute', () => {
  for (const change of [
    { kind: 'unknown' }, { team: 'x' }, { strike: '1000' }, { strike: 0.1 }, { strike: -1 }, { strike: 10001 },
    { kind: 'range', upper: 999 }, { kind: 'range', upper: 1000 }, { kind: 'range', upper: 10001 },
    { kind: 'call' }, { kind: 'put', width: NaN }, { kind: 'future', width: 0 }, { kind: 'butterfly', width: 10001 },
    { kind: 'race', rival: 'a' }, { kind: 'race', rival: 'x' }, { expiry: now }, { expiry: expiry + 1 },
    { expiry: now + 86460000 }, { expiry: new Date(expiry).toISOString() },
  ]) assert.throws(() => proposal(change), { status: 400 });
  for (const change of [{ at: now - 30001 }, { at: now + 30001 }, { status: 'closed' }, { event: 'other' }]) {
    assert.throws(() => propose(spec, { ...board, ...change }, now), { status: 503 });
  }
  for (const price of [NaN, 1.1, -0.01, '0.10']) {
    const changed = { ...board, teams: [{ ...board.teams[0], price }] };
    assert.throws(() => propose(spec, changed, now), { status: 503 });
  }
  const dust = { ...board, teams: [{ ...board.teams[0], price: 0.00001 }, board.teams[1]] };
  assert.throws(() => propose({ ...spec, kind: 'race', rival: 'b' }, dust, now), { status: 400 });
  assert.equal(proposal({ strike: 0 }).strike, 0);
  assert.equal(proposal({ kind: 'range', strike: 0, upper: 10000 }).upper, 10000);
  assert.equal(proposal({ expiry: now + 86400000 }).expiry, now + 86400000);
  assert.equal(propose(spec, { ...board, at: now + 30000 }, now + 30000).expiry, expiry);
  assert.throws(() => propose(spec, { ...board, at: now + 30001 }, now + 30001), { status: 400 });
  const nearEnd = EVENT_END - 60000;
  assert.equal(propose({ ...spec, expiry: EVENT_END }, { ...board, at: nearEnd }, nearEnd).expiry, EVENT_END);
  assert.throws(() => propose({ ...spec, expiry: EVENT_END + 60000 }, { ...board, at: nearEnd }, nearEnd), { status: 400 });
});

test('settlement reads the last price at or before expiry independently from the coverage tick', () => {
  const market = proposal({});
  const rows = [[expiry + 900, 0.9], [expiry - 30, 0.1], [expiry - 5000, 0.3], [expiry + 200, 0.05]];
  const expected = { team: 'a', id: 'id-a', at: expiry - 30, price: 0.1, priceBps: 1000, coveredThrough: expiry + 200 };
  for (const tape of [{ a: rows }, { 'id-a': rows }, new Map([['a', rows]]), new Map([['id-a', rows]])]) {
    const { payout, evidence } = evaluate(market, tape);
    assert.equal(payout, 100);
    assert.equal(evidence.expiry, expiry);
    assert.deepEqual(evidence.observations, [expected]);
  }
  assert.equal(settleAt(market, 0.0999), 0);
  assert.equal(settleAt(market, 0.1), 100);
  assert.equal(settleAt(proposal({ strike: 2 }), 0.00015), 100);
  assert.equal(settleAt(proposal({ strike: 2 }), 0.0001499), 0);
  assert.equal(settleAt(proposal({ strike: 0 }), 0), 100);
  assert.equal(settleAt(proposal({ strike: 10000 }), 1), 100);
});

test('delayed, truncated and invalid histories cannot settle a contract', () => {
  const market = proposal({});
  for (const tape of [null, {}, { a: [] }, { a: [[expiry - 1, 0.2]] }, { a: [[expiry + 1, 0.2]] },
    { a: [[expiry, 10]] }, { a: [[expiry, -0.01]] }, { a: [[expiry, NaN]] }, { a: [[expiry, '0.1']] },
    { a: [[Infinity, 0.2]] }]) {
    assert.equal(evaluate(market, tape), null);
  }
  assert.equal(evaluate(proposal({ kind: 'race', rival: 'b' }), {
    a: [[expiry, 0.2]], b: [[expiry - 1, 0.3]],
  }), null);
});

test('long payoffs use integer bps; bounded contracts include strikes, tails, caps and fractional payouts', () => {
  const cases = {
    call: [0, 0, 0, 13, 50, 100, 100],
    put: [100, 50, 0, 0, 0, 0, 0],
    future: [0, 25, 50, 56, 75, 100, 100],
    butterfly: [0, 50, 100, 88, 50, 0, 0],
    range: [0, 0, 100, 100, 100, 100, 0],
  };
  const closes = [0.05, 0.08, 0.1, 0.105, 0.12, 0.14, 0.16];
  for (const [kind, expected] of Object.entries(cases)) {
    const market = proposal({ kind, width: 400, upper: 1400 });
    assert.deepEqual(closes.map((value) => settleAt(market, value)), expected, kind);
  }
});

test('race compares proportional returns from locked prices, including exact ties and losses', () => {
  const race = proposal({ kind: 'race', rival: 'b' });
  const example = (a, b) => evaluate(race, { a: [[expiry, a]], b: [[expiry, b]] });
  assert.equal(example(0.12, 0.33).payout, 100);
  assert.equal(example(0.12, 0.36).payout, 50);
  assert.equal(example(0.12, 0.39).payout, 0);
  assert.equal(example(0.09, 0.24).payout, 100);
  assert.equal(example(0, 0).payout, 50);
  assert.deepEqual(example(0.12, 0.36).evidence.observations.map((o) => [o.team, o.baseline, o.priceBps]),
    [['a', 1000, 1200], ['b', 3000, 3600]]);
});
