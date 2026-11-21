import { Hono } from 'hono';
import { publicIdOf } from '../codes.js';
import type { AppContext } from '../context.js';
import { rateLimit } from '../rateLimit.js';
import type { Room } from '../rooms/store.js';
import { asObject, NOT_FOUND } from './shared.js';

const ROOM_NOT_FOUND = { error: 'Esa sala no existe.' } as const;
const ROOM_FULL = { error: 'La sala está llena.' } as const;
const MISSING_NAME = { error: 'Falta el nombre.' } as const;
const MAX_NAME_LENGTH = 80;
const MAX_ROOM_PEOPLE = 400;
const MAX_EVENTS_PER_READ = 200;
const JOINS_PER_MINUTE = 120;

export function roomRoutes({ store, teams, rooms, assistants, agents }: AppContext) {
  const routes = new Hono();
  const limited = rateLimit(JOINS_PER_MINUTE);

  const nameFrom = (value: unknown) => (typeof value === 'string' ? value.trim().slice(0, MAX_NAME_LENGTH) : '');

  const peopleOf = (room: Room) =>
    teams.membersOf(room.teamId).map((member) => ({
      id: publicIdOf(member.token),
      name: member.name,
      assistants: assistants.assistantsOf(member.token).map((assistant) => assistant.kind),
    }));

  const stateOf = (room: Room) => {
    const round = agents.latestRound(room.teamId);
    const threads = round
      ? agents.threadsOf(round.id).map((thread) => ({ id: thread.id, from: publicIdOf(thread.requesterToken), to: publicIdOf(thread.helperToken), topic: thread.topic, help: thread.help }))
      : [];
    return {
      code: room.code,
      name: room.name,
      people: peopleOf(room),
      round: round ? { id: round.id, status: round.status } : null,
      threads,
      lastEventId: rooms.lastEventId(room.teamId),
    };
  };

  routes.post('/rooms', limited, async (c) => {
    const body = asObject(await c.req.text());
    const name = nameFrom(body.name);
    if (!name) return c.json(MISSING_NAME, 400);
    const creator = typeof body.token === 'string' ? store.findPerson(body.token) : undefined;
    if (typeof body.token === 'string' && !creator) return c.json(NOT_FOUND, 404);
    const team = teams.createTeam(name);
    const room = rooms.createRoom(team.id);
    if (creator) {
      teams.addMember(team.id, creator.token);
      rooms.record(team.id, 'persona_entra', { person: publicIdOf(creator.token), name: creator.name });
    }
    return c.json({ code: room.code, name: room.name }, 201);
  });

  routes.get('/rooms/:code', (c) => {
    const room = rooms.findRoom(c.req.param('code'));
    if (!room) return c.json(ROOM_NOT_FOUND, 404);
    const people = peopleOf(room);
    return c.json({ code: room.code, name: room.name, people: people.length, assistants: people.filter((person) => person.assistants.length > 0).length });
  });

  routes.post('/rooms/:code/join', limited, async (c) => {
    const room = rooms.findRoom(c.req.param('code'));
    if (!room) return c.json(ROOM_NOT_FOUND, 404);
    const body = asObject(await c.req.text());
    const known = typeof body.token === 'string' ? store.findPerson(body.token) : undefined;
    if (typeof body.token === 'string' && !known) return c.json(NOT_FOUND, 404);
    const name = nameFrom(body.name);
    if (!known && !name) return c.json(MISSING_NAME, 400);
    if (known && teams.isMember(room.teamId, known.token)) return c.json({ token: known.token, name: known.name, room: { code: room.code, name: room.name } });
    if (teams.membersOf(room.teamId).length >= MAX_ROOM_PEOPLE) return c.json(ROOM_FULL, 409);
    const person = known ?? store.addPerson(name);
    teams.addMember(room.teamId, person.token);
    rooms.record(room.teamId, 'persona_entra', { person: publicIdOf(person.token), name: person.name });
    return c.json({ token: person.token, name: person.name, room: { code: room.code, name: room.name } }, 201);
  });

  routes.get('/rooms/:code/state', (c) => {
    const room = rooms.findRoom(c.req.param('code'));
    if (!room) return c.json(ROOM_NOT_FOUND, 404);
    return c.json(stateOf(room));
  });

  routes.get('/rooms/:code/events', (c) => {
    const room = rooms.findRoom(c.req.param('code'));
    if (!room) return c.json(ROOM_NOT_FOUND, 404);
    const since = Number(c.req.query('since') ?? 0);
    const events = rooms.eventsAfter(room.teamId, Number.isInteger(since) && since > 0 ? since : 0, MAX_EVENTS_PER_READ);
    return c.json({ events, lastEventId: events.at(-1)?.id ?? rooms.lastEventId(room.teamId) });
  });

  return routes;
}
