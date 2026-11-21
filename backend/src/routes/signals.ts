import { Hono } from 'hono';
import type { AppContext } from '../context.js';
import { deriveSignals } from '../signals.js';
import { NOT_FOUND } from './shared.js';

const SIGNAL_EVENT_LIMIT = 500;

export function signalRoutes({ store }: AppContext) {
  const routes = new Hono();

  routes.get('/people/:token/signals', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json({ name: person.name, signals: deriveSignals(store.listEvents(person.token, SIGNAL_EVENT_LIMIT), new Date()) });
  });

  return routes;
}
