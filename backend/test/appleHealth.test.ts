import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appleHealth } from '../src/connectors/appleHealth.js';

const sleepOf = (payload: Record<string, unknown>) => (appleHealth.toEvent(payload).raw as { sleep_hours: number | null }).sleep_hours;

test('a duration sum sent by the iOS Shortcut arrives in seconds with a decimal comma and becomes hours', () => {
  const event = appleHealth.toEvent({ sleep_hours: '23040,5' });
  assert.equal(event.summary, 'sueño 6.4 h');
  assert.ok(Math.abs((sleepOf({ sleep_hours: '23040,5' }) ?? 0) - 6.4) < 0.01);
});

test('an explicit seconds field and a plain hours value are both understood', () => {
  assert.equal(sleepOf({ sleep_seconds: 25200 }), 7);
  assert.equal(sleepOf({ sleep_hours: 6.4 }), 6.4);
});

test('a sum that spans several nights is kept as reported but not used as one night', () => {
  const event = appleHealth.toEvent({ sleep_hours: '113238,394000053' });
  assert.equal(sleepOf({ sleep_hours: '113238,394000053' }), null);
  assert.equal(event.summary, 'sueño de varias noches sumado (31.5 h), no se usa');
  assert.deepEqual((event.raw as { reported: unknown }).reported, { sleep_hours: '113238,394000053' });
});

test('an empty or zero sum means no sleep data, not zero hours', () => {
  assert.equal(sleepOf({ sleep_hours: 0 }), null);
  assert.equal(appleHealth.toEvent({ sleep_hours: '' }).summary, 'datos de salud recibidos sin campos reconocidos');
});
