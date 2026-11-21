import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createVault } from '../src/crypto.js';
import { createContext } from '../src/context.js';
import type { Fetch } from '../src/types.js';

const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const fakeFetch = (routes: Record<string, unknown>, seen: string[] = []): Fetch =>
  (async (input: Parameters<Fetch>[0], init?: Parameters<Fetch>[1]) => {
    const url = String(input);
    const auth = new Headers(init?.headers).get('authorization') ?? '';
    seen.push(url);
    if (auth.includes('bad')) return new Response('{}', { status: 401 });
    const match = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    return match ? Response.json(routes[match]) : new Response('{}', { status: 404 });
  }) as Fetch;

const granolaRoutes = {
  'https://public-api.granola.ai/v1/notes/not_1': {
    id: 'not_1',
    title: 'Planificación',
    owner: { name: 'Ana', email: 'ana@example.com' },
    created_at: recent,
    web_url: 'https://notes.granola.ai/d/x',
    attendees: [{ name: 'Ana', email: 'ana@example.com' }, { name: 'Tomás', email: 'tomas@example.com' }],
    summary_text: 'Se acordó el plan.',
    calendar_event: { scheduled_start_time: recent, scheduled_end_time: recent },
  },
  'https://public-api.granola.ai/v1/notes': {
    notes: [{ id: 'not_1', title: 'Planificación', owner: { name: 'Ana', email: 'ana@example.com' }, created_at: recent }],
    hasMore: false,
    cursor: null,
  },
};

const connect = (secret: string) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret }) });

test('the vault round-trips a secret and never stores it in the clear', () => {
  const vault = createVault(null);
  const sealed = vault.seal('ghp_secret');
  assert.ok(!sealed.includes('ghp_secret'));
  assert.equal(vault.open(sealed), 'ghp_secret');
  assert.notEqual(vault.seal('ghp_secret'), sealed);
});

test('connecting Granola imports the meeting note without the transcript', async () => {
  const seen: string[] = [];
  const ctx = createContext({ location: ':memory:', fetch: fakeFetch(granolaRoutes, seen) });
  const { store } = ctx;
  const app = createApp(ctx);
  const { token } = store.addPerson('Ana');

  const response = await app.request(`/api/people/${token}/connections/granola`, connect('grn_good'));
  assert.deepEqual(await response.json(), { ok: true, account: 'ana@example.com', imported: 1 });
  assert.equal(store.listEvents(token)[0]?.summary, 'Planificación · 2 asistentes');
  assert.ok(seen.every((url) => !url.includes('transcript')));

  const again = await app.request(`/api/people/${token}/connections/granola/sync`, { method: 'POST' });
  assert.deepEqual(await again.json(), { ok: true, imported: 0 });
  assert.equal(store.listEvents(token).length, 1);
});

test('a rejected key is reported and nothing is stored', async () => {
  const ctx = createContext({ location: ':memory:', fetch: fakeFetch(granolaRoutes) });
  const { store } = ctx;
  const app = createApp(ctx);
  const { token } = store.addPerson('Ana');

  const response = await app.request(`/api/people/${token}/connections/granola`, connect('bad'));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Granola rechazó la llave.' });
  assert.equal(store.findConnection(token, 'granola'), undefined);
});

test('the person page shows the account but never the secret', async () => {
  const ctx = createContext({ location: ':memory:', fetch: fakeFetch(granolaRoutes) });
  const { store } = ctx;
  const app = createApp(ctx);
  const { token } = store.addPerson('Ana');
  await app.request(`/api/people/${token}/connections/granola`, connect('grn_good'));

  const text = await (await app.request(`/api/people/${token}`)).text();
  assert.ok(text.includes('"account":"ana@example.com"'));
  assert.ok(!text.includes('grn_good'));
});

test('disconnecting removes the connection and its events', async () => {
  const ctx = createContext({ location: ':memory:', fetch: fakeFetch(granolaRoutes) });
  const { store } = ctx;
  const app = createApp(ctx);
  const { token } = store.addPerson('Ana');
  await app.request(`/api/people/${token}/connections/granola`, connect('grn_good'));
  assert.equal(store.listEvents(token).length, 1);

  const response = await app.request(`/api/people/${token}/connections/granola`, { method: 'DELETE' });
  assert.equal(response.status, 200);
  assert.equal(store.findConnection(token, 'granola'), undefined);
  assert.equal(store.listEvents(token).length, 0);
});

test('sources that do not take a key are refused without calling them or storing anything', async () => {
  const seen: string[] = [];
  const ctx = createContext({ location: ':memory:', fetch: fakeFetch({}, seen) });
  const { store } = ctx;
  const app = createApp(ctx);
  const { token } = store.addPerson('Ana');
  for (const source of ['apple_health', 'gmail', 'google_calendar', 'github', 'linear']) {
    const response = await app.request(`/api/people/${token}/connections/${source}`, connect('una-llave'));
    assert.equal(response.status, 400, source);
    assert.deepEqual(await response.json(), { error: 'Esa fuente no se conecta con llave.' });
  }
  assert.deepEqual(seen, []);
  assert.deepEqual(store.listConnections(token), []);
});
