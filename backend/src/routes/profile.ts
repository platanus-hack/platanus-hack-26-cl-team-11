import { Hono } from 'hono';
import type { AppContext } from '../context.js';
import { MAX_PROFILE_TEXT_LENGTH, openProfileStore, type Profile } from '../profile.js';
import { asObject, NOT_FOUND } from './shared.js';

const FIELDS = ['goal', 'guide'] as const;
const INVALID_TEXT = { error: 'La meta y el tema deben ser texto.' } as const;

export function profileRoutes({ db, store }: AppContext) {
  const routes = new Hono();
  const profiles = openProfileStore(db);

  routes.get('/people/:token/profile', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json(profiles.get(person.token));
  });

  routes.put('/people/:token/profile', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const body = asObject(await c.req.text());
    const changes: Partial<Profile> = {};
    for (const field of FIELDS) {
      const value = body[field];
      if (value === undefined) continue;
      if (value !== null && typeof value !== 'string') return c.json(INVALID_TEXT, 400);
      changes[field] = value === null ? null : [...value.trim()].slice(0, MAX_PROFILE_TEXT_LENGTH).join('') || null;
    }
    return c.json(profiles.set(person.token, changes));
  });

  return routes;
}
