import { Hono } from 'hono';
import { estimateRound } from '../agents/estimate.js';
import { cardFor } from '../agents/round.js';
import type { AppContext } from '../context.js';
import { hasPublished, isMesaOperator, mesaCardDeps } from '../mesa/members.js';
import { isInterval, MAX_INTERVAL_SECONDS, MESA_NAME, MESA_TEAM_ID, MIN_INTERVAL_SECONDS } from '../mesa/store.js';
import { mesaDailyCapOf, mesaTokensLastDay, startMesaRound } from '../mesa/ticker.js';
import { isVisibleTo, viewProposal, viewThread } from './agents.js';
import { asObject, NOT_FOUND } from './shared.js';

const NOT_AN_OPERATOR = { error: 'Solo el equipo de Montu inicia rondas y cambia el intervalo de la mesa.' } as const;
const NOT_CONFIGURED = { error: 'Faltan las credenciales del modelo en el servidor.' } as const;
const ROUND_RUNNING = { error: 'Ya hay una ronda en curso en la mesa.' } as const;
const INVALID_INTERVAL = { error: `El intervalo va entre ${MIN_INTERVAL_SECONDS} segundos y ${MAX_INTERVAL_SECONDS / 3600} horas, o vacío para dejarlo manual.` } as const;
const INVALID_MEMBERSHIP = { error: 'La participación en la mesa debe ser verdadera o falsa.' } as const;

export function mesaRoutes(ctx: AppContext) {
  const { store, agents, mesa } = ctx;
  const routes = new Hono();

  const viewOf = (personToken: string, name: string) => {
    const now = new Date();
    const deps = mesaCardDeps(ctx);
    const round = agents.latestRound(MESA_TEAM_ID);
    const spent = round ? agents.usageOfRound(round.id) : undefined;
    const card = cardFor(deps, { token: personToken, name }, now);
    return {
      name: MESA_NAME,
      configured: ctx.model !== null,
      operator: isMesaOperator(ctx, personToken),
      member: !mesa.hasLeft(personToken),
      publishing: hasPublished(card),
      intervalSeconds: mesa.intervalSeconds(),
      round: round ? { id: round.id, status: round.status, startedAt: round.startedAt, finishedAt: round.finishedAt, problem: round.problem } : null,
      estimate: estimateRound(deps, MESA_TEAM_ID, now),
      usage: {
        lastRound: spent ? { calls: spent.calls, tokens: spent.inputTokens + spent.outputTokens, measured: spent.measured } : null,
        lastDayTokens: mesaTokensLastDay(ctx, now),
        dailyCap: mesaDailyCapOf(ctx),
      },
      asks: card.pendingAsks,
      threads: round ? agents.threadsOf(round.id).map((thread) => viewThread(thread, personToken)) : [],
      proposals: agents
        .proposalsOf(MESA_TEAM_ID)
        .filter((proposal) => isVisibleTo(proposal, personToken))
        .map((proposal) => viewProposal(proposal, personToken)),
    };
  };

  routes.get('/people/:token/mesa', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json(viewOf(person.token, person.name));
  });

  routes.post('/people/:token/mesa/rounds', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    if (!isMesaOperator(ctx, person.token)) return c.json(NOT_AN_OPERATOR, 403);
    if (!ctx.model) return c.json(NOT_CONFIGURED, 503);
    const started = startMesaRound(ctx, ctx.model, person.token);
    if (!started) return c.json(ROUND_RUNNING, 409);
    void started.done;
    return c.json({ id: started.round.id, status: started.round.status, startedAt: started.round.startedAt }, 202);
  });

  routes.put('/people/:token/mesa/interval', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    if (!isMesaOperator(ctx, person.token)) return c.json(NOT_AN_OPERATOR, 403);
    const seconds = asObject(await c.req.text()).seconds ?? null;
    if (seconds !== null && !isInterval(seconds)) return c.json(INVALID_INTERVAL, 400);
    mesa.setIntervalSeconds(seconds);
    return c.json({ intervalSeconds: mesa.intervalSeconds() });
  });

  routes.put('/people/:token/mesa/membership', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const member = asObject(await c.req.text()).member;
    if (typeof member !== 'boolean') return c.json(INVALID_MEMBERSHIP, 400);
    mesa.setLeft(person.token, !member);
    return c.json({ member: !mesa.hasLeft(person.token) });
  });

  return routes;
}
