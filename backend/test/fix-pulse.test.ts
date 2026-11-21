import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext, type AppContext } from '../src/context.js';
import { DEFAULT_POLICY } from '../src/policy/store.js';
import { MIN_GROUP_SIZE, teamPulse, type PulseMember } from '../src/pulse.js';
import { DEFAULT_VISIBILITY, type Signals } from '../src/signals.js';

type App = ReturnType<typeof createApp>;

interface PulseBody {
  members: number;
  pulse: {
    energy: { available: boolean; level?: string; contributors?: number };
    load: { available: boolean };
    blockersOpen: { available: boolean; total?: number; contributors?: number };
  };
}

interface TeamsBody {
  teams: Array<{ id: string; joinCode: string; members: string[]; requests: Array<{ id: string; name: string; approvals: number; needed: number; approvedByMe: boolean }> }>;
  pending: Array<{ id: string; name: string }>;
}

const send = (method: string, body: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const post = (body: unknown = {}) => send('POST', body);
const put = (body: unknown) => send('PUT', body);

const TOO_SMALL = { available: false, reason: 'grupo_pequeno', needed: MIN_GROUP_SIZE };

const setup = () => {
  const ctx = createContext({ location: ':memory:' });
  return { ctx, app: createApp(ctx) };
};

const teamOf = (ctx: AppContext, names: string[]) => {
  const team = ctx.teams.createTeam('Producto');
  const people = names.map((name) => ctx.store.addPerson(name));
  for (const person of people) ctx.teams.addMember(team.id, person.token);
  return { team, people };
};

const checkin = (app: App, token: string, mood: string, blocker: string | null = null) => app.request(`/api/people/${token}/checkins`, post({ mood, blocker }));
const pulseOf = async (app: App, token: string, teamId: string) => (await (await app.request(`/api/people/${token}/teams/${teamId}/pulse`)).json()) as PulseBody;
const teamsOf = async (app: App, token: string) => (await (await app.request(`/api/people/${token}/teams`)).json()) as TeamsBody;
const createPerson = async (app: App, name: string) => ((await (await app.request('/api/people', post({ name }))).json()) as { token: string }).token;
const approve = (app: App, token: string, teamId: string, requestId: string) => app.request(`/api/people/${token}/teams/${teamId}/requests/${requestId}/approve`, post());

const signalsWith = (blockers: number, blockerBasis: string[]): Signals => ({
  energy: { level: 'media', statement: '', basis: [], visibility: 'preguntar' },
  load: { level: 'media', statement: '', basis: [], visibility: 'preguntar' },
  blockers: Array.from({ length: blockers }, (_, index) => ({ topic: `tema ${index}`, since: '', statement: '', source: 'checkin' as const, visibility: 'preguntar' as const })),
  blockerBasis,
  expertise: [],
  visibility: { ...DEFAULT_VISIBILITY },
  asOf: '',
});

const memberWith = (blockers: number, blockerBasis: string[]): PulseMember => ({ signals: signalsWith(blockers, blockerBasis), policy: { ...DEFAULT_POLICY } });

test('an identity created by a member stays outside the team until every member approves it', async () => {
  const { ctx, app } = setup();
  const { team, people } = teamOf(ctx, ['Ana', 'Tomás']);
  const [ana, tomas] = people;
  assert.ok(ana && tomas);
  await checkin(app, tomas.token, 'normal');

  const carla = await createPerson(app, 'Carla');
  const joinCode = (await teamsOf(app, ana.token)).teams[0]?.joinCode;
  const joined = await app.request(`/api/people/${carla}/teams/join`, post({ joinCode }));
  assert.equal(joined.status, 202);
  assert.deepEqual(await joined.json(), { id: team.id, name: 'Producto', status: 'pendiente' });
  assert.equal(ctx.teams.isMember(team.id, carla), false);
  assert.deepEqual((await teamsOf(app, carla)).pending, [{ id: team.id, name: 'Producto' }]);
  assert.deepEqual((await teamsOf(app, carla)).teams, []);

  const request = (await teamsOf(app, ana.token)).teams[0]?.requests[0];
  assert.ok(request);
  assert.deepEqual(request, { id: request.id, name: 'Carla', approvals: 0, needed: 2, approvedByMe: false });
  const ownApproval = await approve(app, ana.token, team.id, request.id);
  assert.deepEqual(await ownApproval.json(), { ok: true, status: 'pendiente' });
  assert.equal(ctx.teams.isMember(team.id, carla), false);

  await checkin(app, ana.token, 'bien');
  await checkin(app, carla, 'mal');
  const pulse = await pulseOf(app, ana.token, team.id);
  assert.equal(pulse.members, 2);
  assert.deepEqual(pulse.pulse.energy, TOO_SMALL);
  assert.deepEqual(pulse.pulse.blockersOpen, TOO_SMALL);
  assert.equal((await app.request(`/api/people/${carla}/teams/${team.id}/pulse`)).status, 403);

  const text = JSON.stringify(await teamsOf(app, tomas.token));
  assert.ok(!text.includes(carla));
  assert.ok(!text.includes(ana.token));

  const lastApproval = await approve(app, tomas.token, team.id, request.id);
  assert.deepEqual(await lastApproval.json(), { ok: true, status: 'miembro' });
  assert.equal(ctx.teams.isMember(team.id, carla), true);
  assert.deepEqual((await teamsOf(app, ana.token)).teams[0]?.requests, []);
  assert.deepEqual((await teamsOf(app, carla)).pending, []);
});

test('two identities joined by one member do not fill the group, whatever that member opts out of', async () => {
  const { ctx, app } = setup();
  const victim = ctx.store.addPerson('Vale');
  const attacker = ctx.store.addPerson('Mario');
  const created = (await (await app.request(`/api/people/${victim.token}/teams`, post({ name: 'Producto' }))).json()) as { id: string; joinCode: string };
  ctx.teams.addMember(created.id, attacker.token);
  await checkin(app, victim.token, 'mal', 'Acceso a staging');

  const joinCode = (await teamsOf(app, attacker.token)).teams[0]?.joinCode;
  const puppets = [await createPerson(app, 'Pedro'), await createPerson(app, 'Sofía')];
  for (const puppet of puppets) await app.request(`/api/people/${puppet}/teams/join`, post({ joinCode }));
  for (const request of (await teamsOf(app, attacker.token)).teams[0]?.requests ?? []) await approve(app, attacker.token, created.id, request.id);
  await checkin(app, puppets[0] ?? '', 'mal');
  await checkin(app, puppets[1] ?? '', 'bien');
  await app.request(`/api/people/${attacker.token}/policy`, put({ includeInPulse: false }));

  const pulse = await pulseOf(app, attacker.token, created.id);
  assert.equal(pulse.members, 2);
  assert.deepEqual(pulse.pulse.energy, TOO_SMALL);
  assert.deepEqual(pulse.pulse.load, TOO_SMALL);
  assert.deepEqual(pulse.pulse.blockersOpen, TOO_SMALL);
  for (const puppet of puppets) assert.equal(ctx.teams.isMember(created.id, puppet), false);
});

test('a request is approved only by members, only for their team, and the requester can withdraw it', async () => {
  const { ctx, app } = setup();
  const { team, people } = teamOf(ctx, ['Ana']);
  const [ana] = people;
  assert.ok(ana);
  const outsider = ctx.store.addPerson('Externa');
  const beto = ctx.store.addPerson('Beto');
  const otherTeam = ctx.teams.createTeam('Otro');
  ctx.teams.addMember(otherTeam.id, outsider.token);

  assert.equal((await app.request(`/api/people/${beto.token}/teams/join`, post({ joinCode: 'nope' }))).status, 404);
  assert.equal((await app.request(`/api/people/${beto.token}/teams/join`, post({ joinCode: team.joinCode }))).status, 202);
  assert.equal((await app.request(`/api/people/${beto.token}/teams/join`, post({ joinCode: team.joinCode }))).status, 202);
  const requests = (await teamsOf(app, ana.token)).teams[0]?.requests ?? [];
  assert.equal(requests.length, 1);
  const requestId = requests[0]?.id ?? '';

  assert.equal((await approve(app, 'nope', team.id, requestId)).status, 404);
  assert.equal((await approve(app, outsider.token, team.id, requestId)).status, 403);
  assert.equal((await approve(app, beto.token, team.id, requestId)).status, 403);
  assert.equal((await approve(app, outsider.token, otherTeam.id, requestId)).status, 404);
  assert.equal((await approve(app, ana.token, team.id, 'sol_missing')).status, 404);
  assert.equal(ctx.teams.isMember(team.id, beto.token), false);

  assert.equal((await app.request(`/api/people/${beto.token}/teams/${team.id}`, { method: 'DELETE' })).status, 200);
  assert.deepEqual((await teamsOf(app, ana.token)).teams[0]?.requests, []);
  assert.equal((await approve(app, ana.token, team.id, requestId)).status, 404);

  await app.request(`/api/people/${beto.token}/teams/join`, post({ joinCode: team.joinCode }));
  const again = (await teamsOf(app, ana.token)).teams[0]?.requests[0]?.id ?? '';
  assert.deepEqual(await (await approve(app, ana.token, team.id, again)).json(), { ok: true, status: 'miembro' });
  const rejoin = await app.request(`/api/people/${beto.token}/teams/join`, post({ joinCode: team.joinCode }));
  assert.equal(rejoin.status, 201);
  assert.deepEqual(await rejoin.json(), { id: team.id, name: 'Producto', status: 'miembro' });
});

test('what a person reads in the pulse never depends on their own check-in or policy', async () => {
  const { ctx, app } = setup();
  const { team, people } = teamOf(ctx, ['Ana', 'Tomás', 'Beto', 'Carla']);
  const [ana, tomas, beto, carla] = people;
  assert.ok(ana && tomas && beto && carla);
  await checkin(app, tomas.token, 'normal');
  await checkin(app, beto.token, 'mal');
  await checkin(app, carla.token, 'bien');
  const others = { available: true, level: 'media', contributors: 3 };

  await checkin(app, ana.token, 'bien');
  assert.deepEqual((await pulseOf(app, ana.token, team.id)).pulse.energy, others);
  await checkin(app, ana.token, 'mal');
  assert.deepEqual((await pulseOf(app, ana.token, team.id)).pulse.energy, others);
  await app.request(`/api/people/${ana.token}/policy`, put({ includeInPulse: false, energy: 'nunca' }));
  const optedOut = await pulseOf(app, ana.token, team.id);
  assert.deepEqual(optedOut.pulse.energy, others);
  assert.equal(optedOut.members, 4);

  await app.request(`/api/people/${carla.token}/teams/${team.id}`, { method: 'DELETE' });
  for (const person of [ana, tomas, beto]) assert.deepEqual((await pulseOf(app, person.token, team.id)).pulse.energy, TOO_SMALL);
});

test('members without blocker data do not count toward the blocker total', async () => {
  const { ctx, app } = setup();
  const { team, people } = teamOf(ctx, ['Ana', 'Tomás', 'Carla', 'Beto']);
  const [ana, tomas, carla, beto] = people;
  assert.ok(ana && tomas && carla && beto);
  await checkin(app, ana.token, 'normal', 'Acceso a staging');
  assert.deepEqual((await pulseOf(app, tomas.token, team.id)).pulse.blockersOpen, TOO_SMALL);

  for (const person of [tomas, carla, beto]) await checkin(app, person.token, 'normal');
  assert.deepEqual((await pulseOf(app, tomas.token, team.id)).pulse.blockersOpen, { available: true, total: 1, contributors: 3 });
  assert.deepEqual((await pulseOf(app, ana.token, team.id)).pulse.blockersOpen, { available: true, total: 0, contributors: 3 });
});

test('the blocker total needs the minimum of members with data', () => {
  assert.deepEqual(teamPulse([memberWith(2, ['checkin']), memberWith(0, []), memberWith(0, [])]).blockersOpen, TOO_SMALL);
  assert.deepEqual(teamPulse([memberWith(2, ['checkin']), memberWith(0, ['linear']), memberWith(1, ['checkin', 'linear']), memberWith(0, [])]).blockersOpen, {
    available: true,
    total: 3,
    contributors: 3,
  });
});
