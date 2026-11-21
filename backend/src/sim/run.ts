import { roundDepsFrom } from '../agents/deps.js';
import type { AgentModel } from '../agents/model.js';
import { runRound } from '../agents/round.js';
import type { Round } from '../agents/store.js';
import { publicIdOf } from '../codes.js';
import type { AppContext } from '../context.js';
import type { Room } from '../rooms/store.js';
import { inventPersonas, MAX_SIM_PEOPLE, MIN_SIM_PEOPLE, SIM_AUTHOR, SIM_NAMES } from './personas.js';

export const SIM_MAX_NEEDS = 30;

export const clampPeople = (value: unknown): number => {
  const wanted = typeof value === 'number' && Number.isInteger(value) ? value : MIN_SIM_PEOPLE;
  return Math.max(MIN_SIM_PEOPLE, Math.min(MAX_SIM_PEOPLE, wanted));
};

export async function populateRoom(ctx: AppContext, model: AgentModel, room: Room, people: number): Promise<number> {
  const taken = new Set(ctx.teams.membersOf(room.teamId).map((member) => member.name));
  const names = SIM_NAMES.filter((name) => !taken.has(name)).slice(0, people);
  const personas = await inventPersonas(model, room.name, names);
  for (const persona of personas) {
    const person = ctx.store.addPerson(persona.name);
    ctx.sim.mark(person.token);
    ctx.teams.addMember(room.teamId, person.token);
    ctx.rooms.record(room.teamId, 'persona_entra', { person: publicIdOf(person.token), name: person.name });
    const committed = ctx.repo.commit(person.token, { by: SIM_AUTHOR, message: `Contexto de ${persona.role}`, topics: [], files: persona.files, remove: [] });
    if (committed.ok) ctx.digests.save(person.token, committed.commit.id, persona.digest);
    ctx.rooms.record(room.teamId, 'repo_cambia', { person: publicIdOf(person.token), files: persona.files.length });
  }
  return personas.length;
}

export function startSimRound(ctx: AppContext, model: AgentModel, room: Room): { round: Round; done: Promise<void> } | null {
  const round = ctx.agents.startRound(room.teamId, null);
  if (!round) return null;
  return { round, done: runRound({ ...roundDepsFrom(ctx, model), maxNeeds: SIM_MAX_NEEDS }, round) };
}
