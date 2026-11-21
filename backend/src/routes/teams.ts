import { Hono } from 'hono';
import { publicIdOf } from '../codes.js';
import type { AppContext } from '../context.js';
import { rateLimit } from '../rateLimit.js';
import type { TeamInvite } from '../teams/store.js';
import { onboardingStepsOf } from './onboarding.js';
import { asObject, NOT_FOUND } from './shared.js';

const NOT_A_MEMBER = { error: 'No perteneces a ese equipo.' } as const;
const NOT_AN_ADMIN = { error: 'Solo quien administra el equipo puede hacer eso.' } as const;
const REQUEST_NOT_FOUND = { error: 'Esa solicitud no existe.' } as const;
const MEMBER_NOT_FOUND = { error: 'Esa persona no está en el equipo.' } as const;
const NOT_YOURSELF = { error: 'Para salir tú, usa «Salir del equipo».' } as const;
const INVITE_NOT_FOUND = { error: 'Esa invitación no existe o ya venció.' } as const;
const MISSING_NAME = { error: 'Falta el nombre.' } as const;
const MAX_NAME_LENGTH = 80;
const INVITE_JOINS_PER_MINUTE = 60;

export function teamRoutes(ctx: AppContext) {
  const { store, teams, rooms } = ctx;
  const routes = new Hono();
  const limitedJoins = rateLimit(INVITE_JOINS_PER_MINUTE);

  const viewInvite = (invite: TeamInvite) => ({ code: invite.code, path: `/invitacion/${invite.code}`, expiresAt: invite.expiresAt });

  const adminOf = (personToken: string, teamId: string) => {
    const person = store.findPerson(personToken);
    if (!person) return { problem: NOT_FOUND, status: 404 as const };
    if (!teams.isMember(teamId, person.token)) return { problem: NOT_A_MEMBER, status: 403 as const };
    if (!teams.isAdmin(teamId, person.token)) return { problem: NOT_AN_ADMIN, status: 403 as const };
    return { person };
  };

  const memberOf = (teamId: string, memberId: string) => teams.membersOf(teamId).find((member) => publicIdOf(member.token) === memberId);

  routes.post('/people/:token/teams', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const body = asObject(await c.req.text());
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return c.json({ error: 'Falta el nombre del equipo.' }, 400);
    const team = teams.createTeam(name.slice(0, MAX_NAME_LENGTH));
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
    const now = new Date();
    return c.json({
      teams: teams.teamsOf(person.token).map((team) => {
        const members = teams.membersOf(team.id);
        const admins = teams.adminsOf(team.id);
        const viewerIsAdmin = admins.includes(person.token);
        return {
          ...team,
          roomCode: rooms.roomOfTeam(team.id)?.code ?? null,
          members: members.map((member) => member.name),
          admin: viewerIsAdmin,
          people: members.map((member) => {
            const steps = viewerIsAdmin ? onboardingStepsOf(ctx, member.token) : null;
            return {
              id: publicIdOf(member.token),
              name: member.name,
              admin: admins.includes(member.token),
              me: member.token === person.token,
              pending: steps ? steps.filter((step) => !step.done).map((step) => step.id) : null,
            };
          }),
          invites: viewerIsAdmin ? teams.invitesOf(team.id, now).map(viewInvite) : [],
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

  routes.post('/people/:token/teams/:teamId/invites', (c) => {
    const teamId = c.req.param('teamId');
    const allowed = adminOf(c.req.param('token'), teamId);
    if (!allowed.person) return c.json(allowed.problem, allowed.status);
    return c.json(viewInvite(teams.createInvite(teamId, allowed.person.token, new Date())), 201);
  });

  routes.delete('/people/:token/teams/:teamId/invites/:code', (c) => {
    const teamId = c.req.param('teamId');
    const allowed = adminOf(c.req.param('token'), teamId);
    if (!allowed.person) return c.json(allowed.problem, allowed.status);
    teams.revokeInvite(teamId, c.req.param('code'));
    return c.json({ ok: true });
  });

  routes.delete('/people/:token/teams/:teamId/members/:memberId', (c) => {
    const teamId = c.req.param('teamId');
    const allowed = adminOf(c.req.param('token'), teamId);
    if (!allowed.person) return c.json(allowed.problem, allowed.status);
    const member = memberOf(teamId, c.req.param('memberId'));
    if (!member) return c.json(MEMBER_NOT_FOUND, 404);
    if (member.token === allowed.person.token) return c.json(NOT_YOURSELF, 400);
    teams.removeMember(teamId, member.token);
    return c.json({ ok: true });
  });

  routes.post('/people/:token/teams/:teamId/members/:memberId/admin', (c) => {
    const teamId = c.req.param('teamId');
    const allowed = adminOf(c.req.param('token'), teamId);
    if (!allowed.person) return c.json(allowed.problem, allowed.status);
    const member = memberOf(teamId, c.req.param('memberId'));
    if (!member) return c.json(MEMBER_NOT_FOUND, 404);
    teams.makeAdmin(teamId, member.token);
    return c.json({ ok: true });
  });

  routes.get('/invites/:code', (c) => {
    const invite = teams.findInvite(c.req.param('code'), new Date());
    const team = invite ? teams.findTeam(invite.teamId) : undefined;
    if (!invite || !team) return c.json(INVITE_NOT_FOUND, 404);
    return c.json({ team: team.name, people: teams.membersOf(team.id).length, expiresAt: invite.expiresAt });
  });

  routes.post('/invites/:code/join', limitedJoins, async (c) => {
    const invite = teams.findInvite(c.req.param('code'), new Date());
    const team = invite ? teams.findTeam(invite.teamId) : undefined;
    if (!invite || !team) return c.json(INVITE_NOT_FOUND, 404);
    const body = asObject(await c.req.text());
    const known = typeof body.token === 'string' ? store.findPerson(body.token) : undefined;
    if (typeof body.token === 'string' && !known) return c.json(NOT_FOUND, 404);
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME_LENGTH) : '';
    if (!known && !name) return c.json(MISSING_NAME, 400);
    const person = known ?? store.addPerson(name);
    const alreadyIn = teams.isMember(team.id, person.token);
    if (!alreadyIn) {
      teams.removeMember(team.id, person.token);
      teams.addMember(team.id, person.token);
    }
    return c.json({ token: person.token, name: person.name, team: { id: team.id, name: team.name } }, alreadyIn ? 200 : 201);
  });

  return routes;
}
