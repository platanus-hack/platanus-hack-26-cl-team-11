import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partialContacts, partialString } from '../src/agents/partial.js';

test('a field is read while the model is still writing it', () => {
  assert.equal(partialString('{"help": "si", "mess', 'message'), null);
  assert.equal(partialString('{"help": "si", "message"', 'message'), null);
  assert.deepEqual(partialString('{"help": "si", "message": "Puede ay', 'message'), { text: 'Puede ay', closed: false });
  assert.deepEqual(partialString('{"help":"si","message":"Puede ayudar."}', 'message'), { text: 'Puede ayudar.', closed: true });
  assert.deepEqual(partialString('{"help":"si"}', 'help'), { text: 'si', closed: true });
});

test('escapes are decoded, and an unfinished escape waits for the rest', () => {
  assert.deepEqual(partialString('{"message":"Dijo \\"hola\\"\\ny se fue"}', 'message'), { text: 'Dijo "hola"\ny se fue', closed: true });
  assert.deepEqual(partialString('{"message":"a\\u00f1o"}', 'message'), { text: 'año', closed: true });
  assert.deepEqual(partialString('{"message":"a\\u00f', 'message'), { text: 'a', closed: false });
  assert.deepEqual(partialString('{"message":"fin\\', 'message'), { text: 'fin', closed: false });
});

test('each contact shows up once its teammate is known and its message has started', () => {
  assert.deepEqual(partialContacts('{"conta'), []);
  assert.deepEqual(partialContacts('{"contacts":[{"teammate":"p'), []);
  assert.deepEqual(partialContacts('{"contacts":[{"teammate":"p2","message":"'), []);
  assert.deepEqual(partialContacts('{"contacts":[{"teammate":"p2","message":"Ana nec'), [{ teammate: 'p2', message: 'Ana nec' }]);
  assert.deepEqual(partialContacts('{"contacts":[{"teammate":"p2","message":"Ana necesita ayuda."},{"teammate":"p4","message":"Hola'), [
    { teammate: 'p2', message: 'Ana necesita ayuda.' },
    { teammate: 'p4', message: 'Hola' },
  ]);
  assert.deepEqual(partialContacts('{"contacts":[]}'), []);
});
