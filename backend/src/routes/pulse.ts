import { Hono } from 'hono';
import type { AppContext } from '../context.js';
import { isVisibility, openPolicyStore, SIGNAL_KEYS, type Policy } from '../policy/store.js';
import { teamPulse } from '../pulse.js';
import { deriveSignals } from '../signals.js';
import { asObject, NOT_FOUND } from './shared.js';

const NOT_A_MEMBER = { error: 'No perteneces a ese equipo.' } as const;
const INVALID_VISIBILITY = { error: 'Cada permiso debe ser siempre, preguntar o nunca.' } as const;
const INVALID_PULSE_FLAG = { error: 'La participación en el pulso debe ser verdadera o falsa.' } as const;

export function pulseRoutes({ db, store, teams }: AppContext) {
  const routes = new Hono();
  const policies = openPolicyStore(db);

  routes.get('/people/:token/policy', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json(policies.get(person.token));
  });

  routes.put('/people/:token/policy', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const body = asObject(await c.req.text());
    const changes: Partial<Policy> = {};
    for (const key of SIGNAL_KEYS) {
      const value = body[key];
      if (value === undefined) continue;
      if (!isVisibility(value)) return c.json(INVALID_VISIBILITY, 400);
      changes[key] = value;
    }
    if (body.includeInPulse !== undefined) {
      if (typeof body.includeInPulse !== 'boolean') return c.json(INVALID_PULSE_FLAG, 400);
      changes.includeInPulse = body.includeInPulse;
    }
    return c.json(policies.set(person.token, changes));
  });

  routes.get('/people/:token/teams/:teamId/pulse', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const team = teams.findTeam(c.req.param('teamId'));
    if (!team || !teams.isMember(team.id, person.token)) return c.json(NOT_A_MEMBER, 403);
    const now = new Date();
    const members = teams.membersOf(team.id);
    const others = members
      .filter((member) => member.token !== person.token)
      .map((member) => ({
        signals: deriveSignals(store.listSignalEvents(member.token, now), now),
        policy: policies.get(member.token),
      }));
    return c.json({ team: team.name, members: members.length, pulse: teamPulse(others) });
  });

  return routes;
}
