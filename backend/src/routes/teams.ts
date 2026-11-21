import { Hono } from 'hono';
import type { AppContext } from '../context.js';
import { asObject, NOT_FOUND } from './shared.js';

export function teamRoutes({ store, teams }: AppContext) {
  const routes = new Hono();

  routes.post('/people/:token/teams', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const body = asObject(await c.req.text());
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return c.json({ error: 'Falta el nombre del equipo.' }, 400);
    const team = teams.createTeam(name.slice(0, 80));
    teams.addMember(team.id, person.token);
    return c.json(team, 201);
  });

  routes.post('/people/:token/teams/join', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const body = asObject(await c.req.text());
    const team = typeof body.joinCode === 'string' ? teams.findTeamByJoinCode(body.joinCode.trim()) : undefined;
    if (!team) return c.json({ error: 'Ese código de equipo no existe.' }, 404);
    teams.addMember(team.id, person.token);
    return c.json({ id: team.id, name: team.name }, 201);
  });

  routes.get('/people/:token/teams', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json({
      teams: teams.teamsOf(person.token).map((team) => ({
        ...team,
        members: teams.membersOf(team.id).map((member) => member.name),
      })),
    });
  });

  routes.delete('/people/:token/teams/:teamId', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    teams.removeMember(c.req.param('teamId'), person.token);
    return c.json({ ok: true });
  });

  return routes;
}
