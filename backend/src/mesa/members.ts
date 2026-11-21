import { createHash } from 'node:crypto';
import type { AgentCard } from '../agents/cards.js';
import { cardDepsFrom, roundDepsFrom, type CardDeps } from '../agents/deps.js';
import type { AgentModel } from '../agents/model.js';
import { cardFor, type RoundDeps } from '../agents/round.js';
import type { AppContext } from '../context.js';
import { openLoginStore } from '../logins.js';
import type { TeamMember, TeamStore } from '../teams/store.js';
import { MESA_TEAM_ID } from './store.js';

const LOGIN_PROVIDER = 'google';

export const hasPublished = (card: AgentCard): boolean => card.statements.length + card.expertise.length + card.needs.length > 0;

export const mesaMembersOf = (ctx: AppContext): TeamMember[] => ctx.store.listPeople().filter((person) => !ctx.sim.isSynthetic(person.token) && !ctx.mesa.hasLeft(person.token));

const mesaTeams = (ctx: AppContext): TeamStore => ({
  ...ctx.teams,
  membersOf: (teamId) => (teamId === MESA_TEAM_ID ? mesaMembersOf(ctx) : ctx.teams.membersOf(teamId)),
});

export const mesaCardDeps = (ctx: AppContext): CardDeps => ({ ...cardDepsFrom(ctx), teams: mesaTeams(ctx), cardFilter: hasPublished });

export const mesaRoundDeps = (ctx: AppContext, model: AgentModel): RoundDeps => ({
  ...roundDepsFrom(ctx, model),
  teams: mesaTeams(ctx),
  cardFilter: hasPublished,
  onEvent: (teamId, type, payload) => ctx.rooms.record(teamId, type, payload),
});

export function activityFingerprint(ctx: AppContext, now: Date): string {
  const deps: CardDeps = { ...mesaCardDeps(ctx), repo: undefined, digests: undefined };
  const published = mesaMembersOf(ctx).map((member) => {
    const card = cardFor(deps, member, now);
    return [member.token, ctx.repo.version(member.token), card.statements, card.expertise, card.needs.map((need) => need.topic)];
  });
  return createHash('sha256').update(JSON.stringify(published)).digest('hex');
}

export function isMesaOperator(ctx: AppContext, personToken: string): boolean {
  if (!ctx.config.oauth[LOGIN_PROVIDER]) return true;
  const email = openLoginStore(ctx.db).loginOf(personToken)?.email.toLowerCase();
  return email !== undefined && (ctx.config.mesaOperators ?? []).includes(email);
}
