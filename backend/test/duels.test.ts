import assert from 'node:assert/strict';
import { openDatabase } from '../src/pg/database.js';
import test from 'node:test';
import { createGame, FIVE_MINUTES, GRACE } from '../src/duels/game.js';

const start = 1_000_000;
function tape(ts: number, a = 0.05, b = 0.1) {
  return {
    ts,
    open: true,
    teams: [
      { id: 'a', name: 'A', price: a },
      { id: 'b', name: 'B', price: b },
    ],
  };
}
function setup() {
  const game = createGame(openDatabase({ kind: 'memory' }));
  for (const id of ['one', 'two', 'three']) game.register(id, id);
  const key = game.place('one', 'ticket', 'a', 'b', tape(start), start);
  return { game, key };
}
test('reserve once, match once and pay the larger percentage gain exactly once', () => {
  const { game, key } = setup();
  assert.equal(game.place('one', 'ticket', 'a', 'b', tape(start), start), key);
  assert.throws(() => game.accept('one', key, tape(start), start));
  game.accept('two', key, tape(start), start);
  game.accept('two', key, tape(start), start);
  assert.throws(() => game.accept('three', key, tape(start), start));
  assert.throws(() => game.cancel('one', key));
  assert.equal(game.wallet('two')?.points, 90);
  const due = start + FIVE_MINUTES;
  game.settle(tape(due - 1), due);
  assert.equal(game.wallet('one')?.points, 90);
  game.settle(tape(due, 0.06, 0.115), due);
  game.settle(tape(due, 0.06, 0.115), due);
  assert.equal(game.wallet('one')?.points, 110);
  assert.equal(game.wallet('two')?.points, 90);
});
test('tie, missing expiry quote, closed market, withdrawn and unmatched offers refund', () => {
  for (const type of ['tie', 'missing', 'closed', 'cancel', 'expired']) {
    const { game, key } = setup();
    const due = start + FIVE_MINUTES;
    if (type === 'cancel') {
      game.cancel('one', key);
      game.cancel('one', key);
    } else if (type === 'expired') game.settle(null, start + 2 * FIVE_MINUTES);
    else {
      game.accept('two', key, tape(start), start);
      if (type === 'tie') game.settle(tape(due, 0.055, 0.11), due);
      if (type === 'closed') game.settle({ ...tape(start + 1), open: false }, start + 1);
      if (type === 'missing') game.settle(tape(due + GRACE + 1), due + GRACE + 1);
    }
    assert.equal(game.wallet('one')?.points, 100);
    assert.equal(game.wallet('two')?.points, 100);
    assert.equal(game.active(), false);
  }
});
