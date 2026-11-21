import { Hono } from 'hono';
import { CONNECTORS } from '../connectors/registry.js';
import type { AppContext } from '../context.js';
import { openDeliveryStore } from '../deliveries.js';
import { asObject, NOT_FOUND } from './shared.js';

const RECENT_EVENTS = 12;

export function peopleRoutes({ db, store, config }: AppContext) {
  const routes = new Hono();
  const deliveries = openDeliveryStore(db);

  routes.post('/people', async (c) => {
    const body = asObject(await c.req.text());
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return c.json({ error: 'Falta el nombre.' }, 400);
    return c.json(store.addPerson(name.slice(0, 80)), 201);
  });

  routes.get('/people/:token', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const sync = store.syncBySource(person.token);
    const connections = store.listConnections(person.token);
    const delivered = deliveries.latestBySource(person.token);
    const health = CONNECTORS.find((connector) => connector.kind === 'push');
    return c.json({
      name: person.name,
      healthIngestPath: health?.kind === 'push' ? `/api/ingest/${health.ingestSlug}/${person.token}` : null,
      publicBaseUrl: config.publicBaseUrl,
      healthShortcut: config.healthShortcut ?? null,
      sources: CONNECTORS.map((connector) => {
        const connection = connections.find((item) => item.source === connector.id);
        return {
          id: connector.id,
          label: connector.label,
          how: connector.how,
          connect: connector.kind,
          provider: connector.kind === 'oauth' ? connector.provider : null,
          configured: connector.kind !== 'oauth' || Boolean(config.oauth[connector.provider]),
          sync: sync[connector.id] ?? null,
          delivery: delivered[connector.id] ?? null,
          connection: connection ? { account: connection.account, lastSyncedAt: connection.lastSyncedAt, lastError: connection.lastError } : null,
        };
      }),
      events: store.listLatestReceived(person.token, RECENT_EVENTS),
    });
  });

  routes.get('/people/:token/events', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json({ name: person.name, events: store.listEvents(person.token) });
  });

  return routes;
}
