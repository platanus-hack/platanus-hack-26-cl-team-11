import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';
import { seedDemo } from '../src/seed.js';

const send = (method: string, body: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

function setup() {
  const ctx = createContext({ location: ':memory:', model: null, config: { publicBaseUrl: null, oauth: {} } });
  const app = createApp(ctx);
  const people = seedDemo(ctx);
  return { ctx, app, token: people[0]?.token ?? '' };
}

test('the globe opens live until an operator switches it to the demo', async () => {
  const { app, token } = setup();
  assert.deepEqual(await (await app.request('/api/mesa/globe')).json(), { mode: 'mesa' });

  const changed = await app.request(`/api/admin/${token}/globe`, send('PUT', { mode: 'demo' }));
  assert.equal(changed.status, 200);
  assert.deepEqual(await (await app.request('/api/mesa/globe')).json(), { mode: 'demo' });

  const invalid = await app.request(`/api/admin/${token}/globe`, send('PUT', { mode: 'otro' }));
  assert.equal(invalid.status, 400);
});

test('the panel lists recent rounds with their full conversations', async () => {
  const { ctx, app, token } = setup();
  const round = ctx.agents.startRound('mesa-publica', token);
  assert.ok(round);
  const people = ctx.store.listPeople();
  const thread = ctx.agents.addThread({ roundId: round.id, requesterToken: people[0]!.token, helperToken: people[1]!.token, topic: 'pagos' });
  ctx.agents.addMessage(thread, people[0]!.token, 'Hola, ¿me ayudas con pagos?');
  ctx.agents.finishRound(round.id, 'lista', null);

  const panel = (await (await app.request(`/api/admin/${token}`)).json()) as { globeMode: string; rounds: Array<{ id: string; threads: number }> };
  assert.equal(panel.globeMode, 'mesa');
  assert.equal(panel.rounds[0]?.id, round.id);
  assert.equal(panel.rounds[0]?.threads, 1);

  const detail = (await (await app.request(`/api/admin/${token}/rounds/${round.id}`)).json()) as { threads: Array<{ messages: Array<{ text: string }> }> };
  assert.equal(detail.threads[0]?.messages[0]?.text, 'Hola, ¿me ayudas con pagos?');

  assert.equal((await app.request(`/api/admin/nadie`)).status, 404);
});
