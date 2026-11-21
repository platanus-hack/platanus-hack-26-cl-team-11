import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';

const put = (body: unknown) => ({ method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const look = { kind: 'almendra', size: 'grande', glasses: 'redondo', brow: null, mark: 'pecas', lashes: false, tone: 4 };

test('cada persona guarda su cara, la borra y su equipo la ve', async () => {
  const ctx = createContext({ location: ':memory:' });
  const ana = ctx.store.addPerson('Ana');
  const beto = ctx.store.addPerson('Beto');
  const extra = ctx.store.addPerson('Carla');
  const team = ctx.teams.createTeam('Equipo');
  ctx.teams.addMember(team.id, ana.token);
  ctx.teams.addMember(team.id, beto.token);
  const app = createApp(ctx);
  const path = (token: string, end: string) => `/api/people/${token}/${end}`;

  assert.deepEqual(await (await app.request(path(ana.token, 'face'))).json(), { face: null });
  assert.deepEqual(await (await app.request(path(ana.token, 'face'), put({ face: look }))).json(), { face: look });
  await app.request(path(extra.token, 'face'), put({ face: { ...look, tone: 1 } }));

  assert.deepEqual(await (await app.request(path(beto.token, 'faces'))).json(), { faces: [{ name: 'Ana', face: look }] });
  assert.equal((await app.request(path(ana.token, 'face'), put({ face: { ...look, kind: 'cuadrado' } }))).status, 400);
  assert.equal((await app.request(path(ana.token, 'face'), put({ face: { ...look, tone: 11 } }))).status, 400);
  assert.deepEqual(await (await app.request(path(ana.token, 'face'), put({ face: null }))).json(), { face: null });
  assert.deepEqual(await (await app.request(path(beto.token, 'faces'))).json(), { faces: [] });
  assert.equal((await app.request('/api/people/nadie/face')).status, 404);
});
