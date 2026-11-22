import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POLICY, type Policy } from '../src/policy/store.js';
import { deriveSignals } from '../src/signals.js';
import { deriveSummary } from '../src/summary.js';
import { teamOverview, type OverviewInput } from '../src/teamOverview.js';
import type { StoredEvent } from '../src/types.js';

const NOW = new Date('2026-11-21T15:00:00.000Z');
const DAY = '2026-11-21';
let nextId = 1;

const health = (hours: number, steps: number): StoredEvent => ({
  id: nextId++,
  source: 'apple_health',
  type: 'salud_diaria',
  occurredAt: `${DAY}T10:00:00.000Z`,
  summary: '',
  raw: { date: DAY, sleep_hours: hours, steps },
  receivedAt: `${DAY}T10:00:00.000Z`,
});

const member = (name: string, hours: number, steps: number, policy: Partial<Policy> = {}, me = false): OverviewInput => {
  const events = [health(hours, steps)];
  const signals = deriveSignals(events, NOW);
  return { name, me, signals, summary: deriveSummary(events, signals, NOW), policy: { ...DEFAULT_POLICY, ...policy } };
};

test('de cada integrante se ve solo lo que comparte; lo propio se ve siempre', () => {
  const overview = teamOverview([member('Ana', 5, 3000, {}, true), member('Tomás', 8, 9000, { energy: 'siempre' }), member('Sofía', 7, 7000, { energy: 'preguntar', load: 'preguntar' })]);
  const [ana, tomas, sofia] = overview.members;
  assert.equal(ana?.sleepHours, 5);
  assert.equal(tomas?.steps, 9000);
  assert.deepEqual([sofia?.shares, sofia?.energy, sofia?.load, sofia?.sleepHours, sofia?.steps], [false, null, null, null, null]);
  assert.equal(ana?.load, 'sin_datos');
  assert.deepEqual(sofia?.topics, []);
});

test('el promedio del equipo necesita tres personas y deja fuera a quien lo marcó privado', () => {
  const three = teamOverview([member('Ana', 5, 3000, {}, true), member('Tomás', 8, 9000), member('Sofía', 8, 9000)]);
  assert.deepEqual(three.sleepHours, { available: true, value: 7, contributors: 3 });
  assert.deepEqual(three.steps, { available: true, value: 21000, contributors: 3 });

  const withPrivate = teamOverview([member('Ana', 5, 3000, {}, true), member('Tomás', 8, 9000), member('Sofía', 8, 9000, { energy: 'nunca' })]);
  assert.deepEqual(withPrivate.sleepHours, { available: false, needed: 3 });
});
