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
import { clearTired, tiredDrafts } from '../tired.js';
import { asObject, NOT_FOUND } from './shared.js';

const NOT_AN_OPERATOR = { error: 'Solo el equipo de Montu entra al panel.' } as const;
const INVALID_MODE = { error: 'El globo va «mesa» (en vivo) o «demo».' } as const;
const ROUND_NOT_FOUND = { error: 'Esa ronda no existe.' } as const;
const INVALID_MEMBERSHIP = { error: 'Falta decir si la persona queda en la mesa.' } as const;
const INVALID_TIRED = { error: 'Falta decir si el equipo queda cansado.' } as const;
const DEMO_FOLDER = 'demo/';
const DEMO_AUTHOR = 'demo';
const DEMO_MESSAGE = 'Contexto para la demo';
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

  routes.put('/admin/:token/tired', async (c) => {
    const found = operatorOf(c.req.param('token'));
    if ('error' in found) return c.json(found.error, found.status);
    const tired = asObject(await c.req.text()).tired;
    if (typeof tired !== 'boolean') return c.json(INVALID_TIRED, 400);
    const cleared = clearTired(ctx.db);
    if (!tired) return c.json({ tired, people: 0, cleared });
    const now = new Date();
    const people = store.listPeople().filter((person) => !ctx.sim.isSynthetic(person.token) && !mesa.hasLeft(person.token));
    people.forEach((person, position) => tiredDrafts(position, now).forEach((draft) => store.saveEvent(person.token, draft)));
    return c.json({ tired, people: people.length, cleared });
  });

  routes.put('/admin/:token/people/:id/demo', async (c) => {
    const found = operatorOf(c.req.param('token'));
    if ('error' in found) return c.json(found.error, found.status);
    const people = store.listPeople();
    const person = people.find((candidate) => publicIdOf(candidate.token) === c.req.param('id'));
    if (!person) return c.json(NOT_FOUND, 404);
    const from = asObject(await c.req.text()).from;
    const source = typeof from === 'string' ? people.find((candidate) => publicIdOf(candidate.token) === from) : undefined;
    if (typeof from === 'string' && !source) return c.json(NOT_FOUND, 404);
    const remove = ctx.repo.tree(person.token).map((entry) => entry.path).filter((path) => path.startsWith(DEMO_FOLDER));
    const files = source
      ? ctx.repo.shared(source.token).map((file) => ({ path: `${DEMO_FOLDER}${file.path}`, content: file.content.replaceAll(source.name, person.name), share: 'siempre' as const }))
      : [];
    const kept = files.map((file) => file.path);
    const result = ctx.repo.commit(person.token, { by: DEMO_AUTHOR, message: DEMO_MESSAGE, topics: [], files, remove: remove.filter((path) => !kept.includes(path)) });
    return c.json({ id: publicIdOf(person.token), name: person.name, files: result.ok ? files.length : 0 });
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
