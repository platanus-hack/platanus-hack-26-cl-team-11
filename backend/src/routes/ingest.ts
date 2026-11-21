import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { CONNECTORS } from '../connectors/registry.js';
import type { AppContext } from '../context.js';
import { asObject, NOT_FOUND } from './shared.js';

const MAX_BODY_BYTES = 1_000_000;

export function ingestRoutes({ store }: AppContext) {
  const routes = new Hono();

  routes.post('/ingest/:slug/:token', bodyLimit({ maxSize: MAX_BODY_BYTES }), async (c) => {
    const slug = c.req.param('slug');
    const connector = CONNECTORS.find((item) => item.kind === 'push' && item.ingestSlug === slug);
    const person = store.findPerson(c.req.param('token'));
    if (connector?.kind !== 'push' || !person) return c.json(NOT_FOUND, 404);
    const event = store.saveEvent(person.token, connector.toEvent(asObject(await c.req.text())));
    return c.json({ ok: true, id: event?.id ?? null, summary: event?.summary ?? null }, 201);
  });

  return routes;
}
