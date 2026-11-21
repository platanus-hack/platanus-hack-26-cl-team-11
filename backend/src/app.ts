import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { appleHealthEvent } from './connectors/appleHealth.js';
import { KEY_CONNECTORS } from './connectors/index.js';
import type { Store } from './db.js';
import { syncSource } from './sync.js';
import { ConnectorError, SOURCES, type Fetch, type JsonObject, type SourceId } from './types.js';

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

const isSourceId = (value: string): value is SourceId => SOURCES.some((source) => source.id === value);

export function createApp(store: Store, fetchImpl: Fetch = fetch) {
  const api = new Hono();

  api.onError((failure, c) => {
    if (failure instanceof ConnectorError) return c.json({ error: failure.message }, failure.status as ContentfulStatusCode);
    console.error(failure);
    return c.json({ error: 'Error interno.' }, 500);
  });

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
    const connections = store.listConnections(person.token);
    return c.json({
      name: person.name,
      healthIngestPath: `/api/ingest/health/${person.token}`,
      publicBaseUrl: process.env.PUBLIC_BASE_URL || null,
      sources: SOURCES.map((source) => {
        const connection = connections.find((item) => item.source === source.id);
        return {
          ...source,
          sync: sync[source.id] ?? null,
          connection: connection ? { account: connection.account, lastSyncedAt: connection.lastSyncedAt, lastError: connection.lastError } : null,
        };
      }),
      events: store.listEvents(person.token, 12),
    });
  });

  api.get('/people/:token/events', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json({ error: 'Link no válido.' }, 404);
    return c.json({ name: person.name, events: store.listEvents(person.token) });
  });

  api.post('/people/:token/connections/:source', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    const source = c.req.param('source');
    if (!person) return c.json({ error: 'Link no válido.' }, 404);
    const connector = isSourceId(source) ? KEY_CONNECTORS[source] : undefined;
    if (!connector || !isSourceId(source)) return c.json({ error: 'Esa fuente no se conecta con llave.' }, 400);
    const body = asObject(await c.req.text());
    const secret = typeof body.secret === 'string' ? body.secret.trim() : '';
    if (!secret) return c.json({ error: 'Falta la llave.' }, 400);
    const account = await connector.identify(secret, fetchImpl);
    store.saveConnection(person.token, source, account, secret);
    const imported = await syncSource(store, person.token, source, fetchImpl);
    return c.json({ ok: true, account, imported }, 201);
  });

  api.post('/people/:token/connections/:source/sync', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    const source = c.req.param('source');
    if (!person) return c.json({ error: 'Link no válido.' }, 404);
    if (!isSourceId(source)) return c.json({ error: 'Fuente desconocida.' }, 400);
    return c.json({ ok: true, imported: await syncSource(store, person.token, source, fetchImpl) });
  });

  api.delete('/people/:token/connections/:source', (c) => {
    const person = store.findPerson(c.req.param('token'));
    const source = c.req.param('source');
    if (!person) return c.json({ error: 'Link no válido.' }, 404);
    if (!isSourceId(source)) return c.json({ error: 'Fuente desconocida.' }, 400);
    store.removeConnection(person.token, source);
    return c.json({ ok: true });
  });

  api.post('/ingest/health/:token', bodyLimit({ maxSize: MAX_BODY_BYTES }), async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json({ error: 'Link no válido.' }, 404);
    const event = store.saveEvent(person.token, appleHealthEvent(asObject(await c.req.text())));
    return c.json({ ok: true, id: event?.id ?? null, summary: event?.summary ?? null }, 201);
  });

  return new Hono().route('/api', api);
}
