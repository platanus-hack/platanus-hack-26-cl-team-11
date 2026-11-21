import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { publicIdOf } from '../src/codes.js';
import { createContext } from '../src/context.js';

const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

interface Joined {
  token: string;
  name: string;
  room: { code: string; name: string };
}

interface RoomState {
  code: string;
  name: string;
  people: Array<{ id: string; name: string; assistants: string[] }>;
  round: { id: string; status: string } | null;
  threads: unknown[];
  lastEventId: number;
}

const setup = async () => {
  const ctx = createContext({ location: ':memory:', model: null });
  const app = createApp(ctx);
  const created = await app.request('/api/rooms', json({ name: 'Platanus Hack' }));
  const room = (await created.json()) as { code: string; name: string };
  return { ctx, app, room, created };
};

test('a room opens with a short code, and a person enters with only a name and no approval', async () => {
  const { ctx, app, room, created } = await setup();
  assert.equal(created.status, 201);
  assert.match(room.code, /^[2-9A-Z]{6}$/);
  assert.equal((await app.request('/api/rooms', json({ name: ' ' }))).status, 400);

  assert.equal((await app.request('/api/rooms/NOPE00/join', json({ name: 'Ana' }))).status, 404);
  assert.equal((await app.request(`/api/rooms/${room.code}/join`, json({}))).status, 400);
  const joined = await app.request(`/api/rooms/${room.code.toLowerCase()}/join`, json({ name: '  Ana Pérez ' }));
  assert.equal(joined.status, 201);
  const ana = (await joined.json()) as Joined;
  assert.equal(ana.name, 'Ana Pérez');
  assert.deepEqual(ana.room, room);
  assert.ok(ctx.store.findPerson(ana.token));

  const summary = (await (await app.request(`/api/rooms/${room.code}`)).json()) as { people: number; assistants: number };
  assert.deepEqual({ people: summary.people, assistants: summary.assistants }, { people: 1, assistants: 0 });
});

test('entering twice with the same link keeps one person, and someone who already exists enters as herself', async () => {
  const { ctx, app, room } = await setup();
  const tomas = ctx.store.addPerson('Tomás');
  assert.equal((await app.request(`/api/rooms/${room.code}/join`, json({ token: 'nope' }))).status, 404);
  assert.equal((await app.request(`/api/rooms/${room.code}/join`, json({ token: tomas.token }))).status, 201);
  assert.equal((await app.request(`/api/rooms/${room.code}/join`, json({ token: tomas.token }))).status, 200);
  const state = (await (await app.request(`/api/rooms/${room.code}/state`)).json()) as RoomState;
  assert.deepEqual(
    state.people.map((person) => person.name),
    ['Tomás'],
  );
});

test('the room screen sees who is in and what happened, and never a personal link', async () => {
  const { app, room } = await setup();
  const ana = (await (await app.request(`/api/rooms/${room.code}/join`, json({ name: 'Ana' }))).json()) as Joined;
  const first = (await (await app.request(`/api/rooms/${room.code}/events`)).json()) as { events: Array<{ id: number; type: string; payload: { person: string; name: string } }>; lastEventId: number };
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0]?.type, 'persona_entra');
  assert.deepEqual(first.events[0]?.payload, { person: publicIdOf(ana.token), name: 'Ana' });

  await app.request(`/api/rooms/${room.code}/join`, json({ name: 'Tomás' }));
  const later = (await (await app.request(`/api/rooms/${room.code}/events?since=${first.lastEventId}`)).json()) as { events: Array<{ payload: { name: string } }>; lastEventId: number };
  assert.deepEqual(
    later.events.map((event) => event.payload.name),
    ['Tomás'],
  );
  assert.equal(later.lastEventId, first.lastEventId + 1);

  const stateText = await (await app.request(`/api/rooms/${room.code}/state`)).text();
  const state = JSON.parse(stateText) as RoomState;
  assert.equal(state.people.length, 2);
  assert.equal(state.people[0]?.id, publicIdOf(ana.token));
  assert.equal(state.round, null);
  assert.equal(state.lastEventId, later.lastEventId);
  assert.ok(!stateText.includes(ana.token));
  assert.equal((await app.request('/api/rooms/NOPE00/state')).status, 404);
  assert.equal((await app.request('/api/rooms/NOPE00/events')).status, 404);
});

test('a room is a team: its people can start rounds together and existing teams still ask for approval', async () => {
  const { ctx, app, room } = await setup();
  const ana = (await (await app.request(`/api/rooms/${room.code}/join`, json({ name: 'Ana' }))).json()) as Joined;
  const teams = (await (await app.request(`/api/people/${ana.token}/teams`)).json()) as { teams: Array<{ id: string; name: string; joinCode: string; roomCode: string | null }> };
  assert.equal(teams.teams[0]?.name, 'Platanus Hack');
  assert.equal(teams.teams[0]?.roomCode, room.code);

  const tomas = ctx.store.addPerson('Tomás');
  const viaTeamCode = await app.request(`/api/people/${tomas.token}/teams/join`, json({ joinCode: teams.teams[0]?.joinCode }));
  assert.equal(viaTeamCode.status, 202);
  assert.ok(!ctx.teams.isMember(teams.teams[0]?.id ?? '', tomas.token));
});
