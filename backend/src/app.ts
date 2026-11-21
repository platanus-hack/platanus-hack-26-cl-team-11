import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { appleHealthEvent } from './connectors/appleHealth.js';
import type { Store } from './db.js';
import { SOURCES, type JsonObject } from './types.js';

const MAX_BODY_BYTES = 1_000_000;

const asObject = (text: string): JsonObject => {
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as JsonObject) : { value: parsed };
  } catch {
    return { unparsed_text: text };
  }
};

export function createApp(store: Store) {
  const api = new Hono();

  api.get('/health', (c) => c.json({ ok: true }));

  api.post('/people', async (c) => {
    const body = asObject(await c.req.text());
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return c.json({ error: 'Falta el nombre.' }, 400);
    return c.json(store.addPerson(name.slice(0, 80)), 201);
  });

  api.get('/people/:token', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json({ error: 'Link no válido.' }, 404);
    const sync = store.syncBySource(person.token);
    return c.json({
      name: person.name,
      healthIngestPath: `/api/ingest/health/${person.token}`,
      publicBaseUrl: process.env.PUBLIC_BASE_URL || null,
      sources: SOURCES.map((source) => ({ ...source, sync: sync[source.id] ?? null })),
      events: store.listEvents(person.token, 10),
    });
  });

  api.get('/people/:token/events', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json({ error: 'Link no válido.' }, 404);
    return c.json({ name: person.name, events: store.listEvents(person.token) });
  });

  api.post('/ingest/health/:token', bodyLimit({ maxSize: MAX_BODY_BYTES }), async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json({ error: 'Link no válido.' }, 404);
    const event = store.saveEvent(person.token, appleHealthEvent(asObject(await c.req.text())));
    return c.json({ ok: true, id: event.id, summary: event.summary }, 201);
  });

  return new Hono().route('/api', api);
}
