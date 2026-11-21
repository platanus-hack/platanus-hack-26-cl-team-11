import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from '../src/context.js';
import { signalRoutes } from '../src/routes/signals.js';
import { DEMO_NAMES, demoEventsFor, seedDemo, seedDemoEvents } from '../src/seed.js';
import { FIXED_THRESHOLD_BASIS, deriveSignals, type Signals } from '../src/signals.js';
import type { StoredEvent } from '../src/types.js';

const NOW = new Date('2026-11-21T15:00:00.000Z');
const TODAY = '2026-11-21';
const DAY_MS = 86_400_000;
const ANY_DIGIT = /\d/;

const dayAgo = (daysAgo: number) => new Date(Date.parse(TODAY) - daysAgo * DAY_MS).toISOString().slice(0, 10);
const momentAgo = (daysAgo: number, hoursAgo = 0) => new Date(NOW.getTime() - daysAgo * DAY_MS - hoursAgo * 3_600_000).toISOString();

let nextEventId = 1;
const event = (source: string, type: string, occurredAt: string, raw: unknown): StoredEvent => ({
  id: nextEventId++,
  source,
  type,
  occurredAt,
  summary: '',
  raw,
  receivedAt: occurredAt,
});

const night = (daysAgo: number, sleepHours: number | string) => event('apple_health', 'salud_diaria', dayAgo(daysAgo), { date: dayAgo(daysAgo), sleep_hours: sleepHours });
const usualNights = (sleepHours: number, nights = 10) => Array.from({ length: nights }, (_, index) => night(index + 1, sleepHours));
const checkin = (daysAgo: number, mood: string, blocker: string | null = null) => event('checkin', 'checkin', momentAgo(daysAgo, 1), { mood, blocker, note: null });
const meeting = (start: string, durationMinutes: number) =>
  event('google_calendar', 'reunion', start, {
    id: start,
    title: 'Reunión',
    start,
    end: new Date(Date.parse(start) + durationMinutes * 60_000).toISOString(),
    durationMinutes,
    attendees: 3,
    declined: false,
  });
const task = (identifier: string, title: string, stateType: string, updatedAt: string, dueDate: string | null = null) =>
  event('linear', 'tarea', updatedAt, { identifier, title, url: null, state: stateType, stateType, priority: 2, dueDate, createdAt: updatedAt, updatedAt });

const signalsOf = (events: StoredEvent[]): Signals => deriveSignals(events, NOW);

test('energy compares last night against the own average of the person', () => {
  const longSleeper = signalsOf([...usualNights(8), night(0, 6)]);
  const shortSleeper = signalsOf([...usualNights(5.5), night(0, 6)]);

  assert.equal(longSleeper.energy.level, 'baja');
  assert.ok(['media', 'alta'].includes(shortSleeper.energy.level));
  assert.deepEqual(longSleeper.energy.basis, ['apple_health']);
  assert.equal(longSleeper.energy.visibility, 'preguntar');
});

test('energy reads sleep sent as text with a decimal comma', () => {
  const signals = signalsOf([...usualNights(8).map((health) => ({ ...health, raw: { ...(health.raw as object), sleep_hours: '8,0' } })), night(0, '6,0')]);
  assert.equal(signals.energy.level, 'baja');
});

test('energy statement and basis never carry a number', () => {
  const scenarios = [
    [...usualNights(8), night(0, 6)],
    [...usualNights(5.5), night(0, 6)],
    [night(0, 4.8)],
    [...usualNights(7.5), night(2, 4.9), night(1, 4.8), night(0, 5), checkin(0, 'cansada')],
    [checkin(0, 'bien')],
    [],
  ];
  for (const events of scenarios) {
    const { energy } = signalsOf(events);
    assert.doesNotMatch(energy.statement, ANY_DIGIT);
    for (const entry of energy.basis) assert.doesNotMatch(entry, ANY_DIGIT);
  }
});

test('energy says this week when the short nights repeat', () => {
  const sustained = signalsOf([...usualNights(7.5).slice(2), night(2, 4.9), night(1, 4.8), night(0, 5)]);
  const single = signalsOf([...usualNights(7.5), night(0, 5)]);
  assert.equal(sustained.energy.statement, 'Energía baja esta semana');
  assert.equal(single.energy.statement, 'Energía baja hoy');
});

test('energy falls back to fixed thresholds with little history and says so', () => {
  const short = signalsOf([night(1, 7), night(0, 5)]);
  const long = signalsOf([night(0, 8)]);
  assert.equal(short.energy.level, 'baja');
  assert.equal(long.energy.level, 'alta');
  assert.ok(short.energy.basis.includes(FIXED_THRESHOLD_BASIS));
  assert.ok(long.energy.basis.includes(FIXED_THRESHOLD_BASIS));
});

test('the latest check-in mood nudges energy one step', () => {
  const steady = [...usualNights(7), night(0, 7)];
  assert.equal(signalsOf(steady).energy.level, 'media');
  assert.equal(signalsOf([...steady, checkin(0, 'cansada')]).energy.level, 'baja');
  assert.equal(signalsOf([...steady, checkin(0, 'bien')]).energy.level, 'alta');
  assert.deepEqual(signalsOf([...steady, checkin(0, 'normal')]).energy.basis, ['apple_health', 'checkin']);
  assert.equal(signalsOf([...steady, checkin(5, 'cansada')]).energy.level, 'media');
});

test('a sleep record that is too old does not become an energy level', () => {
  const signals = signalsOf(Array.from({ length: 10 }, (_, index) => night(index + 4, 8)));
  assert.equal(signals.energy.level, 'sin_datos');
});

test('no data gives sin_datos everywhere and empty lists', () => {
  const signals = signalsOf([]);
  assert.equal(signals.energy.level, 'sin_datos');
  assert.equal(signals.load.level, 'sin_datos');
  assert.deepEqual(signals.energy.basis, []);
  assert.deepEqual(signals.load.basis, []);
  assert.deepEqual(signals.blockers, []);
  assert.deepEqual(signals.expertise, []);
  assert.equal(signals.asOf, NOW.toISOString());
  assert.deepEqual(signals.visibility, { energy: 'preguntar', load: 'preguntar', blockers: 'siempre', expertise: 'siempre' });
});

test('load counts the meetings of today and the open tasks', () => {
  const sixToday = Array.from({ length: 6 }, (_, index) => meeting(`2026-11-21T${String(12 + index).padStart(2, '0')}:00:00.000Z`, 30));
  const yesterday = Array.from({ length: 6 }, (_, index) => meeting(`2026-11-20T${String(12 + index).padStart(2, '0')}:00:00.000Z`, 60));

  assert.equal(signalsOf(sixToday).load.level, 'alta');
  assert.equal(signalsOf(yesterday).load.level, 'baja');
  assert.equal(signalsOf([meeting('2026-11-21T13:00:00.000Z', 150)]).load.level, 'media');
  assert.deepEqual(signalsOf(sixToday).load.basis, ['google_calendar']);
  assert.equal(signalsOf(sixToday).load.visibility, 'preguntar');
  assert.doesNotMatch(signalsOf(sixToday).load.statement, ANY_DIGIT);
});

test('load uses the local day, not the UTC day', () => {
  const lateTonight = meeting('2026-11-22T01:30:00.000Z', 240);
  const lateLastNight = meeting('2026-11-21T01:30:00.000Z', 240);
  assert.equal(signalsOf([lateTonight]).load.level, 'alta');
  assert.equal(signalsOf([lateLastNight]).load.level, 'baja');
});

test('three deliveries due this week make the load high', () => {
  const deliveries = [1, 3, 4].map((dueInDays, index) => task(`RON-${index}`, `Entrega ${index}`, 'started', momentAgo(1), dayAgo(-dueInDays)));
  const signals = signalsOf(deliveries);
  assert.equal(signals.load.level, 'alta');
  assert.equal(signals.load.statement, 'Carga alta esta semana');
  assert.deepEqual(signals.load.basis, ['linear']);
});

test('a meeting noted in Granola is not counted twice', () => {
  const start = '2026-11-21T13:00:00.000Z';
  const end = '2026-11-21T15:00:00.000Z';
  const note = event('granola', 'nota_de_reunion', start, { id: 'n1', title: 'Reunión', calendar_event: { scheduled_start_time: start, scheduled_end_time: end } });
  assert.equal(signalsOf([meeting(start, 120), note]).load.level, 'media');
  assert.deepEqual(signalsOf([note]).load.basis, ['granola']);
});

test('a stale started task and a check-in blocker both become blockers', () => {
  const signals = signalsOf([
    task('RON-1', 'Migrar la base de clientes', 'started', momentAgo(4)),
    task('RON-2', 'Pantalla de inicio', 'started', momentAgo(1)),
    task('RON-3', 'Exportar reportes', 'unstarted', momentAgo(9)),
    checkin(2, 'normal', 'integración de pagos'),
    checkin(1, 'normal', 'Integración de pagos'),
    checkin(0, 'normal', 'integración de pagos'),
  ]);

  assert.deepEqual(
    signals.blockers.map((blocker) => [blocker.source, blocker.topic]),
    [
      ['checkin', 'integración de pagos'],
      ['linear', 'Migrar la base de clientes'],
    ],
  );
  assert.equal(signals.blockers[0]?.statement, 'Bloqueo en «integración de pagos» desde hace 2 días');
  assert.equal(signals.blockers[0]?.since, momentAgo(2, 1));
  assert.equal(signals.blockers[1]?.statement, 'Sin avances en «Migrar la base de clientes» desde hace 4 días');
  assert.equal(signals.blockers[1]?.since, momentAgo(4));
});

test('a blocker ends when the task moves or the next check-in drops it', () => {
  const signals = signalsOf([
    task('RON-1', 'Migrar la base de clientes', 'started', momentAgo(6)),
    task('RON-1', 'Migrar la base de clientes', 'completed', momentAgo(1)),
    checkin(1, 'normal', 'integración de pagos'),
    checkin(0, 'bien'),
  ]);
  assert.deepEqual(signals.blockers, []);
});

test('expertise surfaces repos and words that repeat across titles', () => {
  const signals = signalsOf([
    event('github', 'commit', momentAgo(1), { repo: 'ronda/pagos-api', commits: 4 }),
    event('github', 'commit', momentAgo(2), { repo: 'ronda/sitio', commits: 1 }),
    event('github', 'pull_request', momentAgo(3), { repo: 'ronda/pagos-api', action: 'opened', title: 'Webhook de pagos con reintentos', url: 'https://git.example/1' }),
    event('github', 'pull_request', momentAgo(2), { repo: 'ronda/pagos-api', action: 'closed', title: 'Webhook de pagos con reintentos', url: 'https://git.example/1' }),
    task('RON-1', 'Firmar el webhook de cobros', 'completed', momentAgo(5)),
  ]);

  assert.deepEqual(signals.expertise, ['pagos-api', 'sitio', 'webhook']);
});

test('the signals route answers 404 for an unknown link and signals for a known one', async () => {
  const ctx = createContext({ location: ':memory:' });
  const routes = signalRoutes(ctx);
  const person = ctx.store.addPerson('Ana');

  const unknown = await routes.request('/people/nope/signals');
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { error: 'Link no válido.' });

  const known = await routes.request(`/people/${person.token}/signals`);
  assert.equal(known.status, 200);
  const body = (await known.json()) as { name: string; signals: Signals };
  assert.equal(body.name, 'Ana');
  assert.equal(body.signals.energy.level, 'sin_datos');
  assert.deepEqual(body.signals.expertise, []);
});

test('the demo seed tells the story', () => {
  const ctx = createContext({ location: ':memory:' });
  const people = seedDemo(ctx, NOW);
  assert.deepEqual(
    people.map((person) => person.name),
    ['Ana', 'Tomás', 'Sofía', 'Diego', 'Carla'],
  );

  const signalsByName = new Map(people.map((person) => [person.name, deriveSignals(ctx.store.listEvents(person.token, 500), NOW)]));
  const of = (name: string): Signals => {
    const signals = signalsByName.get(name);
    assert.ok(signals);
    return signals;
  };

  assert.equal(of('Ana').energy.level, 'baja');
  assert.equal(of('Ana').energy.statement, 'Energía baja esta semana');
  assert.equal(of('Ana').load.level, 'alta');
  assert.deepEqual(
    of('Ana').blockers.map((blocker) => blocker.statement),
    ['Bloqueo en «integración de pagos» desde hace 2 días'],
  );
  assert.ok(!of('Ana').expertise.some((topic) => topic.includes('pago')));

  assert.equal(of('Tomás').energy.level, 'alta');
  assert.equal(of('Tomás').load.level, 'baja');
  assert.ok(of('Tomás').expertise.some((topic) => topic.includes('pago')));
  assert.deepEqual(of('Tomás').blockers, []);

  assert.equal(of('Sofía').load.level, 'alta');
  assert.ok(of('Sofía').expertise.some((topic) => topic.includes('pago')));

  for (const name of ['Diego', 'Carla']) {
    assert.equal(of(name).energy.level, 'media');
    assert.equal(of(name).load.level, 'media');
    assert.deepEqual(of(name).blockers, []);
  }

  for (const signals of signalsByName.values()) assert.doesNotMatch(signals.energy.statement, ANY_DIGIT);
});

test('every seeded event is marked as synthetic and covers fourteen days', () => {
  const ctx = createContext({ location: ':memory:' });
  for (const person of seedDemo(ctx, NOW)) {
    const events = ctx.store.listEvents(person.token, 500);
    assert.ok(events.length > 0 && events.length < 500);
    for (const stored of events) assert.equal((stored.raw as { synthetic?: unknown }).synthetic, true);
    const healthDays = events.filter((stored) => stored.source === 'apple_health').map((stored) => stored.occurredAt);
    assert.equal(new Set(healthDays).size, 14);
    assert.equal(healthDays[0], TODAY);
    assert.equal(healthDays.at(-1), dayAgo(13));
  }
});

test('the demo seed is deterministic and does not duplicate on a second run', () => {
  assert.deepEqual(demoEventsFor('Ana', NOW), demoEventsFor('Ana', NOW));
  assert.deepEqual(demoEventsFor('Nadie', NOW), []);
  assert.equal(DEMO_NAMES.length, 5);

  const ctx = createContext({ location: ':memory:' });
  const [ana] = seedDemo(ctx, NOW);
  assert.ok(ana);
  const before = ctx.store.listEvents(ana.token, 500).length;
  assert.equal(seedDemoEvents(ctx, ana.token, ana.name, NOW), 0);
  assert.equal(ctx.store.listEvents(ana.token, 500).length, before);
});

test('a blocker told in a check-in asks before it is shared, a stale task does not', () => {
  const now = new Date('2026-11-21T15:00:00.000Z');
  const event = (id: number, source: string, type: string, occurredAt: string, raw: unknown): StoredEvent => ({ id, source, type, occurredAt, summary: '', raw, receivedAt: occurredAt });
  const signals = deriveSignals(
    [
      event(1, 'checkin', 'checkin', '2026-11-21T12:00:00.000Z', { mood: 'normal', blocker: 'integración de pagos', note: null }),
      event(2, 'linear', 'tarea', '2026-11-15T12:00:00.000Z', { identifier: 'VIT-1', title: 'Migrar cobros', stateType: 'started', state: 'En progreso', updatedAt: '2026-11-15T12:00:00.000Z', createdAt: '2026-11-10T12:00:00.000Z', dueDate: null, priority: 2, url: null }),
    ],
    now,
  );
  assert.equal(signals.blockers.find((blocker) => blocker.source === 'checkin')?.visibility, 'preguntar');
  assert.equal(signals.blockers.find((blocker) => blocker.source === 'linear')?.visibility, 'siempre');
});

test('what a person is working on comes from their started tasks, open pull requests and recent commits, with no text written by them', () => {
  const task = (identifier: string, title: string, stateType: string, daysAgo: number) =>
    event('linear', 'tarea', momentAgo(daysAgo), { identifier, title, stateType, updatedAt: momentAgo(daysAgo), dueDate: null });
  const pull = (action: string, title: string, daysAgo: number) =>
    event('github', 'pull_request', momentAgo(daysAgo), { repo: 'vita/pagos-api', action, title, url: `https://github.com/vita/pagos-api/pull/${title.length}` });
  const commit = (repo: string, daysAgo: number) => event('github', 'commit', momentAgo(daysAgo), { repo, commits: 2 });

  const signals = deriveSignals(
    [
      task('VIT-1', 'Reintentos del webhook de pagos', 'started', 1),
      task('VIT-2', 'Migrar clientes antiguos', 'completed', 1),
      pull('opened', 'Valida la firma del webhook', 2),
      pull('opened', 'Arregla el redondeo', 3),
      pull('closed', 'Arregla el redondeo', 1),
      commit('vita/panel', 1),
      commit('vita/pagos-api', 1),
      commit('vita/viejo', 9),
    ],
    NOW,
  );

  assert.deepEqual(signals.focus, ['Trabaja en «Reintentos del webhook de pagos»', 'Tiene abierto «Valida la firma del webhook» en pagos-api', 'Hizo commits en panel en los últimos días']);
});
