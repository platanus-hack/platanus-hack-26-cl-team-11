import { publicIdOf } from '../codes.js';
import type { Store } from '../db.js';
import { withChosenVisibility, type PolicyStore } from '../policy/store.js';
import { deriveSignals } from '../signals.js';
import type { RepoStore } from '../repo/store.js';
import type { RoomEventType } from '../rooms/store.js';
import type { TeamStore } from '../teams/store.js';
import type { JsonObject, StoredEvent } from '../types.js';
import { buildCard, topicKeyOf, type AgentCard, type Need } from './cards.js';
import { currentDigest, refreshDigests, type DigestStore } from './digest.js';
import { AgentModelError, approximateTokens, type AgentModel, type ModelUsage } from './model.js';
import { partialContacts, partialString } from './partial.js';
import {
  ContactPlan,
  contactPrompt,
  HelpReply,
  isHelpAnswer,
  MAX_CONTACTS,
  MAX_HELPERS,
  ProposalDraft,
  proposalPrompt,
  replyPrompt,
  systemFor,
  type CollectedReply,
  type Teammate,
} from './prompts.js';
import type { AgentStore, Proposal, Round, RoundUsage } from './store.js';

export const MAX_NEEDS_PER_ROUND = 10;
export const MIN_TEAM_SIZE = 2;
const NEEDS_IN_PARALLEL = 3;
const ACTIVE_PROPOSAL_DAYS = 7;
const DAY_MS = 86_400_000;
const MAX_PROPOSAL_LENGTH = 500;

export const TEAM_TOO_SMALL = 'El equipo necesita al menos dos personas para una ronda.';
const UNEXPECTED_FAILURE = 'La ronda falló por un error interno.';
const INCOMPLETE_REPLY = 'El modelo entregó una respuesta incompleta.';

export interface RoundDeps {
  store: Store;
  teams: TeamStore;
  policies: PolicyStore;
  agents: AgentStore;
  model: AgentModel;
  repo?: RepoStore;
  digests?: DigestStore;
  onEvent?: (teamId: string, type: RoomEventType, payload: JsonObject) => void;
  onProposal?: (proposal: Proposal) => void;
  maxNeeds?: number;
  cardFilter?: (card: AgentCard) => boolean;
  chatter?: number;
  onStream?: (teamId: string, text: LiveText) => void;
}

export interface LiveText {
  key: string;
  kind: 'ask' | 'reply';
  from: string;
  to: string;
  topic: string;
  text: string;
}

interface OpenNeed {
  requester: AgentCard;
  need: Need;
}

const MAX_RECENT_WORK = 8;
const RECENT_EVENTS_READ = 80;
const PER_SOURCE = 3;
const WORK_SOURCE_LABEL: Partial<Record<string, string>> = {
  google_calendar: 'En su calendario',
  granola: 'Reunión en Granola',
  linear: 'Tarea en Linear',
  github: 'En GitHub',
};

export function recentWorkOf(events: StoredEvent[]): string[] {
  const perSource = new Map<string, number>();
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const event of events) {
    const label = WORK_SOURCE_LABEL[event.source];
    if (!label || !event.summary) continue;
    const line = `${label}: ${event.summary}`;
    const used = perSource.get(event.source) ?? 0;
    if (seen.has(line) || used >= PER_SOURCE) continue;
    seen.add(line);
    perSource.set(event.source, used + 1);
    lines.push(line);
    if (lines.length >= MAX_RECENT_WORK) break;
  }
  return lines;
}

export function cardFor(deps: Pick<RoundDeps, 'store' | 'policies' | 'agents' | 'repo' | 'digests'>, member: { token: string; name: string }, now: Date): AgentCard {
  const events = deps.store.listSignalEvents(member.token, now);
  const signals = withChosenVisibility(deriveSignals(events, now), deps.policies.chosen(member.token));
  const repo = deps.repo && deps.digests ? currentDigest({ repo: deps.repo, digests: deps.digests }, member.token) : undefined;
  return buildCard({ token: member.token, name: member.name, signals, decisions: deps.agents.decisionsOf(member.token), repo, recent: recentWorkOf(deps.store.listEvents(member.token, RECENT_EVENTS_READ)) });
}

export async function inBatches<Item>(items: Item[], size: number, work: (item: Item) => Promise<void>): Promise<PromiseSettledResult<void>[]> {
  const results: PromiseSettledResult<void>[] = [];
  for (let start = 0; start < items.length; start += size) {
    results.push(...(await Promise.allSettled(items.slice(start, start + size).map(work))));
  }
  return results;
}

export type NeedOutcome = 'nadie' | 'sin_ayuda' | 'propuesta' | 'falla';

async function resolveNeed(deps: RoundDeps, round: Round, open: OpenNeed, cards: AgentCard[]): Promise<void> {
  const step = { from: publicIdOf(open.requester.token), topic: open.need.topic };
  deps.onEvent?.(round.teamId, 'pedido_busca', step);
  let outcome: NeedOutcome = 'falla';
  try {
    outcome = await talkAbout(deps, round, open, cards);
  } finally {
    deps.onEvent?.(round.teamId, 'pedido_cierra', { ...step, outcome });
  }
}

async function talkAbout(deps: RoundDeps, round: Round, { requester, need }: OpenNeed, cards: AgentCard[]): Promise<NeedOutcome> {
  const teammates: Teammate[] = cards.filter((card) => card.token !== requester.token).map((card, position) => ({ id: `p${position + 1}`, card }));
  const byId = new Map(teammates.map((teammate) => [teammate.id, teammate]));

  const from = publicIdOf(requester.token);
  const step = (tool: string, by: string, state: 'inicio' | 'fin', detail: JsonObject = {}) =>
    deps.onEvent?.(round.teamId, 'paso', { from, topic: need.topic, tool, by, state, ...detail });

  const stream = deps.onStream;
  const writtenPlan = (written: string) => {
    for (const contact of partialContacts(written).slice(0, MAX_CONTACTS)) {
      const helper = byId.get(contact.teammate);
      if (!helper) continue;
      const to = publicIdOf(helper.card.token);
      stream?.(round.teamId, { key: `ask|${from}|${to}|${need.topic}`, kind: 'ask', from, to, topic: need.topic, text: contact.message });
    }
  };

  step('equipo.consultar', from, 'inicio', { people: teammates.length });
  const plan = await deps.model.decide({ system: systemFor(requester.name), prompt: contactPrompt(need, teammates), schema: ContactPlan, ...(stream ? { onText: writtenPlan } : {}) });
  const contacts = new Map<string, string>();
  for (const contact of plan.contacts) {
    const message = contact.message.trim();
    if (byId.has(contact.teammate) && message && !contacts.has(contact.teammate) && contacts.size < MAX_CONTACTS) contacts.set(contact.teammate, message);
  }
  step('equipo.consultar', from, 'fin', { people: teammates.length, chosen: contacts.size });
  if (contacts.size === 0) return 'nadie';

  const settled = await Promise.allSettled(
    [...contacts].map(async ([teammateId, message]): Promise<CollectedReply> => {
      const helper = (byId.get(teammateId) as Teammate).card;
      const threadId = deps.agents.addThread({ roundId: round.id, requesterToken: requester.token, helperToken: helper.token, topic: need.topic });
      deps.agents.addMessage(threadId, requester.token, message);
      const arc = { thread: threadId, from, to: publicIdOf(helper.token), topic: need.topic };
      deps.onEvent?.(round.teamId, 'hilo_abre', arc);
      step('checkin.consultar', arc.to, 'inicio', { thread: threadId });
      const writtenReply = (written: string) => {
        const said = partialString(written, 'message')?.text;
        if (said) stream?.(round.teamId, { key: `reply|${threadId}`, kind: 'reply', from, to: arc.to, topic: need.topic, text: said });
      };
      const reply = await deps.model.decide({
        system: systemFor(helper.name),
        prompt: replyPrompt(helper, requester.name, need, message),
        schema: HelpReply,
        ...(stream ? { onText: writtenReply } : {}),
      });
      const help = reply.help.trim().toLowerCase();
      if (!isHelpAnswer(help)) throw new AgentModelError(INCOMPLETE_REPLY);
      deps.agents.addMessage(threadId, helper.token, reply.message.trim());
      deps.agents.setThreadHelp(threadId, help);
      step('checkin.consultar', arc.to, 'fin', { thread: threadId });
      deps.onEvent?.(round.teamId, 'hilo_responde', { ...arc, help });
      return { id: teammateId, name: helper.name, help, message: reply.message.trim() };
    }),
  );
  const replies = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  const unanswered = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (replies.length === 0 && unanswered) throw unanswered.reason;

  const willing = replies.filter((reply) => reply.help !== 'no');
  if (willing.length === 0) return 'sin_ayuda';

  step('propuesta.redactar', from, 'inicio', { willing: willing.length });
  const draft = await deps.model.decide({ system: systemFor(requester.name), prompt: proposalPrompt(requester, need, willing), schema: ProposalDraft });
  step('propuesta.redactar', from, 'fin', { willing: willing.length });
  const willingIds = new Set(willing.map((reply) => reply.id));
  const helperTokens = [...new Set(draft.helpers.filter((id) => willingIds.has(id)))].slice(0, MAX_HELPERS).map((id) => (byId.get(id) as Teammate).card.token);
  const text = draft.text.trim().slice(0, MAX_PROPOSAL_LENGTH);
  if (helperTokens.length === 0 || !text) return 'sin_ayuda';

  const proposal = deps.agents.addProposal({ roundId: round.id, teamId: round.teamId, requesterToken: requester.token, helperTokens, topic: need.topic, text });
  deps.onProposal?.(proposal);
  deps.onEvent?.(round.teamId, 'propuesta_nace', { from, helpers: helperTokens.map(publicIdOf), topic: need.topic, proposal: proposal.id });
  return 'propuesta';
}

const keepEveryCard = () => true;

const CHATTER_TOPIC = 'en qué está';
const MAX_CHATTER_TOPIC = 80;

const LABEL_PREFIX = /^[^:]{1,40}:\s*/;

const GITHUB_LINE = /^En GitHub:\s*(?:.* en )?[^/\s]+\/([^\s:]+)/;

function topicOf(card: AgentCard): string | null {
  const lines = [...card.statements.filter((line) => !line.startsWith('En GitHub')), ...card.statements.filter((line) => line.startsWith('En GitHub'))];
  const line = lines[0];
  if (!line) return card.expertise[0]?.slice(0, MAX_CHATTER_TOPIC) ?? null;
  const repo = GITHUB_LINE.exec(line)?.[1];
  const topic = repo ?? line.replace(LABEL_PREFIX, '').split(' · ')[0]?.replace(/^Trabaja en «(.*)»$/, '$1').trim();
  return topic ? topic.slice(0, MAX_CHATTER_TOPIC) : null;
}

function chatterOf(cards: AgentCard[], limit: number): OpenNeed[] {
  return cards.slice(0, limit).map((requester) => {
    const known = requester.statements.length > 0 || requester.expertise.length > 0;
    return {
      requester,
      need: {
        topic: topicOf(requester) ?? (known ? CHATTER_TOPIC : 'presentarse'),
        statement: known
          ? `${requester.name} está en esto: ${requester.statements.slice(0, 3).join(' · ') || requester.expertise.join(', ')}. Busca con quién cruzarse: alguien que sepa del tema, esté en algo parecido o le pueda servir.`
          : `${requester.name} recién entró a Montu y todavía no tiene actividad en sus fuentes. Quiere presentarse y saber en qué está cada uno.`,
      },
    };
  });
}

export function openNeedsOf(deps: Pick<RoundDeps, 'store' | 'teams' | 'policies' | 'agents' | 'repo' | 'digests' | 'maxNeeds' | 'cardFilter' | 'chatter'>, teamId: string, now: Date): { cards: AgentCard[]; openNeeds: OpenNeed[] } {
  const cards = deps.teams
    .membersOf(teamId)
    .map((member) => cardFor(deps, member, now))
    .filter(deps.cardFilter ?? keepEveryCard);
  const since = new Date(now.getTime() - ACTIVE_PROPOSAL_DAYS * DAY_MS).toISOString();
  const openNeeds = cards
    .flatMap((requester) => {
      const active = deps.agents.activeTopicKeys(teamId, requester.token, since);
      return requester.needs.filter((need) => !active.has(topicKeyOf(need.topic))).map((need) => ({ requester, need }));
    })
    .slice(0, deps.maxNeeds ?? MAX_NEEDS_PER_ROUND);
  if (openNeeds.length === 0 && deps.chatter && cards.length >= MIN_TEAM_SIZE) return { cards, openNeeds: chatterOf(cards, deps.chatter) };
  return { cards, openNeeds };
}

export function meteredModel(model: AgentModel): { model: AgentModel; usage: Omit<RoundUsage, 'needs'> } {
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0, inputChars: 0, measured: true };
  const metered: AgentModel = {
    async decide(request) {
      let reported = false;
      const count = (spent: ModelUsage) => {
        reported = true;
        usage.calls += 1;
        usage.inputTokens += spent.inputTokens;
        usage.outputTokens += spent.outputTokens;
        usage.inputChars += request.system.length + request.prompt.length;
        usage.measured &&= spent.measured;
        request.onUsage?.(spent);
      };
      const answer = await model.decide({ ...request, onUsage: count });
      if (!reported) count({ inputTokens: approximateTokens(request.system + request.prompt), outputTokens: approximateTokens(JSON.stringify(answer)), measured: false });
      return answer;
    },
  };
  return { model: metered, usage };
}

export const problemOf = (reason: unknown): string => (reason instanceof AgentModelError ? reason.message : UNEXPECTED_FAILURE);

export async function refreshTeamDigests(deps: Pick<RoundDeps, 'teams' | 'repo' | 'digests' | 'model'>, teamId: string): Promise<string | null> {
  if (!deps.repo || !deps.digests) return null;
  const failures = await refreshDigests({ repo: deps.repo, digests: deps.digests, model: deps.model }, deps.teams.membersOf(teamId));
  for (const failure of failures) if (!(failure instanceof AgentModelError)) console.error('Reading a repo failed.', failure);
  return failures.length > 0 ? problemOf(failures[0]) : null;
}

export async function runRound(source: RoundDeps, round: Round, now: Date = new Date()): Promise<void> {
  const meter = meteredModel(source.model);
  const deps: RoundDeps = { ...source, model: meter.model };
  let needs = 0;
  const finish = (status: 'lista' | 'fallida', problem: string | null) => {
    deps.agents.saveRoundUsage(round.id, { needs, ...meter.usage });
    deps.agents.finishRound(round.id, status, problem);
    deps.onEvent?.(round.teamId, 'ronda_termina', { round: round.id, status, needs, calls: meter.usage.calls, tokens: meter.usage.inputTokens + meter.usage.outputTokens });
  };
  try {
    deps.onEvent?.(round.teamId, 'ronda_empieza', { round: round.id });
    const unread = await refreshTeamDigests(deps, round.teamId);
    const { cards, openNeeds } = openNeedsOf(deps, round.teamId, now);
    if (cards.length < MIN_TEAM_SIZE) return finish('lista', TEAM_TOO_SMALL);
    needs = openNeeds.length;

    const results = await inBatches(openNeeds, NEEDS_IN_PARALLEL, (openNeed) => resolveNeed(deps, round, openNeed, cards));
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    for (const failure of failures) if (!(failure.reason instanceof AgentModelError)) console.error('Agent round step failed.', failure.reason);

    const problem = failures.length === 0 ? unread : problemOf(failures[0]?.reason);
    const everyNeedFailed = openNeeds.length > 0 && failures.length === openNeeds.length;
    const nothingToAsk = unread !== null && openNeeds.length === 0;
    finish(everyNeedFailed || nothingToAsk ? 'fallida' : 'lista', problem);
  } catch (failure) {
    console.error('Agent round failed.', failure);
    finish('fallida', UNEXPECTED_FAILURE);
  }
}
