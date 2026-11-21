import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext, type AppContext } from '../src/context.js';
import type { Signals } from '../src/signals.js';

type App = ReturnType<typeof createApp>;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const FLOOD = 500;

const post = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const dayAgo = (days: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date(Date.now() - days * DAY_MS));

const setup = () => {
  const ctx = createContext({ location: ':memory:' });
  const { token } = ctx.store.addPerson('Ana');
  return { ctx, app: createApp(ctx), token };
};

const floodWithMail = (ctx: AppContext, token: string) => {
  for (let index = 0; index < FLOOD; index += 1) {
    const sentAt = ago(index * 2 * MINUTE_MS);
    ctx.store.saveEvent(token, { source: 'gmail', type: 'correo', externalId: `mail-${index}`, occurredAt: sentAt, summary: `Aviso ${index} · de avisos@example.com`, raw: { subject: `Aviso ${index}`, from: 'avisos@example.com', date: sentAt } });
  }
};

const staleTask = (ctx: AppContext, token: string) => {
  const updatedAt = ago(5 * DAY_MS);
  ctx.store.saveEvent(token, {
    source: 'linear',
    type: 'tarea',
    externalId: `issue-1:${updatedAt}`,
    occurredAt: updatedAt,
    summary: 'VIT-1 Migrar cobros · En progreso',
    raw: { identifier: 'VIT-1', title: 'Migrar cobros', stateType: 'started', state: 'En progreso', updatedAt, createdAt: updatedAt, dueDate: null },
  });
};

const signalsOf = async (app: App, token: string) => ((await (await app.request(`/api/people/${token}/signals`)).json()) as { signals: Signals }).signals;

test('a started task with no updates stays a blocker after hundreds of newer events arrive', async () => {
  const { ctx, app, token } = setup();
  staleTask(ctx, token);
  const before = await signalsOf(app, token);
  assert.deepEqual(before.blockers.map((blocker) => [blocker.source, blocker.topic]), [['linear', 'Migrar cobros']]);
  assert.deepEqual(before.load.basis, ['linear']);

  floodWithMail(ctx, token);
  const after = await signalsOf(app, token);
  assert.deepEqual(after.blockers, before.blockers);
  assert.deepEqual(after.load, before.load);

  const checkin = (await (await app.request(`/api/people/${token}/checkins`, post({ mood: 'normal' }))).json()) as { signals: Signals };
  assert.deepEqual(checkin.signals.blockers.map((blocker) => blocker.topic), ['Migrar cobros']);
});

test('the own sleep baseline survives hundreds of newer events', async () => {
  const { ctx, app, token } = setup();
  for (let day = 10; day >= 1; day -= 1) await app.request(`/api/ingest/health/${token}`, post({ date: dayAgo(day), sleep_hours: 8 }));
  await app.request(`/api/ingest/health/${token}`, post({ date: dayAgo(0), sleep_hours: 6.5 }));
  const before = await signalsOf(app, token);
  assert.equal(before.energy.level, 'baja');
  assert.deepEqual(before.energy.basis, ['apple_health']);

  floodWithMail(ctx, token);
  assert.deepEqual((await signalsOf(app, token)).energy, before.energy);
});

test('the team pulse reads the same events as the signals of each member', async () => {
  const { ctx, app, token } = setup();
  const team = ctx.teams.createTeam('Producto');
  const others = ['Tomás', 'Beto', 'Carla'].map((name) => ctx.store.addPerson(name));
  for (const member of [token, ...others.map((person) => person.token)]) ctx.teams.addMember(team.id, member);
  for (const person of others) {
    staleTask(ctx, person.token);
    floodWithMail(ctx, person.token);
  }

  const body = (await (await app.request(`/api/people/${token}/teams/${team.id}/pulse`)).json()) as { pulse: { blockersOpen: unknown; load: unknown } };
  assert.deepEqual(body.pulse.blockersOpen, { available: true, total: 3, contributors: 3 });
  assert.deepEqual(body.pulse.load, { available: true, level: 'baja', contributors: 3 });
});

test('the person page lists what was received last, not the meetings scheduled furthest ahead', async () => {
  const { ctx, app, token } = setup();
  for (let index = 1; index <= 12; index += 1) {
    const start = new Date(Date.now() + index * 60 * MINUTE_MS).toISOString();
    ctx.store.saveEvent(token, { source: 'google_calendar', type: 'reunion', externalId: `meeting-${index}`, occurredAt: start, summary: `Reunión ${index} · 30 min`, raw: { id: `meeting-${index}`, start } });
  }
  await app.request(`/api/ingest/health/${token}`, post({ date: dayAgo(0), sleep_hours: 7 }));

  const page = (await (await app.request(`/api/people/${token}`)).json()) as { events: Array<{ source: string; summary: string }> };
  assert.equal(page.events.length, 12);
  assert.equal(page.events[0]?.source, 'apple_health');
  assert.equal(page.events[1]?.summary, 'Reunión 12 · 30 min');
});
