import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';

interface PersonView {
  id: string;
  name: string;
  admin: boolean;
  me: boolean;
  pending: string[] | null;
}

interface TeamView {
  id: string;
  admin: boolean;
  members: string[];
  people: PersonView[];
  invites: Array<{ code: string; path: string; expiresAt: string }>;
}

const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const remove = { method: 'DELETE' };

async function setup() {
  const ctx = createContext({ location: ':memory:', model: null, whatsapp: null });
  const app = createApp(ctx);
  const ana = ctx.store.addPerson('Ana');
  const tomas = ctx.store.addPerson('Tomás');
  const created = (await (await app.request(`/api/people/${ana.token}/teams`, json({ name: 'Vita' }))).json()) as { id: string };
  ctx.teams.addMember(created.id, tomas.token);
  const teamOf = async (token: string) => ((await (await app.request(`/api/people/${token}/teams`)).json()) as { teams: TeamView[] }).teams[0] as TeamView;
  const idOf = async (name: string) => (await teamOf(ana.token)).people.find((person) => person.name === name)?.id ?? '';
  return { ctx, app, ana, tomas, teamId: created.id, teamOf, idOf };
}

test('whoever creates the team administers it and is the only one who sees what each person has left to set up', async () => {
  const { ctx, ana, tomas, teamOf } = await setup();
  ctx.store.saveEvent(tomas.token, { source: 'checkin', type: 'checkin', occurredAt: new Date().toISOString(), summary: 'Check-in: bien', raw: { mood: 'bien', blocker: null, note: null } });

  const seenByAna = await teamOf(ana.token);
  assert.equal(seenByAna.admin, true);
  assert.deepEqual(seenByAna.people.map((person) => [person.name, person.admin, person.me, person.pending]), [
    ['Ana', true, true, ['agente', 'checkin', 'salud']],
    ['Tomás', false, false, ['agente', 'salud']],
  ]);

  const seenByTomas = await teamOf(tomas.token);
  assert.equal(seenByTomas.admin, false);
  assert.deepEqual(seenByTomas.people.map((person) => person.pending), [null, null]);
  assert.deepEqual(seenByTomas.invites, []);
  assert.ok(!JSON.stringify(seenByTomas).includes(ana.token));
});

test('an invitation link lets a new person or a known one into the team without waiting for approval, until it is revoked or expires', async () => {
  const { ctx, app, ana, tomas, teamId, teamOf } = await setup();
  assert.equal((await app.request(`/api/people/${tomas.token}/teams/${teamId}/invites`, json({}))).status, 403);

  const invite = (await (await app.request(`/api/people/${ana.token}/teams/${teamId}/invites`, json({}))).json()) as { code: string; path: string };
  assert.equal(invite.path, `/invitacion/${invite.code}`);
  assert.deepEqual((await teamOf(ana.token)).invites.map((listed) => listed.code), [invite.code]);
  assert.deepEqual(await (await app.request(`/api/invites/${invite.code}`)).json(), { team: 'Vita', people: 2, expiresAt: (await teamOf(ana.token)).invites[0]?.expiresAt });

  const joined = await app.request(`/api/invites/${invite.code}/join`, json({ name: 'Rob' }));
  assert.equal(joined.status, 201);
  const rob = (await joined.json()) as { token: string; name: string };
  assert.equal(ctx.teams.isMember(teamId, rob.token), true);

  const lia = ctx.store.addPerson('Lía');
  assert.equal((await app.request(`/api/invites/${invite.code}/join`, json({ token: lia.token }))).status, 201);
  assert.equal((await app.request(`/api/invites/${invite.code}/join`, json({ token: lia.token }))).status, 200);
  assert.equal((await app.request(`/api/invites/${invite.code}/join`, json({}))).status, 400);
  assert.deepEqual((await teamOf(ana.token)).members, ['Ana', 'Tomás', 'Rob', 'Lía']);
  assert.equal((await teamOf(ana.token)).admin, true);

  assert.equal((await app.request(`/api/people/${ana.token}/teams/${teamId}/invites/${invite.code}`, remove)).status, 200);
  assert.equal((await app.request(`/api/invites/${invite.code}`)).status, 404);
  assert.equal((await app.request(`/api/invites/${invite.code}/join`, json({ name: 'Otro' }))).status, 404);

  const old = ctx.teams.createInvite(teamId, ana.token, new Date(Date.now() - 8 * 86_400_000));
  assert.equal((await app.request(`/api/invites/${old.code}/join`, json({ name: 'Tarde' }))).status, 404);
});

test('only an administrator takes a person out of the team, and never themselves', async () => {
  const { ctx, app, ana, tomas, teamId, idOf } = await setup();
  const anaId = await idOf('Ana');
  const tomasId = await idOf('Tomás');

  assert.equal((await app.request(`/api/people/${tomas.token}/teams/${teamId}/members/${anaId}`, remove)).status, 403);
  assert.equal((await app.request(`/api/people/${ana.token}/teams/${teamId}/members/${anaId}`, remove)).status, 400);
  assert.equal((await app.request(`/api/people/${ana.token}/teams/${teamId}/members/no-existe`, remove)).status, 404);
  assert.equal(ctx.teams.isMember(teamId, tomas.token), true);

  assert.equal((await app.request(`/api/people/${ana.token}/teams/${teamId}/members/${tomasId}`, remove)).status, 200);
  assert.equal(ctx.teams.isMember(teamId, tomas.token), false);
});

test('an administrator can name another, and the team keeps one when the first leaves', async () => {
  const { ctx, app, ana, tomas, teamId, teamOf, idOf } = await setup();
  const lia = ctx.store.addPerson('Lía');
  ctx.teams.addMember(teamId, lia.token);

  assert.equal((await app.request(`/api/people/${tomas.token}/teams/${teamId}/members/${await idOf('Lía')}/admin`, json({}))).status, 403);
  assert.equal((await app.request(`/api/people/${ana.token}/teams/${teamId}/members/${await idOf('Lía')}/admin`, json({}))).status, 200);
  assert.deepEqual((await teamOf(ana.token)).people.map((person) => person.admin), [true, false, true]);

  assert.equal((await app.request(`/api/people/${ana.token}/teams/${teamId}`, remove)).status, 200);
  assert.deepEqual((await teamOf(lia.token)).people.map((person) => [person.name, person.admin]), [['Tomás', false], ['Lía', true]]);

  assert.equal((await app.request(`/api/people/${lia.token}/teams/${teamId}`, remove)).status, 200);
  assert.equal((await teamOf(tomas.token)).admin, true);
});
