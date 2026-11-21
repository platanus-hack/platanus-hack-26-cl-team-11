import { Hono } from 'hono';
import type { AppContext } from '../context.js';
import { openPolicyStore, withChosenVisibility } from '../policy/store.js';
import { deriveSignals } from '../signals.js';
import { NOT_FOUND } from './shared.js';

export function signalRoutes({ db, store }: AppContext) {
  const routes = new Hono();
  const policies = openPolicyStore(db);

  routes.get('/people/:token/signals', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const now = new Date();
    const signals = withChosenVisibility(deriveSignals(store.listSignalEvents(person.token, now), now), policies.chosen(person.token));
    return c.json({ name: person.name, signals });
  });

  return routes;
}
