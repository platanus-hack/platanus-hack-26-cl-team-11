import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';

const TOO_LONG = { error: 'El contenido es demasiado largo.' };
const FILLER = 'x'.repeat(20_000);

const send = (method: string, body: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const setup = () => {
  const ctx = createContext({ location: ':memory:' });
  const app = createApp(ctx);
  const ana = ctx.store.addPerson('Ana');
  const team = ctx.teams.createTeam('Producto');
  ctx.teams.addMember(team.id, ana.token);
  return { ctx, app, ana, team };
};

test('creating a person refuses a body over the limit before reading it', async () => {
  const { ctx, app } = setup();
  const people = () => (ctx.db.prepare('SELECT COUNT(*) AS total FROM people').get() as { total: number }).total;
  const before = people();

  const response = await app.request('/api/people', send('POST', { name: 'Carla', filler: FILLER }));
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), TOO_LONG);
  assert.equal(people(), before);

  const declared = await app.request('/api/people', { method: 'POST', headers: { 'content-length': '2000000000' }, body: '{}' });
  assert.equal(declared.status, 413);
  assert.equal((await app.request('/api/people', send('POST', { name: 'Carla' }))).status, 201);
});

test('every write route with a body refuses one over the limit', async () => {
  const { ctx, app, ana, team } = setup();
  const proposal = (await (await app.request(`/api/people/${ana.token}/teams/${team.id}/board`, send('POST', { kind: 'propuesta', text: 'Demo el viernes' }))).json()) as { id: string };
  const oversized: Array<[string, string]> = [
    ['POST', `/api/people/${ana.token}/teams`],
    ['POST', `/api/people/${ana.token}/teams/join`],
    ['POST', `/api/people/${ana.token}/connections/github`],
    ['PUT', `/api/people/${ana.token}/policy`],
    ['POST', `/api/people/${ana.token}/teams/${team.id}/board`],
    ['POST', `/api/people/${ana.token}/board/${proposal.id}/replies`],
    ['POST', `/api/people/${ana.token}/board/${proposal.id}/votes`],
    ['POST', `/api/people/${ana.token}/checkins`],
  ];
  for (const [method, path] of oversized) {
    const response = await app.request(path, send(method, { name: 'Equipo', filler: FILLER }));
    assert.equal(response.status, 413, path);
    assert.deepEqual(await response.json(), TOO_LONG);
  }
  assert.equal(ctx.teams.teamsOf(ana.token).length, 1);
});

test('a health payload larger than the default limit is still accepted', async () => {
  const { ctx, app, ana } = setup();
  const response = await app.request(`/api/ingest/health/${ana.token}`, send('POST', { date: '2026-11-21', sleep_hours: 7, samples: FILLER }));
  assert.equal(response.status, 201);
  assert.equal(ctx.store.listEvents(ana.token).length, 1);
});
