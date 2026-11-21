import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export const POST_KINDS = ['pregunta', 'pedido', 'propuesta'] as const;
export const POST_STATUSES = ['abierto', 'cerrado'] as const;
export const VOTE_VALUES = ['a_favor', 'en_contra'] as const;
export const MAX_TEXT_LENGTH = 500;
export const MAX_ANSWER_LENGTH = 1200;
export const ANSWER_TIME_LIMIT_MS = 10 * 60_000;
export const ANSWER_TIMED_OUT = 'Los agentes no alcanzaron a responder.';

export type PostKind = (typeof POST_KINDS)[number];
export type PostStatus = (typeof POST_STATUSES)[number];
export type VoteValue = (typeof VOTE_VALUES)[number];
export type AnswerStatus = 'en_curso' | 'lista' | 'fallida';

export interface BoardPost {
  id: string;
  teamId: string;
  authorToken: string;
  authorName: string;
  kind: PostKind;
  text: string;
  createdAt: string;
  status: PostStatus;
}

export interface BoardReply {
  id: string;
  postId: string;
  authorToken: string;
  authorName: string;
  text: string;
  createdAt: string;
  tellable: boolean;
  byAgent: boolean;
}

export interface BoardAnswer {
  postId: string;
  status: AnswerStatus;
  text: string | null;
  sourceTokens: string[];
  asked: number;
  problem: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface AnswerResult {
  status: Exclude<AnswerStatus, 'en_curso'>;
  text: string | null;
  sourceTokens: string[];
  asked: number;
  problem: string | null;
}

export interface BoardVote {
  postId: string;
  voterToken: string;
  value: VoteValue;
}

export interface PostDraft {
  teamId: string;
  authorToken: string;
  kind: PostKind;
  text: string;
}

export interface ReplyDraft {
  postId: string;
  authorToken: string;
  text: string;
  tellable: boolean;
  byAgent?: boolean;
}

export interface BoardStore {
  createPost(draft: PostDraft): BoardPost;
  findPost(id: string): BoardPost | undefined;
  postsOf(teamId: string, status?: PostStatus): BoardPost[];
  closePost(id: string): void;
  addReply(draft: ReplyDraft): BoardReply;
  repliesOf(postId: string): BoardReply[];
  castVote(postId: string, voterToken: string, value: VoteValue): void;
  votesOf(postId: string): BoardVote[];
  startAnswer(postId: string, now: Date): string | null;
  finishAnswer(postId: string, startedAt: string, result: AnswerResult, now: Date): void;
  answerOf(postId: string, now: Date): BoardAnswer | undefined;
  answersRunning(teamId: string, now: Date): number;
  clearAgentReplies(postId: string): void;
}

interface PostRow {
  id: string;
  team_id: string;
  author_token: string;
  author_name: string;
  kind: PostKind;
  text: string;
  created_at: string;
  status: PostStatus;
}

interface ReplyRow {
  id: string;
  post_id: string;
  author_token: string;
  author_name: string;
  text: string;
  created_at: string;
  tellable: number;
  by_agent: number;
}

interface AnswerRow {
  post_id: string;
  status: AnswerStatus;
  text: string | null;
  sources: string;
  asked: number;
  problem: string | null;
  started_at: string;
  finished_at: string | null;
}

interface VoteRow {
  post_id: string;
  voter_token: string;
  value: VoteValue;
}

const isOneOf = <Option extends string>(options: readonly Option[], value: unknown): value is Option =>
  typeof value === 'string' && (options as readonly string[]).includes(value);

export const isPostKind = (value: unknown): value is PostKind => isOneOf(POST_KINDS, value);
export const isPostStatus = (value: unknown): value is PostStatus => isOneOf(POST_STATUSES, value);
export const isVoteValue = (value: unknown): value is VoteValue => isOneOf(VOTE_VALUES, value);

const toPost = (row: PostRow): BoardPost => ({
  id: row.id,
  teamId: row.team_id,
  authorToken: row.author_token,
  authorName: row.author_name,
  kind: row.kind,
  text: row.text,
  createdAt: row.created_at,
  status: row.status,
});

const toReply = (row: ReplyRow): BoardReply => ({
  id: row.id,
  postId: row.post_id,
  authorToken: row.author_token,
  authorName: row.author_name,
  text: row.text,
  createdAt: row.created_at,
  tellable: row.tellable === 1,
  byAgent: row.by_agent === 1,
});

const staleBefore = (now: Date) => new Date(now.getTime() - ANSWER_TIME_LIMIT_MS).toISOString();

const toAnswer = (row: AnswerRow, now: Date): BoardAnswer => {
  const timedOut = row.status === 'en_curso' && row.started_at < staleBefore(now);
  return {
    postId: row.post_id,
    status: timedOut ? 'fallida' : row.status,
    text: row.text,
    sourceTokens: JSON.parse(row.sources) as string[],
    asked: row.asked,
    problem: timedOut ? ANSWER_TIMED_OUT : row.problem,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
};

const toVote = (row: VoteRow): BoardVote => ({ postId: row.post_id, voterToken: row.voter_token, value: row.value });

const POST_COLUMNS = `b.id AS id, b.team_id AS team_id, b.author_token AS author_token, p.name AS author_name,
  b.kind AS kind, b.text AS text, b.created_at AS created_at, b.status AS status`;
const REPLY_COLUMNS = `r.id AS id, r.post_id AS post_id, r.author_token AS author_token, p.name AS author_name,
  r.text AS text, r.created_at AS created_at, r.tellable AS tellable, r.by_agent AS by_agent`;

export function openBoardStore(db: DatabaseSync): BoardStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_posts (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams (id),
      author_token TEXT NOT NULL REFERENCES people (token),
      kind TEXT NOT NULL CHECK (kind IN ('pregunta', 'pedido', 'propuesta')),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto', 'cerrado'))
    );
    CREATE INDEX IF NOT EXISTS board_posts_by_team ON board_posts (team_id, status);
    CREATE TABLE IF NOT EXISTS board_replies (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES board_posts (id),
      author_token TEXT NOT NULL REFERENCES people (token),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      tellable INTEGER NOT NULL DEFAULT 0 CHECK (tellable IN (0, 1))
    );
    CREATE INDEX IF NOT EXISTS board_replies_by_post ON board_replies (post_id);
    CREATE TABLE IF NOT EXISTS board_votes (
      post_id TEXT NOT NULL REFERENCES board_posts (id),
      voter_token TEXT NOT NULL REFERENCES people (token),
      value TEXT NOT NULL CHECK (value IN ('a_favor', 'en_contra')),
      voted_at TEXT NOT NULL,
      PRIMARY KEY (post_id, voter_token)
    );
    CREATE TABLE IF NOT EXISTS board_answers (
      post_id TEXT PRIMARY KEY REFERENCES board_posts (id),
      status TEXT NOT NULL CHECK (status IN ('en_curso', 'lista', 'fallida')),
      text TEXT,
      sources TEXT NOT NULL DEFAULT '[]',
      asked INTEGER NOT NULL DEFAULT 0,
      problem TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT
    );
  `);
  const replyColumns = db.prepare('PRAGMA table_info(board_replies)').all() as unknown as Array<{ name: string }>;
  if (!replyColumns.some((column) => column.name === 'by_agent')) db.exec('ALTER TABLE board_replies ADD COLUMN by_agent INTEGER NOT NULL DEFAULT 0');

  const now = () => new Date().toISOString();

  const findPost = (id: string) => {
    const row = db.prepare(`SELECT ${POST_COLUMNS} FROM board_posts b JOIN people p ON p.token = b.author_token WHERE b.id = ?`).get(id) as
      | PostRow
      | undefined;
    return row ? toPost(row) : undefined;
  };

  const findReply = (id: string) => {
    const row = db.prepare(`SELECT ${REPLY_COLUMNS} FROM board_replies r JOIN people p ON p.token = r.author_token WHERE r.id = ?`).get(id) as
      | ReplyRow
      | undefined;
    return row ? toReply(row) : undefined;
  };

  return {
    createPost(draft) {
      const id = `post_${randomBytes(8).toString('hex')}`;
      db.prepare('INSERT INTO board_posts (id, team_id, author_token, kind, text, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        id,
        draft.teamId,
        draft.authorToken,
        draft.kind,
        draft.text,
        now(),
        'abierto',
      );
      const post = findPost(id);
      if (!post) throw new Error(`Board post ${id} was not stored`);
      return post;
    },

    findPost,

    postsOf(teamId, status) {
      const select = `SELECT ${POST_COLUMNS} FROM board_posts b JOIN people p ON p.token = b.author_token WHERE b.team_id = ?`;
      const newestFirst = 'ORDER BY b.created_at DESC, b.rowid DESC';
      const rows = status
        ? db.prepare(`${select} AND b.status = ? ${newestFirst}`).all(teamId, status)
        : db.prepare(`${select} ${newestFirst}`).all(teamId);
      return (rows as unknown as PostRow[]).map(toPost);
    },

    closePost(id) {
      db.prepare('UPDATE board_posts SET status = ? WHERE id = ?').run('cerrado', id);
    },

    addReply(draft) {
      const id = `reply_${randomBytes(8).toString('hex')}`;
      db.prepare('INSERT INTO board_replies (id, post_id, author_token, text, created_at, tellable, by_agent) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        id,
        draft.postId,
        draft.authorToken,
        draft.text,
        now(),
        draft.tellable ? 1 : 0,
        draft.byAgent ? 1 : 0,
      );
      const reply = findReply(id);
      if (!reply) throw new Error(`Board reply ${id} was not stored`);
      return reply;
    },

    repliesOf(postId) {
      const rows = db
        .prepare(`SELECT ${REPLY_COLUMNS} FROM board_replies r JOIN people p ON p.token = r.author_token WHERE r.post_id = ? ORDER BY r.created_at, r.rowid`)
        .all(postId) as unknown as ReplyRow[];
      return rows.map(toReply);
    },

    castVote(postId, voterToken, value) {
      db.prepare(
        `INSERT INTO board_votes (post_id, voter_token, value, voted_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (post_id, voter_token) DO UPDATE SET value = excluded.value, voted_at = excluded.voted_at`,
      ).run(postId, voterToken, value, now());
    },

    votesOf(postId) {
      const rows = db.prepare('SELECT post_id, voter_token, value FROM board_votes WHERE post_id = ?').all(postId) as unknown as VoteRow[];
      return rows.map(toVote);
    },

    startAnswer(postId, instant) {
      const startedAt = instant.toISOString();
      const started = db
        .prepare(
          `INSERT INTO board_answers (post_id, status, started_at) VALUES (?, 'en_curso', ?)
           ON CONFLICT (post_id) DO UPDATE SET status = 'en_curso', text = NULL, sources = '[]', asked = 0, problem = NULL, started_at = excluded.started_at, finished_at = NULL
           WHERE board_answers.status != 'en_curso' OR board_answers.started_at < ?`,
        )
        .run(postId, startedAt, staleBefore(instant));
      return started.changes > 0 ? startedAt : null;
    },

    finishAnswer(postId, startedAt, result, instant) {
      db.prepare("UPDATE board_answers SET status = ?, text = ?, sources = ?, asked = ?, problem = ?, finished_at = ? WHERE post_id = ? AND status = 'en_curso' AND started_at = ?").run(
        result.status,
        result.text,
        JSON.stringify(result.sourceTokens),
        result.asked,
        result.problem,
        instant.toISOString(),
        postId,
        startedAt,
      );
    },

    answerOf(postId, instant) {
      const row = db.prepare('SELECT post_id, status, text, sources, asked, problem, started_at, finished_at FROM board_answers WHERE post_id = ?').get(postId) as
        | AnswerRow
        | undefined;
      return row ? toAnswer(row, instant) : undefined;
    },

    answersRunning(teamId, instant) {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS running FROM board_answers a JOIN board_posts b ON b.id = a.post_id
           WHERE b.team_id = ? AND a.status = 'en_curso' AND a.started_at >= ?`,
        )
        .get(teamId, staleBefore(instant)) as { running: number };
      return row.running;
    },

    clearAgentReplies(postId) {
      db.prepare('DELETE FROM board_replies WHERE post_id = ? AND by_agent = 1').run(postId);
    },
  };
}
