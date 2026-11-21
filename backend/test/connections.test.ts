import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createVault } from '../src/crypto.js';
import { createContext } from '../src/context.js';
import type { Fetch } from '../src/types.js';

const fakeFetch = (seen: string[] = []): Fetch =>
  (async (input: Parameters<Fetch>[0]) => {
    seen.push(String(input));
    return new Response('{}', { status: 404 });
  }) as Fetch;

const connect = (secret: string) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret }) });

test('the vault round-trips a secret and never stores it in the clear', () => {
  const vault = createVault(null);
  const sealed = vault.seal('ghp_secret');
  assert.ok(!sealed.includes('ghp_secret'));
  assert.equal(vault.open(sealed), 'ghp_secret');
  assert.notEqual(vault.seal('ghp_secret'), sealed);
});

test('sources that do not take a key are refused without calling them or storing anything', async () => {
  const seen: string[] = [];
  const ctx = createContext({ location: ':memory:', fetch: fakeFetch(seen) });
  const { store } = ctx;
  const app = createApp(ctx);
  const { token } = store.addPerson('Ana');
  for (const source of ['apple_health', 'gmail', 'google_calendar', 'github', 'linear', 'granola']) {
    const response = await app.request(`/api/people/${token}/connections/${source}`, connect('una-llave'));
    assert.equal(response.status, 400, source);
    assert.deepEqual(await response.json(), { error: 'Esa fuente no se conecta con llave.' });
  }
  assert.deepEqual(seen, []);
  assert.deepEqual(store.listConnections(token), []);
});
