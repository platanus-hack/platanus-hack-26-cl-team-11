import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';

const send = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const setup = () => {
  const ctx = createContext({ location: ':memory:', model: null });
  const app = createApp(ctx);
  const ana = ctx.store.addPerson('Ana');
  const stepsOf = async () => (await (await app.request(`/api/people/${ana.token}/onboarding`)).json()) as { steps: Array<{ id: string; done: boolean }>; pending: number };
  return { ctx, app, ana, stepsOf };
};

test('a new person starts with every first step pending, in the order they are walked through', async () => {
  const { stepsOf } = setup();
  const { steps, pending } = await stepsOf();
  assert.deepEqual(
    steps.map((step) => [step.id, step.done]),
    [
      ['equipo', false],
      ['agente', false],
      ['checkin', false],
      ['salud', false],
    ],
  );
  assert.equal(pending, 4);
});

test('each first step is marked done by the thing the person actually did', async () => {
  const { ctx, app, ana, stepsOf } = setup();
  const team = ctx.teams.createTeam('Producto');
  ctx.teams.addMember(team.id, ana.token);
  assert.equal((await app.request(`/api/people/${ana.token}/checkins`, send({ mood: 'bien' }))).status, 201);
  const today = new Date().toISOString().slice(0, 10);
  assert.equal((await app.request(`/api/ingest/health/${ana.token}`, send({ steps_by_day: `${today}|4200` }))).status, 201);

  const { steps, pending } = await stepsOf();
  assert.deepEqual(
    steps.filter((step) => step.done).map((step) => step.id),
    ['equipo', 'checkin', 'salud'],
  );
  assert.equal(pending, 1);
});

test('the first steps of a link that does not exist are not found', async () => {
  const { app } = setup();
  assert.equal((await app.request('/api/people/no-existe/onboarding')).status, 404);
});
