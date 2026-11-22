import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';
import { seedDemo } from '../src/seed.js';
import { deriveSignals } from '../src/signals.js';
import { deriveSummary } from '../src/summary.js';

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

test('an operator takes a person out of the mesa and brings them back', async () => {
  const { ctx, app, token } = setup();
  const panel = (await (await app.request(`/api/admin/${token}`)).json()) as { people: Array<{ id: string; name: string; member: boolean; signedIn: boolean }> };
  const other = panel.people[1];
  assert.ok(other?.member);
  assert.equal(other.signedIn, false);

  const out = await app.request(`/api/admin/${token}/people/${other.id}/membership`, send('PUT', { member: false }));
  assert.deepEqual(await out.json(), { id: other.id, name: other.name, member: false });
  const after = (await (await app.request(`/api/admin/${token}`)).json()) as { people: Array<{ id: string; member: boolean }> };
  assert.equal(after.people.find((person) => person.id === other.id)?.member, false);
  assert.equal(ctx.mesa.hasLeft(token), false);

  const back = await app.request(`/api/admin/${token}/people/${other.id}/membership`, send('PUT', { member: true }));
  assert.equal(((await back.json()) as { member: boolean }).member, true);
  assert.equal((await app.request(`/api/admin/${token}/people/nadie/membership`, send('PUT', { member: false }))).status, 404);
  assert.equal((await app.request(`/api/admin/${token}/people/${other.id}/membership`, send('PUT', {}))).status, 400);
});

test('an operator leaves the whole mesa tired for the demo and undoes it', async () => {
  const { ctx, app, token } = setup();
  const loaded = await app.request(`/api/admin/${token}/tired`, send('PUT', { tired: true }));
  assert.equal(loaded.status, 200);
  const now = new Date();
  const events = ctx.store.listSignalEvents(token, now);
  const signals = deriveSignals(events, now);
  const summary = deriveSummary(events, signals, now);
  assert.equal(signals.energy.level, 'baja');
  assert.equal(signals.load.level, 'alta');
  assert.ok((summary.sleep.lastHours ?? 9) < 5);
  assert.ok((summary.move.steps ?? 9000) < 3000);

  await app.request(`/api/admin/${token}/tired`, send('PUT', { tired: true }));
  const undone = (await (await app.request(`/api/admin/${token}/tired`, send('PUT', { tired: false }))).json()) as { cleared: number };
  assert.equal(undone.cleared, 9 * ctx.store.listPeople().filter((person) => !ctx.sim.isSynthetic(person.token)).length);
  assert.equal((await app.request(`/api/admin/${token}/tired`, send('PUT', {}))).status, 400);
});

test('an operator copies what one person publishes into another for the demo and takes it back', async () => {
  const { ctx, app, token } = setup();
  const panel = (await (await app.request(`/api/admin/${token}`)).json()) as { people: Array<{ id: string; name: string }> };
  const [source, target] = [panel.people[1]!, panel.people[2]!];
  const people = ctx.store.listPeople();
  const tokenOf = (name: string) => people.find((person) => person.name === name)!.token;
  ctx.repo.commit(tokenOf(source.name), { by: 'asistente', message: 'Lo que sabe', topics: [], files: [{ path: 'sabe.md', content: `${source.name} sabe de pagos.`, share: 'siempre' }, { path: 'privado.md', content: 'No sale.', share: 'nunca' }], remove: [] });

  const copied = await app.request(`/api/admin/${token}/people/${target.id}/demo`, send('PUT', { from: source.id }));
  assert.deepEqual(await copied.json(), { id: target.id, name: target.name, files: 1 });
  assert.equal(ctx.repo.read(tokenOf(target.name), 'demo/sabe.md')?.content, `${target.name} sabe de pagos.`);
  assert.equal(ctx.repo.read(tokenOf(target.name), 'demo/privado.md'), undefined);

  await app.request(`/api/admin/${token}/people/${target.id}/demo`, send('PUT', {}));
  assert.equal(ctx.repo.read(tokenOf(target.name), 'demo/sabe.md'), undefined);
  assert.equal((await app.request(`/api/admin/${token}/people/nadie/demo`, send('PUT', {}))).status, 404);
});
