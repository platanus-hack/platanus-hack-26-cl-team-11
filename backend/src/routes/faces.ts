import { Hono } from 'hono';
import type { AppContext } from '../context.js';
import { openFaceStore, parseFaceLook } from '../faces.js';
import { NOT_FOUND } from './shared.js';

const INVALID_FACE = { error: 'Esa cara no se puede guardar.' } as const;

export function faceRoutes({ db, store, teams }: AppContext) {
  const routes = new Hono();
  const faces = openFaceStore(db);

  routes.get('/people/:token/face', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json({ face: faces.get(person.token) });
  });

  routes.put('/people/:token/face', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    let body: unknown;
    try {
      body = JSON.parse(await c.req.text());
    } catch {
      return c.json(INVALID_FACE, 400);
    }
    const look = parseFaceLook((body as { face?: unknown } | null)?.face);
    if (look === undefined) return c.json(INVALID_FACE, 400);
    return c.json({ face: faces.set(person.token, look) });
  });

  routes.get('/people/:token/faces', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const people = new Map<string, string>([[person.token, person.name]]);
    for (const team of teams.teamsOf(person.token)) for (const member of teams.membersOf(team.id)) people.set(member.token, member.name);
    const chosen = faces.many([...people.keys()]);
    return c.json({ faces: [...chosen].map(([token, face]) => ({ name: people.get(token) ?? '', face })) });
  });

  return routes;
}
