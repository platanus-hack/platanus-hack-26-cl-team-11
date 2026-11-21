import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { openStore } from '../src/db.js';
import { appleHealthEvent } from '../src/connectors/appleHealth.js';

const setup = () => {
  const store = openStore(':memory:');
  return { store, app: createApp(store) };
};

const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('apple health summary reads text numbers with a decimal comma', () => {
  const event = appleHealthEvent({ date: '2026-11-21', sleep_hours: '5,2', resting_hr: 58, steps: 4312 });
  assert.equal(event.summary, 'sueño 5.2 h · pulso en reposo 58 lpm · 4312 pasos');
  assert.equal(event.occurredAt, '2026-11-21');
});

test('apple health keeps a payload with no known fields', () => {
  const event = appleHealthEvent({ other: 1 }, '2026-11-21T10:00:00.000Z');
  assert.equal(event.summary, 'datos de salud recibidos sin campos reconocidos');
  assert.equal(event.occurredAt, '2026-11-21T10:00:00.000Z');
  assert.deepEqual(event.raw, { other: 1 });
});

test('creating a person requires a name', async () => {
  const { app } = setup();
  assert.equal((await app.request('/api/people', json({ name: '  ' }))).status, 400);
  const created = await app.request('/api/people', json({ name: 'Ana' }));
  assert.equal(created.status, 201);
  const person = (await created.json()) as { token: string; name: string };
  assert.equal(person.name, 'Ana');
  assert.ok(person.token.length >= 20);
});

test('health ingest stores the event and marks the source as connected', async () => {
  const { app, store } = setup();
  const { token } = store.addPerson('Ana');

  const ingest = await app.request(`/api/ingest/health/${token}`, json({ date: '2026-11-21', sleep_hours: 6.4 }));
  assert.equal(ingest.status, 201);

  const page = (await (await app.request(`/api/people/${token}`)).json()) as {
    name: string;
    healthIngestPath: string;
    sources: Array<{ id: string; sync: { total: number } | null }>;
    events: Array<{ summary: string }>;
  };
  assert.equal(page.name, 'Ana');
  assert.equal(page.healthIngestPath, `/api/ingest/health/${token}`);
  assert.equal(page.sources.find((source) => source.id === 'apple_health')?.sync?.total, 1);
  assert.equal(page.sources.find((source) => source.id === 'gmail')?.sync, null);
  assert.equal(page.events[0]?.summary, 'sueño 6.4 h');
});

test('a body that is not JSON is stored instead of rejected', async () => {
  const { app, store } = setup();
  const { token } = store.addPerson('Ana');
  const response = await app.request(`/api/ingest/health/${token}`, { method: 'POST', body: 'hola' });
  assert.equal(response.status, 201);
  assert.deepEqual(store.listEvents(token)[0]?.raw, { unparsed_text: 'hola' });
});

test('an unknown token gets 404 and one person never sees another', async () => {
  const { app, store } = setup();
  const ana = store.addPerson('Ana');
  const tomas = store.addPerson('Tomás');
  await app.request(`/api/ingest/health/${ana.token}`, json({ sleep_hours: 5 }));

  assert.equal((await app.request('/api/ingest/health/nope', json({}))).status, 404);
  assert.equal((await app.request('/api/people/nope')).status, 404);
  const events = (await (await app.request(`/api/people/${tomas.token}/events`)).json()) as { events: unknown[] };
  assert.equal(events.events.length, 0);
});
