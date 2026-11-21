import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createVault } from '../src/crypto.js';
import { openStore } from '../src/db.js';
import type { Fetch } from '../src/types.js';

const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

const fakeFetch = (routes: Record<string, unknown>, seen: string[] = []): Fetch =>
  (async (input: Parameters<Fetch>[0], init?: Parameters<Fetch>[1]) => {
    const url = String(input);
    const auth = new Headers(init?.headers).get('authorization') ?? '';
    seen.push(url);
    if (auth.includes('bad')) return new Response('{}', { status: 401 });
    const match = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    return match ? Response.json(routes[match]) : new Response('{}', { status: 404 });
  }) as Fetch;

const githubRoutes = {
  'https://api.github.com/user/': {},
  'https://api.github.com/users/ana/events': [
    { id: '1', type: 'PushEvent', created_at: recent, repo: { name: 'acme/pagos' }, payload: { size: 3 } },
    { id: '2', type: 'PullRequestEvent', created_at: recent, repo: { name: 'acme/pagos' }, payload: { action: 'closed', pull_request: { title: 'Webhook', merged: true } } },
    { id: '3', type: 'WatchEvent', created_at: recent, repo: { name: 'acme/otro' }, payload: {} },
    { id: '4', type: 'PushEvent', created_at: old, repo: { name: 'acme/viejo' }, payload: { size: 1 } },
  ],
  'https://api.github.com/user': { login: 'ana' },
};

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

test('connecting GitHub imports recent pushes and pull requests once', async () => {
  const store = openStore(':memory:');
  const app = createApp(store, fakeFetch(githubRoutes));
  const { token } = store.addPerson('Ana');

  const first = await app.request(`/api/people/${token}/connections/github`, connect('ghp_good'));
  assert.equal(first.status, 201);
  assert.deepEqual(await first.json(), { ok: true, account: 'ana', imported: 2 });

  const again = await app.request(`/api/people/${token}/connections/github/sync`, { method: 'POST' });
  assert.deepEqual(await again.json(), { ok: true, imported: 0 });

  const summaries = store.listEvents(token).map((event) => event.summary).sort();
  assert.deepEqual(summaries, ['3 commits en acme/pagos', 'PR mergeado en acme/pagos: Webhook']);
});

test('connecting Granola imports the meeting note without the transcript', async () => {
  const store = openStore(':memory:');
  const seen: string[] = [];
  const app = createApp(store, fakeFetch(granolaRoutes, seen));
  const { token } = store.addPerson('Ana');

  const response = await app.request(`/api/people/${token}/connections/granola`, connect('grn_good'));
  assert.deepEqual(await response.json(), { ok: true, account: 'ana@example.com', imported: 1 });
  assert.equal(store.listEvents(token)[0]?.summary, 'Planificación · 2 asistentes');
  assert.ok(seen.every((url) => !url.includes('transcript')));
});

test('a rejected key is reported and nothing is stored', async () => {
  const store = openStore(':memory:');
  const app = createApp(store, fakeFetch(githubRoutes));
  const { token } = store.addPerson('Ana');

  const response = await app.request(`/api/people/${token}/connections/github`, connect('bad'));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'GitHub rechazó la llave.' });
  assert.equal(store.findConnection(token, 'github'), undefined);
});

test('the person page shows the account but never the secret', async () => {
  const store = openStore(':memory:');
  const app = createApp(store, fakeFetch(githubRoutes));
  const { token } = store.addPerson('Ana');
  await app.request(`/api/people/${token}/connections/github`, connect('ghp_good'));

  const text = await (await app.request(`/api/people/${token}`)).text();
  assert.ok(text.includes('"account":"ana"'));
  assert.ok(!text.includes('ghp_good'));
});

test('disconnecting removes the connection and its events', async () => {
  const store = openStore(':memory:');
  const app = createApp(store, fakeFetch(githubRoutes));
  const { token } = store.addPerson('Ana');
  await app.request(`/api/people/${token}/connections/github`, connect('ghp_good'));

  const response = await app.request(`/api/people/${token}/connections/github`, { method: 'DELETE' });
  assert.equal(response.status, 200);
  assert.equal(store.findConnection(token, 'github'), undefined);
  assert.equal(store.listEvents(token).length, 0);
});

test('sources that do not take a key are refused', async () => {
  const store = openStore(':memory:');
  const app = createApp(store, fakeFetch({}));
  const { token } = store.addPerson('Ana');
  assert.equal((await app.request(`/api/people/${token}/connections/apple_health`, connect('x'))).status, 400);
  assert.equal((await app.request(`/api/people/${token}/connections/gmail`, connect('x'))).status, 400);
});
