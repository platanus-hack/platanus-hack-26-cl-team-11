import type { AgentModel } from '../agents/model.js';
import { runRound } from '../agents/round.js';
import type { Round } from '../agents/store.js';
import type { AppContext } from '../context.js';
import { activityFingerprint, mesaRoundDeps } from './members.js';
import { DEFAULT_MESA_DAILY_TOKEN_CAP, MESA_TEAM_ID } from './store.js';

const DEFAULT_TICK_MS = 5000;
const DAY_MS = 86_400_000;
const WINDOW_STEP_MS = 60_000;

export type MesaTick = 'sin_modelo' | 'manual' | 'en_curso' | 'esperando' | 'tope' | 'sin_novedad' | 'iniciada';

export const mesaDailyCapOf = (ctx: AppContext): number => ctx.config.mesaDailyTokenCap ?? DEFAULT_MESA_DAILY_TOKEN_CAP;

export function mesaTokensLastDay(ctx: AppContext, now: Date): number {
  const spent = ctx.agents.usageSince(MESA_TEAM_ID, new Date(Math.floor(now.getTime() / WINDOW_STEP_MS) * WINDOW_STEP_MS - DAY_MS).toISOString());
  return spent.inputTokens + spent.outputTokens;
}

export function startMesaRound(ctx: AppContext, model: AgentModel, startedBy: string | null, now: Date = new Date()): { round: Round; done: Promise<void> } | null {
  const fingerprint = activityFingerprint(ctx, now);
  const round = ctx.agents.startRound(MESA_TEAM_ID, startedBy);
  if (!round) return null;
  ctx.mesa.saveFingerprint(fingerprint);
  ctx.mesaLive.clear();
  return { round, done: runRound(mesaRoundDeps(ctx, model), round, now) };
}

export function runMesaTick(ctx: AppContext, now: Date = new Date()): { outcome: MesaTick; done?: Promise<void> } {
  const { model } = ctx;
  if (!model) return { outcome: 'sin_modelo' };
  const interval = ctx.mesa.intervalSeconds();
  if (interval === null) return { outcome: 'manual' };
  const latest = ctx.agents.latestRound(MESA_TEAM_ID);
  if (latest?.status === 'en_curso') return { outcome: 'en_curso' };
  if (latest && now.getTime() - new Date(latest.startedAt).getTime() < interval * 1000) return { outcome: 'esperando' };
  if (mesaTokensLastDay(ctx, now) >= mesaDailyCapOf(ctx)) return { outcome: 'tope' };
  if (activityFingerprint(ctx, now) === ctx.mesa.fingerprint()) return { outcome: 'sin_novedad' };
  const started = startMesaRound(ctx, model, null, now);
  return started ? { outcome: 'iniciada', done: started.done } : { outcome: 'en_curso' };
}

export function startMesaTicker(ctx: AppContext, tickMs: number = DEFAULT_TICK_MS): () => void {
  const tick = () => {
    try {
      runMesaTick(ctx).done?.catch((failure: unknown) => console.error('La ronda de la mesa pública falló.', failure));
    } catch (failure) {
      console.error('El temporizador de la mesa pública falló.', failure);
    }
  };
  const timer = setInterval(tick, tickMs);
  timer.unref();
  return () => clearInterval(timer);
}
