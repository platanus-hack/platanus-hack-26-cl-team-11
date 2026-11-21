import { currentDigest, filesWithinBudget } from './digest.js';
import { APPROXIMATE_CHARS_PER_TOKEN } from './model.js';
import { contactPrompt, MAX_CONTACTS, proposalPrompt, replyPrompt, systemFor, type CollectedReply, type Teammate } from './prompts.js';
import { MIN_TEAM_SIZE, openNeedsOf, type RoundDeps } from './round.js';

const CALLS_AROUND_CONTACTS = 2;
const DEFAULT_CONTACTS_PER_NEED = 2;
const DEFAULT_OUTPUT_TOKENS_PER_CALL = 150;
const DIGEST_INSTRUCTION_CHARS = 700;
const SAMPLE_MESSAGE = 'm'.repeat(220);

export interface RoundEstimate {
  people: number;
  needs: number;
  digests: number;
  calls: { min: number; likely: number; max: number };
  tokens: { input: number; output: number; total: number; max: number };
  measured: boolean;
}

export type EstimateDeps = Pick<RoundDeps, 'store' | 'teams' | 'policies' | 'agents' | 'repo' | 'digests' | 'maxNeeds'>;

const mean = (values: number[]) => (values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length);

const sampleReplies = (teammates: Teammate[], count: number): CollectedReply[] =>
  teammates.slice(0, count).map((teammate) => ({ id: teammate.id, name: teammate.card.name, help: 'si', message: SAMPLE_MESSAGE }));

function digestCharsOf(deps: EstimateDeps, teamId: string): number[] {
  const { repo, digests } = deps;
  if (!repo || !digests) return [];
  return deps.teams
    .membersOf(teamId)
    .filter((member) => repo.version(member.token) > 0 && !currentDigest({ repo, digests }, member.token))
    .map((member) => DIGEST_INSTRUCTION_CHARS + filesWithinBudget(repo.shared(member.token)).reduce((total, file) => total + file.content.length, 0));
}

export function estimateRound(deps: EstimateDeps, teamId: string, now: Date = new Date()): RoundEstimate {
  const history = deps.agents.measuredUsage();
  const tokensPerChar = history.inputChars > 0 ? history.inputTokens / history.inputChars : 1 / APPROXIMATE_CHARS_PER_TOKEN;
  const outputPerCall = history.calls > 0 ? history.outputTokens / history.calls : DEFAULT_OUTPUT_TOKENS_PER_CALL;
  const usualContacts = history.needs > 0 ? history.calls / history.needs - CALLS_AROUND_CONTACTS : DEFAULT_CONTACTS_PER_NEED;

  const digestChars = digestCharsOf(deps, teamId);
  const { cards, openNeeds } = openNeedsOf(deps, teamId, now);
  const needs = cards.length < MIN_TEAM_SIZE ? [] : openNeeds;

  let likelyChars = digestChars.reduce((total, chars) => total + chars, 0);
  let maxChars = likelyChars;
  let likelyCalls = digestChars.length;
  let maxCalls = digestChars.length;

  for (const { requester, need } of needs) {
    const teammates: Teammate[] = cards.filter((card) => card.token !== requester.token).map((card, position) => ({ id: `p${position + 1}`, card }));
    const mostContacts = Math.min(MAX_CONTACTS, teammates.length);
    const contacts = Math.max(0, Math.min(mostContacts, usualContacts));
    const system = systemFor(requester.name).length;
    const plan = system + contactPrompt(need, teammates).length;
    const reply = mean(teammates.map((teammate) => systemFor(teammate.card.name).length + replyPrompt(teammate.card, requester.name, need, SAMPLE_MESSAGE).length));
    const proposal = (count: number) => system + proposalPrompt(requester, need, sampleReplies(teammates, count)).length;

    likelyChars += plan + contacts * reply + proposal(Math.round(contacts));
    maxChars += plan + mostContacts * reply + proposal(mostContacts);
    likelyCalls += CALLS_AROUND_CONTACTS + contacts;
    maxCalls += CALLS_AROUND_CONTACTS + mostContacts;
  }

  const input = Math.round(likelyChars * tokensPerChar);
  const output = Math.round(likelyCalls * outputPerCall);
  return {
    people: cards.length,
    needs: needs.length,
    digests: digestChars.length,
    calls: { min: digestChars.length + needs.length, likely: Math.round(likelyCalls), max: maxCalls },
    tokens: { input, output, total: input + output, max: Math.round(maxChars * tokensPerChar + maxCalls * outputPerCall) },
    measured: history.rounds > 0,
  };
}
