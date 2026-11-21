import { Hono } from 'hono';
import type { AppContext } from '../context.js';
import { asObject, NOT_FOUND } from './shared.js';

const NOT_A_MEMBER = { error: 'No perteneces a ese equipo.' } as const;
const REQUEST_NOT_FOUND = { error: 'Esa solicitud no existe.' } as const;

export function teamRoutes({ store, teams, rooms }: AppContext) {
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
    const status = teams.requestJoin(team.id, person.token);
    return c.json({ id: team.id, name: team.name, status }, status === 'miembro' ? 201 : 202);
  });

  routes.post('/people/:token/teams/:teamId/requests/:requestId/approve', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const teamId = c.req.param('teamId');
    if (!teams.isMember(teamId, person.token)) return c.json(NOT_A_MEMBER, 403);
    const request = teams.findJoinRequest(c.req.param('requestId'));
    if (!request || request.teamId !== teamId) return c.json(REQUEST_NOT_FOUND, 404);
    return c.json({ ok: true, status: teams.approveJoin(request.id, person.token) });
  });

  routes.get('/people/:token/teams', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json({
      teams: teams.teamsOf(person.token).map((team) => {
        const members = teams.membersOf(team.id);
        return {
          ...team,
          roomCode: rooms.roomOfTeam(team.id)?.code ?? null,
          members: members.map((member) => member.name),
          requests: teams.joinRequestsOf(team.id).map((request) => ({
            id: request.id,
            name: request.name,
            approvals: members.filter((member) => request.approvedBy.includes(member.token)).length,
            needed: members.length,
            approvedByMe: request.approvedBy.includes(person.token),
          })),
        };
      }),
      pending: teams.pendingTeamsOf(person.token).map((team) => ({ id: team.id, name: team.name })),
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
