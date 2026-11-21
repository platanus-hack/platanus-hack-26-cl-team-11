import type { AppContext } from '../context.js';
import { openPolicyStore } from '../policy/store.js';
import type { AgentModel } from './model.js';
import type { RoundDeps } from './round.js';

export type CardDeps = Omit<RoundDeps, 'model' | 'onEvent'>;

export const cardDepsFrom = (ctx: AppContext): CardDeps => ({
  store: ctx.store,
  teams: ctx.teams,
  policies: openPolicyStore(ctx.db),
  agents: ctx.agents,
  repo: ctx.repo,
  digests: ctx.digests,
});

export const roundDepsFrom = (ctx: AppContext, model: AgentModel): RoundDeps => ({
  ...cardDepsFrom(ctx),
  model,
  onEvent: (teamId, type, payload) => {
    if (ctx.rooms.roomOfTeam(teamId)) ctx.rooms.record(teamId, type, payload);
  },
});
