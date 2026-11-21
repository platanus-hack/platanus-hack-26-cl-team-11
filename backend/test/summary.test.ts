import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveSignals } from '../src/signals.js';
import { deriveSummary } from '../src/summary.js';
import type { StoredEvent } from '../src/types.js';

const NOW = new Date('2026-11-21T15:00:00.000Z');
const DAY_MS = 86_400_000;
let nextId = 1;

const event = (source: StoredEvent['source'], type: string, occurredAt: string, raw: Record<string, unknown>): StoredEvent => ({
  id: nextId++,
  source,
  type,
  occurredAt,
  summary: '',
  raw,
  receivedAt: occurredAt,
});

const night = (daysAgo: number, hours: number) => {
  const day = new Date(NOW.getTime() - daysAgo * DAY_MS).toISOString().slice(0, 10);
  return event('apple_health', 'salud_diaria', `${day}T10:00:00.000Z`, { date: day, sleep_hours: hours });
};

const meeting = (title: string, start: string, minutes: number, declined = false) =>
  event('google_calendar', 'reunion', start, { title, start, end: new Date(Date.parse(start) + minutes * 60_000).toISOString(), durationMinutes: minutes, declined });

const summaryOf = (events: StoredEvent[]) => deriveSummary(events, deriveSignals(events, NOW), NOW);

test('sin datos no inventa frases', () => {
  const summary = summaryOf([]);
  assert.deepEqual(summary.lines, []);
  assert.deepEqual(summary.meetings, []);
  assert.equal(summary.sleep.lastHours, null);
  assert.deepEqual(summary.move, { workoutMinutes: null, steps: null });
});

test('cuenta las reuniones de hoy, nombra la próxima y deja fuera las rechazadas', () => {
  const summary = summaryOf([
    meeting('Daily', '2026-11-21T12:00:00.000Z', 30),
    meeting('Demo', '2026-11-21T19:30:00.000Z', 45),
    meeting('Rechazada', '2026-11-21T20:30:00.000Z', 60, true),
    meeting('De ayer', '2026-11-20T19:30:00.000Z', 45),
    meeting('Daily de mañana', '2026-11-22T12:00:00.000Z', 30),
  ]);
  assert.deepEqual(summary.meetings.map((item) => item.title), ['Daily', 'Demo']);
  assert.equal(summary.lines[0], 'Hoy tienes un día liviano: 2 reuniones, 1 h 15 min en total. La próxima es «Demo» a las 16:30.');
  assert.equal(summary.lines[1], 'Mañana tienes 1 reunión. La primera es «Daily de mañana» a las 09:00.');
});

test('compara el sueño de la semana con el de antes', () => {
  const events = [...[0, 1, 2, 3, 4].map((daysAgo) => night(daysAgo, 5.5)), ...[9, 10, 11, 12].map((daysAgo) => night(daysAgo, 7.5))];
  const summary = summaryOf(events);
  assert.equal(summary.lines[0], 'Vienes de una semana de poco sueño: 5,5 h por noche, y lo tuyo son 7,5 h.');
  assert.equal(summary.sleep.lastHours, 5.5);
});

test('trae el deporte y los pasos de hoy', () => {
  const day = NOW.toISOString().slice(0, 10);
  const summary = summaryOf([event('apple_health', 'salud_diaria', `${day}T10:00:00.000Z`, { date: day, sleep_hours: 7, steps: 6400, workout_minutes: 35 })]);
  assert.deepEqual(summary.move, { workoutMinutes: 35, steps: 6400 });
});

test('lista lo que está en curso y avisa lo que vence', () => {
  const updatedAt = '2026-11-20T15:00:00.000Z';
  const task = (identifier: string, title: string, stateType: string, dueDate: string | null) =>
    event('linear', 'tarea', updatedAt, { identifier, title, stateType, updatedAt, dueDate });
  const summary = summaryOf([task('A-1', 'Migrar cobros', 'started', '2026-11-24'), task('A-2', 'Cerrada', 'completed', '2026-11-22'), task('A-3', 'Lejana', 'unstarted', '2027-01-10')]);
  assert.deepEqual(summary.working, [{ title: 'Migrar cobros', due: '2026-11-24' }]);
  assert.ok(summary.lines.includes('Esta semana vence «Migrar cobros».'));
});
