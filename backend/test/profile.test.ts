import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';

const put = (body: unknown) => ({ method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('la meta personal y el tema de guía se guardan, se leen y se borran', async () => {
  const ctx = createContext({ location: ':memory:' });
  const { token } = ctx.store.addPerson('Ana');
  const app = createApp(ctx);
  const path = `/api/people/${token}/profile`;

  assert.deepEqual(await (await app.request(path)).json(), { goal: null, guide: null });
  assert.deepEqual(await (await app.request(path, put({ goal: '  Dormir 7 horas  ' }))).json(), { goal: 'Dormir 7 horas', guide: null });
  assert.deepEqual(await (await app.request(path, put({ guide: 'Pagos' }))).json(), { goal: 'Dormir 7 horas', guide: 'Pagos' });
  assert.deepEqual(await (await app.request(path, put({ goal: '' }))).json(), { goal: null, guide: 'Pagos' });
  assert.equal((await app.request(path, put({ goal: 7 }))).status, 400);
  assert.equal((await app.request('/api/people/nadie/profile')).status, 404);
});
