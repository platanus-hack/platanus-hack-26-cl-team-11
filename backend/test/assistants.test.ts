import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { openAssistantStore, PAIRING_MINUTES } from '../src/assistants/store.js';
import { createContext } from '../src/context.js';

const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });
const BASE_URL = 'https://ronda.example';

interface PairingView {
  code: string;
  path: string;
  expiresAt: string;
  minutes: number;
}

interface JoinView {
  token: string;
  assistant: { id: string; kind: string; label: string };
  person: { name: string };
}

const setup = () => {
  const ctx = createContext({ location: ':memory:', model: null, config: { publicBaseUrl: `${BASE_URL}/`, oauth: {} } });
  const app = createApp(ctx);
  const ana = ctx.store.addPerson('Ana Pérez');
  const pair = async () => (await (await app.request(`/api/people/${ana.token}/assistants/pairings`, json({}))).json()) as PairingView;
  return { ctx, app, ana, pair };
};

test('a person makes a link, the agent reads the join document and trades the code for its own token', async () => {
  const { app, ana, pair } = setup();
  assert.equal((await app.request('/api/people/nope/assistants/pairings', json({}))).status, 404);
  const pairing = await pair();
  assert.match(pairing.code, /^[2-9A-Z]{8}$/);
  assert.equal(pairing.path, `/a/${pairing.code}`);
  assert.equal(pairing.minutes, PAIRING_MINUTES);

  const doc = await app.request(pairing.path);
  assert.equal(doc.status, 200);
  assert.match(doc.headers.get('content-type') ?? '', /^text\/markdown/);
  const text = await doc.text();
  assert.ok(text.includes(`${BASE_URL}/api/assistants/join`));
  assert.ok(text.includes(`"code":"${pairing.code}"`));
  assert.ok(text.includes('Ana Pérez'));
  assert.ok(!text.includes(`${BASE_URL}//`));
  assert.ok(!text.includes(ana.token));

  const joined = await app.request('/api/assistants/join', json({ code: pairing.code.toLowerCase(), kind: 'claude-code', label: ' Claude Code en el MacBook ' }));
  assert.equal(joined.status, 201);
  const join = (await joined.json()) as JoinView;
  assert.match(join.token, /^rda_/);
  assert.deepEqual({ kind: join.assistant.kind, label: join.assistant.label, person: join.person.name }, { kind: 'claude-code', label: 'Claude Code en el MacBook', person: 'Ana Pérez' });

  const me = await app.request('/api/assistants/me', bearer(join.token));
  assert.equal(me.status, 200);
  assert.equal(((await me.json()) as { person: { name: string } }).person.name, 'Ana Pérez');
  assert.equal((await app.request('/api/assistants/me')).status, 401);
  assert.equal((await app.request('/api/assistants/me', bearer('rda_nope'))).status, 401);
  assert.equal((await app.request('/api/assistants/me', bearer(ana.token))).status, 401);
});

test('a code works once, a new link cancels the one before, and an unknown kind joins as otro', async () => {
  const { app, pair } = setup();
  const first = await pair();
  const second = await pair();
  assert.equal((await app.request('/api/assistants/join', json({ code: first.code, kind: 'codex' }))).status, 404);
  assert.equal((await app.request(first.path)).status, 404);

  const joined = (await (await app.request('/api/assistants/join', json({ code: second.code, kind: 'un-robot' }))).json()) as JoinView;
  assert.deepEqual({ kind: joined.assistant.kind, label: joined.assistant.label }, { kind: 'otro', label: 'Asistente' });
  assert.equal((await app.request('/api/assistants/join', json({ code: second.code, kind: 'codex' }))).status, 410);
  const spent = await app.request(second.path);
  assert.equal(spent.status, 410);
  assert.match(await spent.text(), /already used/);
  assert.equal((await app.request('/api/assistants/join', json({}))).status, 404);
});

test('a code stops working after fifteen minutes', () => {
  const { ctx, ana } = setup();
  const pairing = ctx.assistants.createPairing(ana.token);
  const later = openAssistantStore(ctx.db, () => new Date(Date.now() + (PAIRING_MINUTES + 1) * 60_000));
  assert.equal(later.pairingState(pairing.code).state, 'vencido');
  assert.equal(later.redeem(pairing.code, 'codex', 'Codex').state, 'vencido');
  assert.equal(ctx.assistants.redeem(pairing.code, 'codex', 'Codex').state, 'vigente');
});

test('the person sees her connected assistants without their tokens and can cut one off', async () => {
  const { app, ana, pair } = setup();
  const join = (await (await app.request('/api/assistants/join', json({ code: (await pair()).code, kind: 'codex' }))).json()) as JoinView;
  const listedText = await (await app.request(`/api/people/${ana.token}/assistants`)).text();
  const listed = JSON.parse(listedText) as { assistants: Array<{ id: string; kind: string; label: string }> };
  assert.deepEqual(
    listed.assistants.map((assistant) => ({ kind: assistant.kind, label: assistant.label })),
    [{ kind: 'codex', label: 'Codex' }],
  );
  assert.ok(!listedText.includes(join.token));

  assert.equal((await app.request(`/api/people/${ana.token}/assistants/asi_nope`, { method: 'DELETE' })).status, 404);
  assert.equal((await app.request(`/api/people/${ana.token}/assistants/${join.assistant.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await app.request('/api/assistants/me', bearer(join.token))).status, 401);
  assert.deepEqual(((await (await app.request(`/api/people/${ana.token}/assistants`)).json()) as { assistants: unknown[] }).assistants, []);
});

test('when the person is in a room, the room sees the assistant connect', async () => {
  const { app, ana, pair } = setup();
  const room = (await (await app.request('/api/rooms', json({ name: 'Hack', token: ana.token }))).json()) as { code: string };
  await app.request('/api/assistants/join', json({ code: (await pair()).code, kind: 'chatgpt' }));
  const state = (await (await app.request(`/api/rooms/${room.code}/state`)).json()) as { people: Array<{ assistants: string[] }> };
  assert.deepEqual(state.people[0]?.assistants, ['chatgpt']);
  const events = (await (await app.request(`/api/rooms/${room.code}/events`)).json()) as { events: Array<{ type: string; payload: { kind?: string } }> };
  assert.deepEqual(
    events.events.map((event) => event.type),
    ['persona_entra', 'asistente_conecta'],
  );
  assert.equal(events.events[1]?.payload.kind, 'chatgpt');
});
