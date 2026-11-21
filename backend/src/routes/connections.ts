import { Hono } from 'hono';
import { findConnector } from '../connectors/registry.js';
import type { AppContext } from '../context.js';
import { syncSource } from '../sync.js';
import { asObject, NOT_FOUND } from './shared.js';

export function connectionRoutes(ctx: AppContext) {
  const routes = new Hono();
  const { store } = ctx;

  routes.post('/people/:token/connections/:source', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const connector = findConnector(c.req.param('source'));
    if (connector?.kind !== 'key') return c.json({ error: 'Esa fuente no se conecta con llave.' }, 400);
    const body = asObject(await c.req.text());
    const secret = typeof body.secret === 'string' ? body.secret.trim() : '';
    if (!secret) return c.json({ error: 'Falta la llave.' }, 400);
    const account = await connector.identify(secret, ctx.fetch);
    store.saveConnection(person.token, connector.id, account, secret);
    const imported = await syncSource(ctx, person.token, connector.id);
    return c.json({ ok: true, account, imported }, 201);
  });

  routes.post('/people/:token/connections/:source/sync', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json({ ok: true, imported: await syncSource(ctx, person.token, c.req.param('source')) });
  });

  routes.delete('/people/:token/connections/:source', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    store.removeConnection(person.token, c.req.param('source'));
    return c.json({ ok: true });
  });

  return routes;
}
