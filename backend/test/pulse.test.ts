import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';
import { DEFAULT_POLICY, type Policy } from '../src/policy/store.js';
import { MIN_GROUP_SIZE, teamPulse, type PulseMember } from '../src/pulse.js';
import { DEMO_NAMES, seedDemo } from '../src/seed.js';
import { DEFAULT_VISIBILITY, type SignalLevel, type Signals } from '../src/signals.js';

const signals = (energy: SignalLevel, load: SignalLevel, blockers = 0): Signals => ({
  energy: { level: energy, statement: '', basis: [], visibility: 'preguntar' },
  load: { level: load, statement: '', basis: [], visibility: 'preguntar' },
  blockers: Array.from({ length: blockers }, (_, index) => ({ topic: `tema ${index}`, since: '', statement: '', source: 'checkin' as const, visibility: 'preguntar' as const })),
  blockerBasis: ['checkin'],
  expertise: [],
  visibility: { ...DEFAULT_VISIBILITY },
  asOf: '',
});

const member = (energy: SignalLevel, load: SignalLevel, policy: Partial<Policy> = {}, blockers = 0): PulseMember => ({
  signals: signals(energy, load, blockers),
  policy: { ...DEFAULT_POLICY, ...policy },
});

const put = (body: unknown) => ({ method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('below the minimum group size the pulse returns the reason and no level or count', () => {
  const pulse = teamPulse([member('baja', 'alta', {}, 2), member('baja', 'alta')]);
  assert.deepEqual(pulse.energy, { available: false, reason: 'grupo_pequeno', needed: MIN_GROUP_SIZE });
  assert.deepEqual(pulse.load, { available: false, reason: 'grupo_pequeno', needed: MIN_GROUP_SIZE });
  assert.deepEqual(pulse.blockersOpen, { available: false, reason: 'grupo_pequeno', needed: MIN_GROUP_SIZE });
});

test('the pulse is the median level and never a per-level distribution', () => {
  const pulse = teamPulse([member('baja', 'alta'), member('media', 'alta'), member('alta', 'media'), member('media', 'baja', {}, 1)]);
  assert.deepEqual(pulse.energy, { available: true, level: 'media', contributors: 4 });
  assert.deepEqual(pulse.load, { available: true, level: 'media', contributors: 4 });
  assert.deepEqual(pulse.blockersOpen, { available: true, total: 1, contributors: 4 });
});

test('a member who opts out, sets nunca or has no data does not count and can push the group below the minimum', () => {
  const three = [member('baja', 'alta'), member('baja', 'alta'), member('baja', 'alta')];
  assert.equal(teamPulse(three).energy.available, true);
  assert.equal(teamPulse([...three.slice(0, 2), member('baja', 'alta', { includeInPulse: false })]).energy.available, false);
  assert.equal(teamPulse([...three.slice(0, 2), member('baja', 'alta', { energy: 'nunca' })]).energy.available, false);
  assert.equal(teamPulse([...three.slice(0, 2), member('baja', 'alta', { energy: 'nunca' })]).load.available, true);
  assert.equal(teamPulse([...three.slice(0, 2), member('sin_datos', 'alta')]).energy.available, false);
});

test('the policy starts at the defaults, accepts partial changes and rejects values outside the enum', async () => {
  const ctx = createContext({ location: ':memory:' });
  const app = createApp(ctx);
  const ana = ctx.store.addPerson('Ana');

  assert.deepEqual(await (await app.request(`/api/people/${ana.token}/policy`)).json(), { ...DEFAULT_VISIBILITY, includeInPulse: true });
  const changed = await app.request(`/api/people/${ana.token}/policy`, put({ energy: 'nunca', includeInPulse: false }));
  assert.deepEqual(await changed.json(), { ...DEFAULT_VISIBILITY, energy: 'nunca', includeInPulse: false });
  assert.equal((await app.request(`/api/people/${ana.token}/policy`, put({ load: 'a veces' }))).status, 400);
  assert.equal((await app.request(`/api/people/${ana.token}/policy`, put({ includeInPulse: 'no' }))).status, 400);
  assert.equal((await app.request('/api/people/nope/policy')).status, 404);
});

test('the team pulse route requires membership and never names or identifies a member', async () => {
  const ctx = createContext({ location: ':memory:' });
  const app = createApp(ctx);
  const people = seedDemo(ctx);
  const team = ctx.teams.createTeam('Producto');
  for (const person of people) ctx.teams.addMember(team.id, person.token);
  const outsider = ctx.store.addPerson('Externa');
  const ana = people.find((person) => person.name === 'Ana');
  const tomas = people.find((person) => person.name === 'Tomás');
  assert.ok(ana && tomas);
  const others = DEMO_NAMES.length - 1;

  assert.equal((await app.request(`/api/people/${outsider.token}/teams/${team.id}/pulse`)).status, 403);
  assert.equal((await app.request(`/api/people/${ana.token}/teams/team_missing/pulse`)).status, 403);

  const text = await (await app.request(`/api/people/${ana.token}/teams/${team.id}/pulse`)).text();
  const body = JSON.parse(text) as { team: string; members: number; pulse: { energy: { available: boolean }; blockersOpen: { available: boolean; total?: number } } };
  assert.equal(body.members, DEMO_NAMES.length);
  assert.equal(body.pulse.energy.available, true);
  assert.deepEqual(body.pulse.blockersOpen, { available: true, total: 0, contributors: others });
  const seenByTomas = (await (await app.request(`/api/people/${tomas.token}/teams/${team.id}/pulse`)).json()) as { pulse: { blockersOpen: unknown } };
  assert.deepEqual(seenByTomas.pulse.blockersOpen, { available: true, total: 1, contributors: others });
  for (const person of people) {
    assert.ok(!text.includes(person.token));
    assert.ok(!text.includes(person.name));
  }
});
