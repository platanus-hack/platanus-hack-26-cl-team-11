import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';
import type { Signals } from '../src/signals.js';

type App = ReturnType<typeof createApp>;

const DAY_MS = 86_400_000;

const send = (method: string, body: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const setup = () => {
  const ctx = createContext({ location: ':memory:' });
  const { token } = ctx.store.addPerson('Ana');
  const updatedAt = new Date(Date.now() - 5 * DAY_MS).toISOString();
  ctx.store.saveEvent(token, {
    source: 'linear',
    type: 'tarea',
    externalId: `issue-1:${updatedAt}`,
    occurredAt: updatedAt,
    summary: 'VIT-1 Migrar cobros · En progreso',
    raw: { identifier: 'VIT-1', title: 'Migrar cobros', stateType: 'started', updatedAt },
  });
  return { app: createApp(ctx), token };
};

const signalsOf = async (app: App, token: string) => ((await (await app.request(`/api/people/${token}/signals`)).json()) as { signals: Signals }).signals;
const checkin = async (app: App, token: string) =>
  ((await (await app.request(`/api/people/${token}/checkins`, send('POST', { mood: 'normal', blocker: 'Acceso a staging' }))).json()) as { signals: Signals }).signals;
const visibilityBySource = (signals: Signals) => Object.fromEntries(signals.blockers.map((blocker) => [blocker.source, blocker.visibility]));

test('signals carry the permission the person stored, in the signals route and in the check-in answer', async () => {
  const { app, token } = setup();
  const saved = await app.request(`/api/people/${token}/policy`, send('PUT', { energy: 'nunca', blockers: 'nunca', expertise: 'nunca' }));
  assert.equal(saved.status, 200);

  for (const signals of [await checkin(app, token), await signalsOf(app, token)]) {
    assert.equal(signals.energy.visibility, 'nunca');
    assert.equal(signals.load.visibility, 'preguntar');
    assert.deepEqual(visibilityBySource(signals), { checkin: 'nunca', linear: 'nunca' });
    assert.deepEqual(signals.visibility, { energy: 'nunca', load: 'preguntar', blockers: 'nunca', expertise: 'nunca' });
  }
});

test('a permission the person never chose keeps the default of each signal', async () => {
  const { app, token } = setup();
  const untouched = await checkin(app, token);
  assert.deepEqual(visibilityBySource(untouched), { checkin: 'preguntar', linear: 'siempre' });
  assert.deepEqual(untouched.visibility, { energy: 'preguntar', load: 'preguntar', blockers: 'siempre', expertise: 'siempre' });

  await app.request(`/api/people/${token}/policy`, send('PUT', { load: 'siempre', includeInPulse: false }));
  const partial = await signalsOf(app, token);
  assert.equal(partial.load.visibility, 'siempre');
  assert.equal(partial.energy.visibility, 'preguntar');
  assert.deepEqual(visibilityBySource(partial), { checkin: 'preguntar', linear: 'siempre' });
  assert.deepEqual(partial.visibility, { energy: 'preguntar', load: 'siempre', blockers: 'siempre', expertise: 'siempre' });
});
