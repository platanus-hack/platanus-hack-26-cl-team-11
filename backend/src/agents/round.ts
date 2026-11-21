import { publicIdOf } from '../codes.js';
import type { Store } from '../db.js';
import { withChosenVisibility, type PolicyStore } from '../policy/store.js';
import { deriveSignals } from '../signals.js';
import type { RepoStore } from '../repo/store.js';
import type { RoomEventType } from '../rooms/store.js';
import type { TeamStore } from '../teams/store.js';
import type { JsonObject } from '../types.js';
import { buildCard, topicKeyOf, type AgentCard, type Need } from './cards.js';
import { currentDigest, refreshDigests, type DigestStore } from './digest.js';
import { AgentModelError, type AgentModel } from './model.js';
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
import type { AgentStore, Round } from './store.js';

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
  maxNeeds?: number;
}

interface OpenNeed {
  requester: AgentCard;
  need: Need;
}

export function cardFor(deps: Pick<RoundDeps, 'store' | 'policies' | 'agents' | 'repo' | 'digests'>, member: { token: string; name: string }, now: Date): AgentCard {
  const signals = withChosenVisibility(deriveSignals(deps.store.listSignalEvents(member.token, now), now), deps.policies.chosen(member.token));
  const repo = deps.repo && deps.digests ? currentDigest({ repo: deps.repo, digests: deps.digests }, member.token) : undefined;
  return buildCard({ token: member.token, name: member.name, signals, decisions: deps.agents.decisionsOf(member.token), repo });
}

export async function inBatches<Item>(items: Item[], size: number, work: (item: Item) => Promise<void>): Promise<PromiseSettledResult<void>[]> {
  const results: PromiseSettledResult<void>[] = [];
  for (let start = 0; start < items.length; start += size) {
    results.push(...(await Promise.allSettled(items.slice(start, start + size).map(work))));
  }
  return results;
}

async function resolveNeed(deps: RoundDeps, round: Round, { requester, need }: OpenNeed, cards: AgentCard[]): Promise<void> {
  const teammates: Teammate[] = cards.filter((card) => card.token !== requester.token).map((card, position) => ({ id: `p${position + 1}`, card }));
  const byId = new Map(teammates.map((teammate) => [teammate.id, teammate]));

  const plan = await deps.model.decide({ system: systemFor(requester.name), prompt: contactPrompt(need, teammates), schema: ContactPlan });
  const contacts = new Map<string, string>();
  for (const contact of plan.contacts) {
    const message = contact.message.trim();
    if (byId.has(contact.teammate) && message && !contacts.has(contact.teammate) && contacts.size < MAX_CONTACTS) contacts.set(contact.teammate, message);
  }

  const settled = await Promise.allSettled(
    [...contacts].map(async ([teammateId, message]): Promise<CollectedReply> => {
      const helper = (byId.get(teammateId) as Teammate).card;
      const threadId = deps.agents.addThread({ roundId: round.id, requesterToken: requester.token, helperToken: helper.token, topic: need.topic });
      deps.agents.addMessage(threadId, requester.token, message);
      const arc = { thread: threadId, from: publicIdOf(requester.token), to: publicIdOf(helper.token), topic: need.topic };
      deps.onEvent?.(round.teamId, 'hilo_abre', arc);
      const reply = await deps.model.decide({ system: systemFor(helper.name), prompt: replyPrompt(helper, requester.name, need, message), schema: HelpReply });
      const help = reply.help.trim().toLowerCase();
      if (!isHelpAnswer(help)) throw new AgentModelError(INCOMPLETE_REPLY);
      deps.agents.addMessage(threadId, helper.token, reply.message.trim());
      deps.agents.setThreadHelp(threadId, help);
      deps.onEvent?.(round.teamId, 'hilo_responde', { ...arc, help });
      return { id: teammateId, name: helper.name, help, message: reply.message.trim() };
    }),
  );
  const replies = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  const unanswered = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (replies.length === 0 && unanswered) throw unanswered.reason;

  const willing = replies.filter((reply) => reply.help !== 'no');
  if (willing.length === 0) return;

  const draft = await deps.model.decide({ system: systemFor(requester.name), prompt: proposalPrompt(requester, need, willing), schema: ProposalDraft });
  const willingIds = new Set(willing.map((reply) => reply.id));
  const helperTokens = [...new Set(draft.helpers.filter((id) => willingIds.has(id)))].slice(0, MAX_HELPERS).map((id) => (byId.get(id) as Teammate).card.token);
  const text = draft.text.trim().slice(0, MAX_PROPOSAL_LENGTH);
  if (helperTokens.length === 0 || !text) return;

  deps.agents.addProposal({ roundId: round.id, teamId: round.teamId, requesterToken: requester.token, helperTokens, topic: need.topic, text });
  deps.onEvent?.(round.teamId, 'propuesta_nace', { from: publicIdOf(requester.token), helpers: helperTokens.map(publicIdOf), topic: need.topic });
}

export function openNeedsOf(deps: Pick<RoundDeps, 'store' | 'teams' | 'policies' | 'agents' | 'repo' | 'digests' | 'maxNeeds'>, teamId: string, now: Date): { cards: AgentCard[]; openNeeds: OpenNeed[] } {
  const cards = deps.teams.membersOf(teamId).map((member) => cardFor(deps, member, now));
  const since = new Date(now.getTime() - ACTIVE_PROPOSAL_DAYS * DAY_MS).toISOString();
  const openNeeds = cards
    .flatMap((requester) => {
      const active = deps.agents.activeTopicKeys(teamId, requester.token, since);
      return requester.needs.filter((need) => !active.has(topicKeyOf(need.topic))).map((need) => ({ requester, need }));
    })
    .slice(0, deps.maxNeeds ?? MAX_NEEDS_PER_ROUND);
  return { cards, openNeeds };
}

export const problemOf = (reason: unknown): string => (reason instanceof AgentModelError ? reason.message : UNEXPECTED_FAILURE);

export async function refreshTeamDigests(deps: Pick<RoundDeps, 'teams' | 'repo' | 'digests' | 'model'>, teamId: string): Promise<string | null> {
  if (!deps.repo || !deps.digests) return null;
  const failures = await refreshDigests({ repo: deps.repo, digests: deps.digests, model: deps.model }, deps.teams.membersOf(teamId));
  for (const failure of failures) if (!(failure instanceof AgentModelError)) console.error('Reading a repo failed.', failure);
  return failures.length > 0 ? problemOf(failures[0]) : null;
}

export async function runRound(deps: RoundDeps, round: Round, now: Date = new Date()): Promise<void> {
  const finish = (status: 'lista' | 'fallida', problem: string | null) => {
    deps.agents.finishRound(round.id, status, problem);
    deps.onEvent?.(round.teamId, 'ronda_termina', { round: round.id, status });
  };
  try {
    deps.onEvent?.(round.teamId, 'ronda_empieza', { round: round.id });
    const unread = await refreshTeamDigests(deps, round.teamId);
    const { cards, openNeeds } = openNeedsOf(deps, round.teamId, now);
    if (cards.length < MIN_TEAM_SIZE) return finish('lista', TEAM_TOO_SMALL);

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
