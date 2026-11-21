import { Hono } from 'hono';
import { cardDepsFrom, roundDepsFrom } from '../agents/deps.js';
import { cardFor, runRound } from '../agents/round.js';
import { isPartyDecision, type Proposal, type Thread } from '../agents/store.js';
import type { AppContext } from '../context.js';
import { asObject, NOT_FOUND } from './shared.js';

const NOT_A_MEMBER = { error: 'No perteneces a ese equipo.' } as const;
const NOT_CONFIGURED = { error: 'Faltan las credenciales del modelo en el servidor.' } as const;
const ROUND_RUNNING = { error: 'Ya hay una ronda en curso en este equipo.' } as const;
const PROPOSAL_NOT_FOUND = { error: 'Esa propuesta no existe.' } as const;
const NOT_A_PARTY = { error: 'Esa propuesta no es para ti.' } as const;
const PROPOSAL_SETTLED = { error: 'Esa propuesta ya está cerrada.' } as const;
const INVALID_DECISION = { error: 'La respuesta debe ser acepta o rechaza.' } as const;
const MISSING_TOPIC = { error: 'Falta el tema.' } as const;
const INVALID_ALLOW = { error: 'El permiso debe ser verdadero o falso.' } as const;

const MAX_TOPIC_LENGTH = 500;

export function agentRoutes(ctx: AppContext) {
  const { store, teams, agents } = ctx;
  const routes = new Hono();
  const cardDeps = cardDepsFrom(ctx);

  const viewThread = (thread: Thread, viewerToken: string) => {
    const mine = viewerToken === thread.requesterToken || viewerToken === thread.helperToken;
    return {
      id: thread.id,
      topic: thread.topic,
      requesterName: thread.requesterName,
      helperName: thread.helperName,
      help: thread.help,
      mine,
      messages: mine ? thread.messages.map((message) => ({ fromName: message.fromName, text: message.text, createdAt: message.createdAt })) : null,
    };
  };

  const viewProposal = (proposal: Proposal, viewerToken: string) => ({
    id: proposal.id,
    topic: proposal.topic,
    text: proposal.text,
    createdAt: proposal.createdAt,
    status: proposal.status,
    parties: proposal.parties.map((party) => ({ name: party.name, role: party.role, answer: party.answer, me: party.token === viewerToken })),
    myAnswer: proposal.parties.find((party) => party.token === viewerToken)?.answer ?? null,
  });

  const isVisibleTo = (proposal: Proposal, viewerToken: string) =>
    proposal.status === 'acordada' || proposal.parties.some((party) => party.token === viewerToken);

  routes.get('/people/:token/teams/:teamId/agents', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const teamId = c.req.param('teamId');
    if (!teams.isMember(teamId, person.token)) return c.json(NOT_A_MEMBER, 403);
    const round = agents.latestRound(teamId);
    const card = cardFor(cardDeps, person, new Date());
    return c.json({
      configured: ctx.model !== null,
      round: round ? { id: round.id, status: round.status, startedAt: round.startedAt, finishedAt: round.finishedAt, problem: round.problem } : null,
      asks: card.pendingAsks,
      threads: round ? agents.threadsOf(round.id).map((thread) => viewThread(thread, person.token)) : [],
      proposals: agents
        .proposalsOf(teamId)
        .filter((proposal) => isVisibleTo(proposal, person.token))
        .map((proposal) => viewProposal(proposal, person.token)),
    });
  });

  routes.post('/people/:token/teams/:teamId/agents/rounds', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const teamId = c.req.param('teamId');
    if (!teams.isMember(teamId, person.token)) return c.json(NOT_A_MEMBER, 403);
    if (!ctx.model) return c.json(NOT_CONFIGURED, 503);
    const round = agents.startRound(teamId, person.token);
    if (!round) return c.json(ROUND_RUNNING, 409);
    void runRound(roundDepsFrom(ctx, ctx.model), round);
    return c.json({ id: round.id, status: round.status, startedAt: round.startedAt }, 202);
  });

  routes.post('/people/:token/agents/asks', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const body = asObject(await c.req.text());
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    if (!topic || topic.length > MAX_TOPIC_LENGTH) return c.json(MISSING_TOPIC, 400);
    if (typeof body.allow !== 'boolean') return c.json(INVALID_ALLOW, 400);
    agents.decideTopic(person.token, topic, body.allow);
    return c.json({ topic, allow: body.allow });
  });

  routes.post('/people/:token/agents/proposals/:proposalId/answer', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const proposal = agents.findProposal(c.req.param('proposalId'));
    if (!proposal) return c.json(PROPOSAL_NOT_FOUND, 404);
    if (!proposal.parties.some((party) => party.token === person.token)) return c.json(NOT_A_PARTY, 403);
    const body = asObject(await c.req.text());
    if (!isPartyDecision(body.answer)) return c.json(INVALID_DECISION, 400);
    if (proposal.status !== 'por_aprobar') return c.json(PROPOSAL_SETTLED, 409);
    const answered = agents.answerProposal(proposal.id, person.token, body.answer);
    return c.json(viewProposal(answered ?? proposal, person.token));
  });

  return routes;
}
