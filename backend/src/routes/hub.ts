import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppContext } from '../context.js';
import { findHubSource } from '../hub/catalog.js';
import { buildMap, connectMock, simulatePush } from '../hub/map.js';
import { asObject, NOT_FOUND } from './shared.js';

const MAX_BODY_BYTES = 20_000;
const MAX_SUMMARY = 200;
const MAX_TOPICS = 6;
const UNKNOWN_SOURCE = { error: 'Esa fuente no existe.' } as const;

export const cleanTopics = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((topic): topic is string => typeof topic === 'string').map((topic) => topic.trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, MAX_TOPICS)
    : [];

const validDate = (value: unknown, fallback: Date) => {
  if (typeof value !== 'string') return fallback.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
};

export function hubRoutes({ store, hub }: AppContext) {
  const routes = new Hono();

  routes.get('/context/:token', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json(buildMap(hub, person.token, person.name));
  });

  routes.post('/context/:token/sources/:source', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const connection = connectMock(hub, person.token, person.name, c.req.param('source'), new Date());
    if (!connection) return c.json(UNKNOWN_SOURCE, 404);
    return c.json(connection, 201);
  });

  routes.delete('/context/:token/sources/:source', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    if (!findHubSource(c.req.param('source'))) return c.json(UNKNOWN_SOURCE, 404);
    hub.disconnect(person.token, c.req.param('source'));
    return c.json({ ok: true });
  });

  routes.post('/context/:token/push', bodyLimit({ maxSize: MAX_BODY_BYTES }), async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const body = asObject(await c.req.text());
    const source = typeof body.source === 'string' ? findHubSource(body.source) : undefined;
    if (!source) return c.json(UNKNOWN_SOURCE, 400);
    const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, MAX_SUMMARY) : '';
    if (!summary) return c.json({ error: 'Falta el resumen.' }, 400);
    const now = new Date();
    if (!hub.connections(person.token).some((connection) => connection.source === source.id)) hub.connect(person.token, source.id, source.account(person.name));
    const item = hub.addItem(person.token, { source: source.id, summary, topics: cleanTopics(body.topics), occurredAt: validDate(body.occurredAt, now) });
    return c.json(item, 201);
  });

  routes.post('/context/:token/simulate', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json({ item: simulatePush(hub, person.token, new Date()) });
  });

  return routes;
}
