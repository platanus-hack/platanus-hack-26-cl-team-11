import { Hono } from 'hono';
import { cardFor } from '../agents/round.js';
import type { Round } from '../agents/store.js';
import { publicIdOf } from '../codes.js';
import type { AppContext } from '../context.js';
import { openLoginStore } from '../logins.js';
import { hasPublished, isMesaOperator, mesaCardDeps } from '../mesa/members.js';
import { isGlobeMode, MESA_TEAM_ID } from '../mesa/store.js';
import { mesaDailyCapOf, mesaTokensLastDay } from '../mesa/ticker.js';
import { oncePerDatabase } from '../pg/database.js';
import { asObject, NOT_FOUND } from './shared.js';

const NOT_AN_OPERATOR = { error: 'Solo el equipo de Montu entra al panel.' } as const;
const INVALID_MODE = { error: 'El globo va «mesa» (en vivo) o «demo».' } as const;
const ROUND_NOT_FOUND = { error: 'Esa ronda no existe.' } as const;
const INVALID_MEMBERSHIP = { error: 'Falta decir si la persona queda en la mesa.' } as const;
const RECENT_ROUNDS = 40;

const loginsOf = oncePerDatabase(openLoginStore);

export function adminRoutes(ctx: AppContext) {
  const { store, agents, mesa } = ctx;
  const routes = new Hono();

  const operatorOf = (token: string) => {
    const person = store.findPerson(token);
    if (!person) return { error: NOT_FOUND, status: 404 as const };
    if (!isMesaOperator(ctx, person.token)) return { error: NOT_AN_OPERATOR, status: 403 as const };
    return { person };
  };

  const roundView = (round: Round) => {
    const spent = agents.usageOfRound(round.id);
    return {
      id: round.id,
      status: round.status,
      startedAt: round.startedAt,
      finishedAt: round.finishedAt,
      problem: round.problem,
      startedBy: round.startedBy ? (store.findPerson(round.startedBy)?.name ?? null) : null,
      threads: agents.threadsOf(round.id).length,
      tokens: spent ? spent.inputTokens + spent.outputTokens : 0,
      calls: spent?.calls ?? 0,
    };
  };

  routes.get('/mesa/globe', (c) => c.json({ mode: mesa.globeMode() }));

  routes.get('/admin/:token', (c) => {
    const found = operatorOf(c.req.param('token'));
    if ('error' in found) return c.json(found.error, found.status);
    const now = new Date();
    const deps = mesaCardDeps(ctx);
    const people = store
      .listPeople()
      .filter((person) => !ctx.sim.isSynthetic(person.token))
      .map((person) => ({
        id: publicIdOf(person.token),
        name: person.name,
        member: !mesa.hasLeft(person.token),
        publishing: hasPublished(cardFor(deps, person, now)),
        signedIn: loginsOf(ctx.db).loginOf(person.token) !== undefined,
      }));
    return c.json({
      globeMode: mesa.globeMode(),
      configured: ctx.model !== null,
      intervalSeconds: mesa.intervalSeconds(),
      usage: { lastDayTokens: mesaTokensLastDay(ctx, now), dailyCap: mesaDailyCapOf(ctx) },
      people,
      rounds: agents.recentRounds(MESA_TEAM_ID, RECENT_ROUNDS).map(roundView),
    });
  });

  routes.put('/admin/:token/globe', async (c) => {
    const found = operatorOf(c.req.param('token'));
    if ('error' in found) return c.json(found.error, found.status);
    const mode = asObject(await c.req.text()).mode;
    if (!isGlobeMode(mode)) return c.json(INVALID_MODE, 400);
    mesa.setGlobeMode(mode);
    return c.json({ globeMode: mesa.globeMode() });
  });

  routes.put('/admin/:token/people/:id/membership', async (c) => {
    const found = operatorOf(c.req.param('token'));
    if ('error' in found) return c.json(found.error, found.status);
    const member = asObject(await c.req.text()).member;
    if (typeof member !== 'boolean') return c.json(INVALID_MEMBERSHIP, 400);
    const person = store.listPeople().find((candidate) => publicIdOf(candidate.token) === c.req.param('id'));
    if (!person) return c.json(NOT_FOUND, 404);
    mesa.setLeft(person.token, !member);
    return c.json({ id: publicIdOf(person.token), name: person.name, member: !mesa.hasLeft(person.token) });
  });

  routes.get('/admin/:token/rounds/:roundId', (c) => {
    const found = operatorOf(c.req.param('token'));
    if ('error' in found) return c.json(found.error, found.status);
    const roundId = c.req.param('roundId');
    const round = agents.recentRounds(MESA_TEAM_ID, RECENT_ROUNDS).find((candidate) => candidate.id === roundId);
    if (!round) return c.json(ROUND_NOT_FOUND, 404);
    const threads = agents.threadsOf(round.id).map((thread) => ({
      id: thread.id,
      topic: thread.topic,
      requesterName: thread.requesterName,
      helperName: thread.helperName,
      help: thread.help,
      messages: thread.messages.map((message) => ({ fromName: message.fromName, text: message.text, createdAt: message.createdAt })),
    }));
    const proposals = agents
      .proposalsOf(MESA_TEAM_ID)
      .filter((proposal) => proposal.roundId === round.id)
      .map((proposal) => ({ id: proposal.id, topic: proposal.topic, text: proposal.text }));
    return c.json({ round: roundView(round), threads, proposals });
  });

  return routes;
}
