import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';
import type { ContextMap } from '../src/hub/map.js';

const setup = () => {
  const ctx = createContext({ location: ':memory:' });
  const person = ctx.store.addPerson('Ana Pérez');
  return { app: createApp(ctx), token: person.token };
};

const post = (body?: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const map = async (app: ReturnType<typeof createApp>, token: string) => (await (await app.request(`/api/context/${token}`)).json()) as ContextMap;

test('a new person sees every source unconnected and no links', async () => {
  const { app, token } = setup();
  const result = await map(app, token);
  assert.equal(result.mock, true);
  assert.equal(result.name, 'Ana Pérez');
  assert.ok(result.sources.length >= 8);
  assert.ok(result.sources.every((source) => !source.connected && source.items.length === 0 && source.lastUpdate === null));
  assert.deepEqual(result.links, []);
  assert.equal((await app.request('/api/context/nope')).status, 404);
});

test('connecting a source with mock data seeds its items and links sources that share a topic', async () => {
  const { app, token } = setup();
  assert.equal((await app.request(`/api/context/${token}/sources/granola`, post())).status, 201);
  assert.equal((await app.request(`/api/context/${token}/sources/calendar`, post())).status, 201);
  assert.equal((await app.request(`/api/context/${token}/sources/granola`, post())).status, 201);
  assert.equal((await app.request(`/api/context/${token}/sources/fax`, post())).status, 404);

  const result = await map(app, token);
  const granola = result.sources.find((source) => source.id === 'granola');
  assert.equal(granola?.connected, true);
  assert.equal(granola?.total, 3);
  assert.equal(granola?.lastUpdate, granola?.items[0]?.occurredAt);
  const link = result.links.find((item) => item.a === 'granola' && item.b === 'calendar');
  assert.ok(link?.topics.some((topic) => topic.id === 'grafo' && topic.label === 'El globo'));
});

test('an agent push connects its source, cleans the topics and becomes the last update', async () => {
  const { app, token } = setup();
  assert.equal((await app.request(`/api/context/${token}/push`, post({ source: 'claude' }))).status, 400);
  assert.equal((await app.request(`/api/context/${token}/push`, post({ source: 'fax', summary: 'x' }))).status, 400);
  const pushed = await app.request(`/api/context/${token}/push`, post({ source: 'claude', summary: '  Revisó el globo  ', topics: ['Grafo', 'grafo', 3, ''], occurredAt: 'ayer' }));
  assert.equal(pushed.status, 201);
  const item = (await pushed.json()) as { summary: string; topics: string[] };
  assert.equal(item.summary, 'Revisó el globo');
  assert.deepEqual(item.topics, ['grafo']);

  const claude = (await map(app, token)).sources.find((source) => source.id === 'claude');
  assert.equal(claude?.connected, true);
  assert.equal(claude?.total, 1);
  assert.equal(claude?.items[0]?.summary, 'Revisó el globo');
});

test('simulate adds one item from a connected source and does nothing when none is connected', async () => {
  const { app, token } = setup();
  assert.deepEqual(await (await app.request(`/api/context/${token}/simulate`, post())).json(), { item: null });
  await app.request(`/api/context/${token}/sources/apple-health`, post());
  const { item } = (await (await app.request(`/api/context/${token}/simulate`, post())).json()) as { item: { source: string } | null };
  assert.equal(item?.source, 'apple-health');
  assert.equal((await map(app, token)).sources.find((source) => source.id === 'apple-health')?.total, 4);
});

test('disconnecting removes the source and its items', async () => {
  const { app, token } = setup();
  await app.request(`/api/context/${token}/sources/gmail`, post());
  assert.equal((await app.request(`/api/context/${token}/sources/gmail`, { method: 'DELETE' })).status, 200);
  const gmail = (await map(app, token)).sources.find((source) => source.id === 'gmail');
  assert.equal(gmail?.connected, false);
  assert.equal(gmail?.total, 0);
});
