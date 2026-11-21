import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { createContext, type AppContext } from '../src/context.js';
import { checkinRoutes } from '../src/routes/checkins.js';
import { deriveSignals, type Signals } from '../src/signals.js';

const DAY_MS = 86_400_000;
const NOTE = 'Dormí pésimo y tengo la cabeza en otra parte.';
const BLOCKER = 'Acceso a la base de staging';

const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const appOf = (ctx: AppContext) => new Hono().route('/api', checkinRoutes(ctx));
const checkinEvents = (ctx: AppContext, token: string) => ctx.store.listEvents(token, 500).filter((event) => event.source === 'checkin');

test('a valid check-in is stored and changes the derived signals', async () => {
  const ctx = createContext({ location: ':memory:' });
  const app = appOf(ctx);
  const ana = ctx.store.addPerson('Ana');

  const before = deriveSignals(ctx.store.listEvents(ana.token, 500), new Date());
  assert.equal(before.energy.level, 'sin_datos');
  assert.deepEqual(before.blockers, []);

  const response = await app.request(`/api/people/${ana.token}/checkins`, json({ mood: 'cansada', blocker: `  ${BLOCKER}  `, note: NOTE }));
  assert.equal(response.status, 201);
  const text = await response.text();
  const body = JSON.parse(text) as { ok: boolean; signals: Signals };

  assert.equal(body.ok, true);
  assert.equal(body.signals.energy.level, 'baja');
  assert.deepEqual(body.signals.energy.basis, ['checkin']);
  assert.equal(body.signals.blockers.length, 1);
  assert.equal(body.signals.blockers[0]?.source, 'checkin');
  assert.equal(body.signals.blockers[0]?.topic, BLOCKER);
  assert.ok(!text.includes(ana.token));
  assert.ok(!text.includes(NOTE));

  const stored = checkinEvents(ctx, ana.token);
  assert.equal(stored.length, 1);
  assert.equal(stored[0]?.type, 'checkin');
  assert.deepEqual(stored[0]?.raw, { mood: 'cansada', blocker: BLOCKER, note: NOTE });
  assert.ok(Number.isFinite(Date.parse(stored[0]?.occurredAt ?? '')));
  assert.ok(!stored[0]?.summary.includes(NOTE));
  assert.ok(!stored[0]?.summary.includes('\n'));
});

test('empty optional text is stored as null', async () => {
  const ctx = createContext({ location: ':memory:' });
  const app = appOf(ctx);
  const ana = ctx.store.addPerson('Ana');

  assert.equal((await app.request(`/api/people/${ana.token}/checkins`, json({ mood: 'bien', blocker: '   ', note: '' }))).status, 201);
  assert.equal((await app.request(`/api/people/${ana.token}/checkins`, json({ mood: 'normal' }))).status, 201);

  const stored = checkinEvents(ctx, ana.token);
  assert.equal(stored.length, 2);
  for (const event of stored) {
    const raw = event.raw as { blocker: unknown; note: unknown };
    assert.equal(raw.blocker, null);
    assert.equal(raw.note, null);
  }
});

test('an invalid mood is rejected and stores nothing', async () => {
  const ctx = createContext({ location: ':memory:' });
  const app = appOf(ctx);
  const ana = ctx.store.addPerson('Ana');

  for (const body of [{ mood: 'feliz' }, { mood: 'Bien' }, { mood: ' bien ' }, { mood: 3 }, { mood: null }, { note: NOTE }, {}]) {
    const response = await app.request(`/api/people/${ana.token}/checkins`, json(body));
    assert.equal(response.status, 400);
    assert.equal(typeof ((await response.json()) as { error: unknown }).error, 'string');
  }
  const unparsed = await app.request(`/api/people/${ana.token}/checkins`, { method: 'POST', body: 'mood=bien' });
  assert.equal(unparsed.status, 400);

  assert.deepEqual(ctx.store.listEvents(ana.token, 500), []);
});

test('over-long or non-text free text is rejected and stores nothing', async () => {
  const ctx = createContext({ location: ':memory:' });
  const app = appOf(ctx);
  const ana = ctx.store.addPerson('Ana');
  const atLimit = 'a'.repeat(280);
  const overLimit = 'a'.repeat(281);

  assert.equal((await app.request(`/api/people/${ana.token}/checkins`, json({ mood: 'bien', blocker: overLimit }))).status, 400);
  assert.equal((await app.request(`/api/people/${ana.token}/checkins`, json({ mood: 'bien', note: overLimit }))).status, 400);
  assert.equal((await app.request(`/api/people/${ana.token}/checkins`, json({ mood: 'bien', note: 42 }))).status, 400);
  assert.equal((await app.request(`/api/people/${ana.token}/checkins`, json({ mood: 'bien', blocker: ['x'] }))).status, 400);
  assert.deepEqual(ctx.store.listEvents(ana.token, 500), []);

  assert.equal((await app.request(`/api/people/${ana.token}/checkins`, json({ mood: 'bien', blocker: `  ${atLimit}  `, note: atLimit }))).status, 201);
  assert.deepEqual(checkinEvents(ctx, ana.token)[0]?.raw, { mood: 'bien', blocker: atLimit, note: atLimit });
});

test('check-in routes reject an unknown person', async () => {
  const ctx = createContext({ location: ':memory:' });
  const app = appOf(ctx);

  const posted = await app.request('/api/people/nope/checkins', json({ mood: 'bien' }));
  assert.equal(posted.status, 404);
  assert.deepEqual(await posted.json(), { error: 'Link no válido.' });

  const listed = await app.request('/api/people/nope/checkins');
  assert.equal(listed.status, 404);
  assert.deepEqual(await listed.json(), { error: 'Link no válido.' });
});

test('one person never sees the check-ins of another', async () => {
  const ctx = createContext({ location: ':memory:' });
  const app = appOf(ctx);
  const ana = ctx.store.addPerson('Ana');
  const tomas = ctx.store.addPerson('Tomás');

  await app.request(`/api/people/${ana.token}/checkins`, json({ mood: 'mal', blocker: BLOCKER, note: NOTE }));
  await app.request(`/api/people/${tomas.token}/checkins`, json({ mood: 'bien' }));

  const tomasText = await (await app.request(`/api/people/${tomas.token}/checkins`)).text();
  const tomasCheckins = JSON.parse(tomasText) as Array<{ at: string; mood: string; blocker: string | null; note: string | null }>;
  assert.equal(tomasCheckins.length, 1);
  assert.deepEqual({ ...tomasCheckins[0], at: null }, { at: null, mood: 'bien', blocker: null, note: null });
  assert.ok(!tomasText.includes(BLOCKER));
  assert.ok(!tomasText.includes(NOTE));
  assert.ok(!tomasText.includes(ana.token));
  assert.ok(!tomasText.includes(tomas.token));

  const anaCheckins = (await (await app.request(`/api/people/${ana.token}/checkins`)).json()) as Array<{ mood: string; blocker: string | null; note: string | null }>;
  assert.equal(anaCheckins.length, 1);
  assert.equal(anaCheckins[0]?.mood, 'mal');
  assert.equal(anaCheckins[0]?.blocker, BLOCKER);
  assert.equal(anaCheckins[0]?.note, NOTE);
});

test('the list returns the last 14 check-ins, newest first, and nothing from other sources', async () => {
  const ctx = createContext({ location: ':memory:' });
  const app = appOf(ctx);
  const ana = ctx.store.addPerson('Ana');
  const start = Date.now() - 20 * DAY_MS;
  const momentOf = (day: number) => new Date(start + day * DAY_MS).toISOString();

  for (let day = 0; day < 16; day += 1) {
    ctx.store.saveEvent(ana.token, { source: 'checkin', type: 'checkin', occurredAt: momentOf(day), summary: 'Check-in: normal', raw: { mood: 'normal', blocker: null, note: `día ${day}` } });
  }
  ctx.store.saveEvent(ana.token, { source: 'github', type: 'pull_request', occurredAt: momentOf(16), summary: 'PR', raw: { mood: 'bien', title: 'Pagos' } });

  const listed = (await (await app.request(`/api/people/${ana.token}/checkins`)).json()) as Array<{ at: string; mood: string; note: string | null }>;
  assert.equal(listed.length, 14);
  assert.deepEqual(
    listed.map((entry) => entry.note),
    Array.from({ length: 14 }, (_, index) => `día ${15 - index}`),
  );
  assert.equal(listed[0]?.at, momentOf(15));
  assert.ok(listed.every((entry) => entry.mood === 'normal'));
});
