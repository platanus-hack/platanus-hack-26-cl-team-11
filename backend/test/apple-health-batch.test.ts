import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext, loadConfig, type Config } from '../src/context.js';
import { appleHealth } from '../src/connectors/appleHealth.js';

const RECEIVED_AT = '2026-11-21T15:00:00.000Z';

const send = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const batchOf = (payload: Record<string, unknown>) => {
  const batch = appleHealth.toBatch?.(payload, RECEIVED_AT);
  assert.ok(batch);
  return batch;
};

const rawOf = (payload: Record<string, unknown>) => batchOf(payload).events.map((event) => event.raw as Record<string, unknown>);

const TWO_NIGHTS = [
  '2026-11-19T23:40:00-03:00|2026-11-20T03:10:00-03:00|Sueño esencial',
  '2026-11-20T03:10:00-03:00|2026-11-20T03:25:00-03:00|Despierto',
  '2026-11-20T03:25:00-03:00|2026-11-20T06:55:00-03:00|REM',
  '2026-11-20T22:30:00-03:00|2026-11-21T06:30:00-03:00|En cama',
  '2026-11-21T00:10:00-03:00|2026-11-21T04:10:00-03:00|Core',
  '2026-11-21T00:10:00-03:00|2026-11-21T04:10:00-03:00|Core',
  '2026-11-21T04:10:00-03:00|2026-11-21T06:10:00-03:00|Deep',
].join('\n');

test('a payload without batch fields is left to the single-night format', () => {
  assert.equal(appleHealth.toBatch?.({ date: '2026-11-21', sleep_hours: 7 }, RECEIVED_AT), null);
});

test('sleep stages become one night per wake day, without awake time and without counting two sources twice', () => {
  const nights = rawOf({ sleep_samples: TWO_NIGHTS });
  assert.deepEqual(
    nights.map((night) => [night.date, night.sleep_hours, night.sleep_basis]),
    [
      ['2026-11-20', 7, 'dormido'],
      ['2026-11-21', 6, 'dormido'],
    ],
  );
});

test('a phone that only records time in bed still gives a night, marked as such', () => {
  const [night] = rawOf({ sleep_samples: '2026-11-20T23:00:00-03:00|2026-11-21T06:30:00-03:00|In Bed' });
  assert.equal(night?.sleep_hours, 7.5);
  assert.equal(night?.sleep_basis, 'en_cama');
});

test('daily metrics are added or averaged per day and accept a decimal comma and a list', () => {
  const [first, second] = rawOf({
    steps_by_day: ['2026-11-20|4000', '2026-11-20T00:00:00-03:00|4421,0', '2026-11-21|10233'],
    resting_hr_by_day: '2026-11-20|57\n2026-11-20|59',
    hrv_by_day: '2026-11-21|48,6',
    active_energy_by_day: '2026-11-21|412,4',
    workouts: '2026-11-21T08:00:00-03:00|2026-11-21T08:45:00-03:00|Correr',
  });
  assert.deepEqual(first, { date: '2026-11-20', format: 2, resting_hr: 58, steps: 8421 });
  assert.deepEqual(second, { date: '2026-11-21', format: 2, hrv_ms: 48.6, steps: 10233, active_energy_kcal: 412, workouts: 1, workout_minutes: 45 });
});

test('each day carries a readable summary and a stable identifier', () => {
  const [event] = batchOf({ sleep_samples: TWO_NIGHTS, steps_by_day: '2026-11-20|8421' }).events;
  assert.equal(event?.summary, 'sueño 7.0 h · 8421 pasos');
  assert.equal(event?.externalId, 'dia:2026-11-20');
  assert.equal(event?.occurredAt, '2026-11-20');
});

test('lines that cannot be read are counted and days outside the window are dropped', () => {
  const batch = batchOf({ steps_by_day: '21 nov 2026|8421\n2026-11-20|ocho mil\n2025-01-01|5000\n2026-11-21|9000' });
  assert.equal(batch.ignored, 2);
  assert.equal(batch.ignoredSample, '21 nov 2026|8421');
  assert.deepEqual(
    batch.events.map((event) => event.occurredAt),
    ['2026-11-21'],
  );
});

test('sending several days stores one record per day and sending them again does not duplicate them', async () => {
  const ctx = createContext({ location: ':memory:' });
  const app = createApp(ctx);
  const ana = ctx.store.addPerson('Ana');
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const payload = { steps_by_day: `${yesterday}|8421\n${today}|3000` };

  const first = await app.request(`/api/ingest/health/${ana.token}`, send(payload));
  assert.equal(first.status, 201);
  const answer = (await first.json()) as { ok: boolean; days: number; from: string; to: string; message: string; summary: string };
  assert.equal(answer.days, 2);
  assert.equal(answer.from, yesterday);
  assert.equal(answer.to, today);
  assert.equal(answer.summary, '3000 pasos');
  assert.match(answer.message, /^Listo\. Llegaron 2 días de datos/);

  const again = await app.request(`/api/ingest/health/${ana.token}`, send({ steps_by_day: `${yesterday}|8421\n${today}|5200` }));
  assert.equal(again.status, 201);
  const events = ctx.store.listEvents(ana.token);
  assert.equal(events.length, 2);
  assert.deepEqual(
    events.map((event) => event.summary),
    ['5200 pasos', '8421 pasos'],
  );
});

test('a batch with nothing readable is refused and nothing is stored', async () => {
  const ctx = createContext({ location: ':memory:' });
  const app = createApp(ctx);
  const ana = ctx.store.addPerson('Ana');
  const response = await app.request(`/api/ingest/health/${ana.token}`, send({ steps_by_day: 'ayer|muchos' }));
  assert.equal(response.status, 400);
  const unreadable = 'No pudimos leer ningún dato de salud en el envío.';
  assert.deepEqual(await response.json(), { error: unreadable, message: unreadable, ignored: 1, example: 'ayer|muchos' });

  const empty = await app.request(`/api/ingest/health/${ana.token}`, send({ sleep_samples: '', steps_by_day: '', active_energy_by_day: '' }));
  assert.equal(empty.status, 400);
  assert.match(((await empty.json()) as { message: string }).message, /^Tu teléfono no mandó datos de salud/);

  const stranger = await app.request('/api/ingest/health/no-existe', send({ steps_by_day: '2026-11-21|100' }));
  assert.equal(stranger.status, 404);
  assert.deepEqual(await stranger.json(), { error: 'Link no válido.', message: 'Link no válido.' });
  assert.equal(ctx.store.listEvents(ana.token).length, 0);
});

test('the person page offers the shared shortcut only when the server knows its link', async () => {
  const shortcut = { url: 'https://www.icloud.com/shortcuts/abc123', name: 'Ronda Salud' };
  assert.deepEqual(loadConfig({ HEALTH_SHORTCUT_URL: ` ${shortcut.url} ` }).healthShortcut, shortcut);
  assert.deepEqual(loadConfig({ HEALTH_SHORTCUT_URL: shortcut.url, HEALTH_SHORTCUT_NAME: 'Salud de Ronda' }).healthShortcut, { ...shortcut, name: 'Salud de Ronda' });
  assert.equal(loadConfig({}).healthShortcut, null);
  assert.equal(loadConfig({ HEALTH_SHORTCUT_URL: 'javascript:alert(1)' }).healthShortcut, null);

  const pageOf = async (config: Config) => {
    const ctx = createContext({ location: ':memory:', config });
    const ana = ctx.store.addPerson('Ana');
    return (await (await createApp(ctx).request(`/api/people/${ana.token}`)).json()) as { healthShortcut: unknown };
  };
  assert.deepEqual((await pageOf({ publicBaseUrl: null, oauth: {}, healthShortcut: shortcut })).healthShortcut, shortcut);
  assert.equal((await pageOf({ publicBaseUrl: null, oauth: {} })).healthShortcut, null);
});
