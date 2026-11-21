import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';

const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('a person creates a team, another asks to join with the code and enters once approved, and members never see tokens', async () => {
  const ctx = createContext({ location: ':memory:' });
  const app = createApp(ctx);
  const ana = ctx.store.addPerson('Ana');
  const tomas = ctx.store.addPerson('Tomás');

  const created = await app.request(`/api/people/${ana.token}/teams`, json({ name: 'Producto' }));
  assert.equal(created.status, 201);
  const team = (await created.json()) as { id: string; joinCode: string };

  assert.equal((await app.request(`/api/people/${tomas.token}/teams/join`, json({ joinCode: 'nope' }))).status, 404);
  assert.equal((await app.request(`/api/people/${tomas.token}/teams/join`, json({ joinCode: team.joinCode }))).status, 202);
  assert.ok(!ctx.teams.isMember(team.id, tomas.token));
  const listed = (await (await app.request(`/api/people/${ana.token}/teams`)).json()) as { teams: Array<{ requests: Array<{ id: string; name: string }> }> };
  const request = listed.teams[0]?.requests[0];
  assert.equal(request?.name, 'Tomás');
  assert.equal((await app.request(`/api/people/${ana.token}/teams/${team.id}/requests/${request?.id}/approve`, json({}))).status, 200);

  const text = await (await app.request(`/api/people/${tomas.token}/teams`)).text();
  assert.deepEqual((JSON.parse(text) as { teams: Array<{ members: string[] }> }).teams[0]?.members, ['Ana', 'Tomás']);
  assert.ok(!text.includes(ana.token));
  assert.ok(ctx.teams.isMember(team.id, tomas.token));
});

test('leaving a team removes the membership', async () => {
  const ctx = createContext({ location: ':memory:' });
  const app = createApp(ctx);
  const ana = ctx.store.addPerson('Ana');
  const team = ctx.teams.createTeam('Producto');
  ctx.teams.addMember(team.id, ana.token);

  assert.equal((await app.request(`/api/people/${ana.token}/teams/${team.id}`, { method: 'DELETE' })).status, 200);
  assert.deepEqual(ctx.teams.teamsOf(ana.token), []);
});

test('team routes reject an unknown person and an empty name', async () => {
  const ctx = createContext({ location: ':memory:' });
  const app = createApp(ctx);
  const ana = ctx.store.addPerson('Ana');
  assert.equal((await app.request('/api/people/nope/teams', json({ name: 'X' }))).status, 404);
  assert.equal((await app.request(`/api/people/${ana.token}/teams`, json({ name: ' ' }))).status, 400);
});
