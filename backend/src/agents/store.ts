import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from '../pg/database.js';
import { topicKeyOf, type TopicDecisions } from './cards.js';
import type { HelpAnswer } from './prompts.js';

export type RoundStatus = 'en_curso' | 'lista' | 'fallida';
export type PartyRole = 'pide' | 'ayuda';
export type PartyAnswer = 'pendiente' | 'acepta' | 'rechaza';
export type ProposalStatus = 'por_aprobar' | 'acordada' | 'descartada';

export const PARTY_DECISIONS = ['acepta', 'rechaza'] as const;
export type PartyDecision = (typeof PARTY_DECISIONS)[number];
export const isPartyDecision = (value: unknown): value is PartyDecision => typeof value === 'string' && (PARTY_DECISIONS as readonly string[]).includes(value);

export interface Round {
  id: string;
  teamId: string;
  startedBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: RoundStatus;
  problem: string | null;
}

export interface RoundUsage {
  needs: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  inputChars: number;
  measured: boolean;
}

export interface UsageTotals {
  rounds: number;
  needs: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  inputChars: number;
}

export interface ThreadMessage {
  fromToken: string;
  fromName: string;
  text: string;
  createdAt: string;
}

export interface Thread {
  id: string;
  roundId: string;
  topic: string;
  requesterToken: string;
  requesterName: string;
  helperToken: string;
  helperName: string;
  help: HelpAnswer | null;
  messages: ThreadMessage[];
}

export interface ProposalParty {
  token: string;
  name: string;
  role: PartyRole;
  answer: PartyAnswer;
}

export interface Proposal {
  id: string;
  roundId: string;
  teamId: string;
  topic: string;
  text: string;
  createdAt: string;
  status: ProposalStatus;
  parties: ProposalParty[];
}

export interface ThreadDraft {
  roundId: string;
  requesterToken: string;
  helperToken: string;
  topic: string;
}

export interface ProposalDraftRecord {
  roundId: string;
  teamId: string;
  requesterToken: string;
  helperTokens: string[];
  topic: string;
  text: string;
}

export interface AgentStore {
  startRound(teamId: string, startedBy: string | null): Round | null;
  finishRound(roundId: string, status: RoundStatus, problem: string | null): void;
  latestRound(teamId: string): Round | undefined;
  failRoundsStartedBefore(instant: string, problem: string): void;
  teamIds(): string[];
  addThread(draft: ThreadDraft): string;
  addMessage(threadId: string, fromToken: string, text: string): void;
  setThreadHelp(threadId: string, help: HelpAnswer): void;
  threadsOf(roundId: string): Thread[];
  addProposal(draft: ProposalDraftRecord): Proposal;
  findProposal(proposalId: string): Proposal | undefined;
  proposalsOf(teamId: string, limit?: number): Proposal[];
  answerProposal(proposalId: string, personToken: string, decision: PartyDecision): Proposal | undefined;
  activeTopicKeys(teamId: string, requesterToken: string, since: string): Set<string>;
  decisionsOf(personToken: string): TopicDecisions;
  decideTopic(personToken: string, topic: string, allowed: boolean): void;
  saveRoundUsage(roundId: string, usage: RoundUsage): void;
  usageOfRound(roundId: string): RoundUsage | undefined;
  usageSince(teamId: string, since: string): UsageTotals;
  measuredUsage(rounds?: number): UsageTotals;
}

interface UsageRow {
  needs: number;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  input_chars: number;
  measured: number;
}

interface UsageTotalsRow {
  rounds: number;
  needs: number;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  input_chars: number;
}

interface RoundRow {
  id: string;
  team_id: string;
  started_by: string | null;
  started_at: string;
  finished_at: string | null;
  status: RoundStatus;
  problem: string | null;
}

interface ThreadRow {
  id: string;
  round_id: string;
  topic: string;
  requester_token: string;
  requester_name: string;
  helper_token: string;
  helper_name: string;
  help: HelpAnswer | null;
}

interface MessageRow {
  from_token: string;
  from_name: string;
  text: string;
  created_at: string;
}

interface ProposalRow {
  id: string;
  round_id: string;
  team_id: string;
  topic: string;
  text: string;
  created_at: string;
}

interface PartyRow {
  token: string;
  name: string;
  role: PartyRole;
  answer: PartyAnswer;
}

const DEFAULT_PROPOSAL_LIMIT = 30;
const MEASURED_ROUNDS = 20;
const ACTIVE_ROUND: RoundStatus = 'en_curso';
export const ROUND_TIME_LIMIT_MS = 10 * 60 * 1000;
const TIMED_OUT = 'La ronda tardó demasiado y se dio por terminada.';

const newId = () => randomBytes(9).toString('base64url');

const toRound = (row: RoundRow): Round => ({
  id: row.id,
  teamId: row.team_id,
  startedBy: row.started_by,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  status: row.status,
  problem: row.problem,
});

export function statusOf(parties: ProposalParty[]): ProposalStatus {
  if (parties.some((party) => party.answer === 'rechaza')) return 'descartada';
  return parties.every((party) => party.answer === 'acepta') ? 'acordada' : 'por_aprobar';
}

export function openAgentStore(db: DatabaseSync): AgentStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_rounds (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams (id),
      started_by TEXT REFERENCES people (token),
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      problem TEXT
    );
    CREATE INDEX IF NOT EXISTS agent_rounds_team ON agent_rounds (team_id, started_at);
    CREATE TABLE IF NOT EXISTS agent_round_usage (
      round_id TEXT PRIMARY KEY REFERENCES agent_rounds (id),
      needs INTEGER NOT NULL,
      calls INTEGER NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      input_chars INTEGER NOT NULL,
      measured INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_threads (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL REFERENCES agent_rounds (id),
      requester_token TEXT NOT NULL REFERENCES people (token),
      helper_token TEXT NOT NULL REFERENCES people (token),
      topic TEXT NOT NULL,
      help TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agent_threads_round ON agent_threads (round_id);
    CREATE TABLE IF NOT EXISTS agent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id TEXT NOT NULL REFERENCES agent_threads (id),
      from_token TEXT NOT NULL REFERENCES people (token),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agent_messages_thread ON agent_messages (thread_id, id);
    CREATE TABLE IF NOT EXISTS agent_proposals (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL REFERENCES agent_rounds (id),
      team_id TEXT NOT NULL REFERENCES teams (id),
      requester_token TEXT NOT NULL REFERENCES people (token),
      topic TEXT NOT NULL,
      topic_key TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agent_proposals_team ON agent_proposals (team_id, created_at);
    CREATE TABLE IF NOT EXISTS agent_proposal_parties (
      proposal_id TEXT NOT NULL REFERENCES agent_proposals (id),
      person_token TEXT NOT NULL REFERENCES people (token),
      role TEXT NOT NULL,
      answer TEXT NOT NULL,
      answered_at TEXT,
      PRIMARY KEY (proposal_id, person_token)
    );
    CREATE TABLE IF NOT EXISTS agent_topic_decisions (
      person_token TEXT NOT NULL REFERENCES people (token),
      topic_key TEXT NOT NULL,
      allowed INTEGER NOT NULL,
      decided_at TEXT NOT NULL,
      PRIMARY KEY (person_token, topic_key)
    );
  `);

  const now = () => new Date().toISOString();

  const partiesOf = (proposalId: string): ProposalParty[] =>
    db
      .prepare(
        `SELECT a.person_token AS token, p.name AS name, a.role AS role, a.answer AS answer
         FROM agent_proposal_parties a JOIN people p ON p.token = a.person_token
         WHERE a.proposal_id = ? ORDER BY a.role DESC, p.name`,
      )
      .all(proposalId) as unknown as PartyRow[];

  const toProposal = (row: ProposalRow): Proposal => {
    const parties = partiesOf(row.id);
    return { id: row.id, roundId: row.round_id, teamId: row.team_id, topic: row.topic, text: row.text, createdAt: row.created_at, status: statusOf(parties), parties };
  };

  const findProposal = (proposalId: string): Proposal | undefined => {
    const row = db.prepare('SELECT id, round_id, team_id, topic, text, created_at FROM agent_proposals WHERE id = ?').get(proposalId) as ProposalRow | undefined;
    return row ? toProposal(row) : undefined;
  };

  const messagesOf = (threadId: string): ThreadMessage[] =>
    (
      db
        .prepare(
          `SELECT m.from_token AS from_token, p.name AS from_name, m.text AS text, m.created_at AS created_at
           FROM agent_messages m JOIN people p ON p.token = m.from_token WHERE m.thread_id = ? ORDER BY m.id`,
        )
        .all(threadId) as unknown as MessageRow[]
    ).map((row) => ({ fromToken: row.from_token, fromName: row.from_name, text: row.text, createdAt: row.created_at }));

  const USAGE_SUMS =
    'COUNT(*) AS rounds, COALESCE(SUM(u.needs), 0) AS needs, COALESCE(SUM(u.calls), 0) AS calls, COALESCE(SUM(u.input_tokens), 0) AS input_tokens, COALESCE(SUM(u.output_tokens), 0) AS output_tokens, COALESCE(SUM(u.input_chars), 0) AS input_chars';

  const toTotals = (row: UsageTotalsRow | undefined): UsageTotals => ({
    rounds: Number(row?.rounds ?? 0),
    needs: Number(row?.needs ?? 0),
    calls: Number(row?.calls ?? 0),
    inputTokens: Number(row?.input_tokens ?? 0),
    outputTokens: Number(row?.output_tokens ?? 0),
    inputChars: Number(row?.input_chars ?? 0),
  });

  return {
    startRound(teamId, startedBy) {
      const deadline = new Date(Date.now() - ROUND_TIME_LIMIT_MS).toISOString();
      db.prepare('UPDATE agent_rounds SET status = ?, problem = ?, finished_at = ? WHERE team_id = ? AND status = ? AND started_at < ?').run(
        'fallida',
        TIMED_OUT,
        now(),
        teamId,
        ACTIVE_ROUND,
        deadline,
      );
      const running = db.prepare('SELECT 1 FROM agent_rounds WHERE team_id = ? AND status = ?').get(teamId, ACTIVE_ROUND);
      if (running) return null;
      const round: Round = { id: newId(), teamId, startedBy, startedAt: now(), finishedAt: null, status: ACTIVE_ROUND, problem: null };
      db.prepare('INSERT INTO agent_rounds (id, team_id, started_by, started_at, status) VALUES (?, ?, ?, ?, ?)').run(
        round.id,
        teamId,
        startedBy,
        round.startedAt,
        round.status,
      );
      return round;
    },

    finishRound(roundId, status, problem) {
      db.prepare('UPDATE agent_rounds SET status = ?, problem = ?, finished_at = ? WHERE id = ? AND status = ?').run(status, problem, now(), roundId, ACTIVE_ROUND);
    },

    latestRound(teamId) {
      const row = db.prepare('SELECT * FROM agent_rounds WHERE team_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1').get(teamId) as RoundRow | undefined;
      return row ? toRound(row) : undefined;
    },

    failRoundsStartedBefore(instant, problem) {
      db.prepare('UPDATE agent_rounds SET status = ?, problem = ?, finished_at = ? WHERE status = ? AND started_at < ?').run(
        'fallida',
        problem,
        now(),
        ACTIVE_ROUND,
        instant,
      );
    },

    teamIds() {
      return (db.prepare('SELECT id FROM teams ORDER BY created_at').all() as unknown as Array<{ id: string }>).map((row) => row.id);
    },

    saveRoundUsage(roundId, usage) {
      db.prepare(
        `INSERT INTO agent_round_usage (round_id, needs, calls, input_tokens, output_tokens, input_chars, measured) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (round_id) DO UPDATE SET needs = excluded.needs, calls = excluded.calls, input_tokens = excluded.input_tokens,
           output_tokens = excluded.output_tokens, input_chars = excluded.input_chars, measured = excluded.measured`,
      ).run(roundId, usage.needs, usage.calls, usage.inputTokens, usage.outputTokens, usage.inputChars, usage.measured ? 1 : 0);
    },

    usageOfRound(roundId) {
      const row = db.prepare('SELECT needs, calls, input_tokens, output_tokens, input_chars, measured FROM agent_round_usage WHERE round_id = ?').get(roundId) as UsageRow | undefined;
      if (!row) return undefined;
      return {
        needs: Number(row.needs),
        calls: Number(row.calls),
        inputTokens: Number(row.input_tokens),
        outputTokens: Number(row.output_tokens),
        inputChars: Number(row.input_chars),
        measured: Number(row.measured) === 1,
      };
    },

    usageSince(teamId, since) {
      return toTotals(
        db.prepare(`SELECT ${USAGE_SUMS} FROM agent_round_usage u JOIN agent_rounds r ON r.id = u.round_id WHERE r.team_id = ? AND r.started_at >= ?`).get(teamId, since) as UsageTotalsRow | undefined,
      );
    },

    measuredUsage(rounds = MEASURED_ROUNDS) {
      return toTotals(
        db
          .prepare(
            `SELECT ${USAGE_SUMS} FROM (
               SELECT u.* FROM agent_round_usage u JOIN agent_rounds r ON r.id = u.round_id
               WHERE u.calls > 0 AND u.measured = 1 ORDER BY r.started_at DESC, r.rowid DESC LIMIT ?
             ) u`,
          )
          .get(rounds) as UsageTotalsRow | undefined,
      );
    },

    addThread(draft) {
      const id = newId();
      db.prepare('INSERT INTO agent_threads (id, round_id, requester_token, helper_token, topic, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        id,
        draft.roundId,
        draft.requesterToken,
        draft.helperToken,
        draft.topic,
        now(),
      );
      return id;
    },

    addMessage(threadId, fromToken, text) {
      db.prepare('INSERT INTO agent_messages (thread_id, from_token, text, created_at) VALUES (?, ?, ?, ?)').run(threadId, fromToken, text, now());
    },

    setThreadHelp(threadId, help) {
      db.prepare('UPDATE agent_threads SET help = ? WHERE id = ?').run(help, threadId);
    },

    threadsOf(roundId) {
      const rows = db
        .prepare(
          `SELECT t.id AS id, t.round_id AS round_id, t.topic AS topic, t.requester_token AS requester_token, r.name AS requester_name,
                  t.helper_token AS helper_token, h.name AS helper_name, t.help AS help
           FROM agent_threads t JOIN people r ON r.token = t.requester_token JOIN people h ON h.token = t.helper_token
           WHERE t.round_id = ? ORDER BY t.created_at, t.rowid`,
        )
        .all(roundId) as unknown as ThreadRow[];
      return rows.map((row) => ({
        id: row.id,
        roundId: row.round_id,
        topic: row.topic,
        requesterToken: row.requester_token,
        requesterName: row.requester_name,
        helperToken: row.helper_token,
        helperName: row.helper_name,
        help: row.help,
        messages: messagesOf(row.id),
      }));
    },

    addProposal(draft) {
      const id = newId();
      db.prepare('INSERT INTO agent_proposals (id, round_id, team_id, requester_token, topic, topic_key, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        id,
        draft.roundId,
        draft.teamId,
        draft.requesterToken,
        draft.topic,
        topicKeyOf(draft.topic),
        draft.text,
        now(),
      );
      const addParty = db.prepare('INSERT OR IGNORE INTO agent_proposal_parties (proposal_id, person_token, role, answer) VALUES (?, ?, ?, ?)');
      addParty.run(id, draft.requesterToken, 'pide', 'pendiente');
      for (const helperToken of draft.helperTokens) addParty.run(id, helperToken, 'ayuda', 'pendiente');
      return findProposal(id) as Proposal;
    },

    findProposal,

    proposalsOf(teamId, limit = DEFAULT_PROPOSAL_LIMIT) {
      const rows = db
        .prepare('SELECT id, round_id, team_id, topic, text, created_at FROM agent_proposals WHERE team_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?')
        .all(teamId, limit) as unknown as ProposalRow[];
      return rows.map(toProposal);
    },

    answerProposal(proposalId, personToken, decision) {
      db.prepare('UPDATE agent_proposal_parties SET answer = ?, answered_at = ? WHERE proposal_id = ? AND person_token = ?').run(
        decision,
        now(),
        proposalId,
        personToken,
      );
      return findProposal(proposalId);
    },

    activeTopicKeys(teamId, requesterToken, since) {
      const rows = db
        .prepare('SELECT id, topic_key FROM agent_proposals WHERE team_id = ? AND requester_token = ? AND created_at >= ?')
        .all(teamId, requesterToken, since) as unknown as Array<{ id: string; topic_key: string }>;
      return new Set(rows.filter((row) => statusOf(partiesOf(row.id)) !== 'descartada').map((row) => row.topic_key));
    },

    decisionsOf(personToken) {
      const rows = db.prepare('SELECT topic_key, allowed FROM agent_topic_decisions WHERE person_token = ?').all(personToken) as unknown as Array<{
        topic_key: string;
        allowed: number;
      }>;
      return {
        released: new Set(rows.filter((row) => row.allowed === 1).map((row) => row.topic_key)),
        denied: new Set(rows.filter((row) => row.allowed !== 1).map((row) => row.topic_key)),
      };
    },

    decideTopic(personToken, topic, allowed) {
      db.prepare(
        `INSERT INTO agent_topic_decisions (person_token, topic_key, allowed, decided_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (person_token, topic_key) DO UPDATE SET allowed = excluded.allowed, decided_at = excluded.decided_at`,
      ).run(personToken, topicKeyOf(topic), allowed ? 1 : 0, now());
    },
  };
}
