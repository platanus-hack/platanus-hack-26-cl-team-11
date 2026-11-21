import type { AppContext } from '../context.js';
import { openPolicyStore } from '../policy/store.js';
import { dayKeyOf, DEFAULT_TIME_ZONE } from '../signals.js';
import { MIN_TEAM_SIZE, openNeedsOf, runRound } from './round.js';

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;
const INTERRUPTED = 'La ronda se interrumpió porque el servidor se reinició.';

const hourFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: DEFAULT_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' });
const localHourOf = (instant: Date) => Number(hourFormatter.format(instant));

export async function runDueRounds(ctx: AppContext, now: Date = new Date()): Promise<number> {
  const { model, agents, store, teams } = ctx;
  const roundHour = ctx.config.agentRoundHour ?? null;
  if (!model || roundHour === null || localHourOf(now) < roundHour) return 0;
  const deps = { store, teams, agents, policies: openPolicyStore(ctx.db), model };
  const today = dayKeyOf(now);
  let started = 0;
  for (const teamId of agents.teamIds()) {
    const latest = agents.latestRound(teamId);
    if (latest && dayKeyOf(new Date(latest.startedAt)) === today) continue;
    const { cards, openNeeds } = openNeedsOf(deps, teamId, now);
    if (cards.length < MIN_TEAM_SIZE || openNeeds.length === 0) continue;
    const round = agents.startRound(teamId, null);
    if (!round) continue;
    await runRound(deps, round, now);
    started += 1;
  }
  return started;
}

export function startAgentRoutine(ctx: AppContext, intervalMs: number = DEFAULT_INTERVAL_MS): () => void {
  ctx.agents.failRoundsStartedBefore(new Date().toISOString(), INTERRUPTED);
  let runInFlight = false;
  const runUnlessBusy = async () => {
    if (runInFlight) return;
    runInFlight = true;
    try {
      await runDueRounds(ctx);
    } catch (failure) {
      console.error('La ronda programada de agentes falló.', failure);
    } finally {
      runInFlight = false;
    }
  };
  const timer = setInterval(() => void runUnlessBusy(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
