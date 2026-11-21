import type { DatabaseSync } from 'node:sqlite';
import type { Visibility } from '../signals.js';

export const DEFAULT_SHARE: Visibility = 'preguntar';
export const MAX_REPO_FILES = 200;

export interface RepoEntry {
  path: string;
  share: Visibility;
  size: number;
  updatedAt: string;
  updatedBy: string;
}

export interface RepoFile extends RepoEntry {
  content: string;
}

export interface RepoCommit {
  id: number;
  message: string;
  topics: string[];
  paths: string[];
  by: string;
  createdAt: string;
}

export interface FileDraft {
  path: string;
  content: string;
  share?: Visibility;
}

export interface CommitDraft {
  by: string;
  message: string;
  topics: string[];
  files: FileDraft[];
  remove: string[];
}

export type CommitResult = { ok: true; commit: RepoCommit } | { ok: false; reason: 'lleno' };

export interface RepoStore {
  tree(personToken: string): RepoEntry[];
  read(personToken: string, path: string): RepoFile | undefined;
  commit(personToken: string, draft: CommitDraft): CommitResult;
  setShare(personToken: string, path: string, share: Visibility): boolean;
  remove(personToken: string, path: string, by: string): boolean;
  log(personToken: string, limit: number): RepoCommit[];
  version(personToken: string): number;
  readable(personToken: string): RepoFile[];
}

interface FileRow {
  path: string;
  content: string;
  share: Visibility;
  updated_at: string;
  updated_by: string;
}

interface CommitRow {
  id: number;
  message: string;
  topics: string;
  paths: string;
  author: string;
  created_at: string;
}

const FILE_COLUMNS = 'path, content, share, updated_at, updated_by';

const toFile = (row: FileRow): RepoFile => ({
  path: row.path,
  content: row.content,
  share: row.share,
  size: Buffer.byteLength(row.content),
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});

const toEntry = ({ content: _content, ...entry }: RepoFile): RepoEntry => entry;

const toCommit = (row: CommitRow): RepoCommit => ({
  id: Number(row.id),
  message: row.message,
  topics: JSON.parse(row.topics) as string[],
  paths: JSON.parse(row.paths) as string[],
  by: row.author,
  createdAt: row.created_at,
});

export function openRepoStore(db: DatabaseSync, now: () => Date = () => new Date()): RepoStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS repo_files (
      person_token TEXT NOT NULL REFERENCES people (token),
      path TEXT NOT NULL,
      content TEXT NOT NULL,
      share TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      PRIMARY KEY (person_token, path)
    );
    CREATE TABLE IF NOT EXISTS repo_commits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_token TEXT NOT NULL REFERENCES people (token),
      author TEXT NOT NULL,
      message TEXT NOT NULL,
      topics TEXT NOT NULL,
      paths TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS repo_commits_person ON repo_commits (person_token, id);
  `);

  const files = (personToken: string) =>
    (db.prepare(`SELECT ${FILE_COLUMNS} FROM repo_files WHERE person_token = ? ORDER BY path`).all(personToken) as unknown as FileRow[]).map(toFile);

  const addCommit = (personToken: string, by: string, message: string, topics: string[], paths: string[]): RepoCommit => {
    const createdAt = now().toISOString();
    const inserted = db
      .prepare('INSERT INTO repo_commits (person_token, author, message, topics, paths, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(personToken, by, message, JSON.stringify(topics), JSON.stringify(paths), createdAt);
    return { id: Number(inserted.lastInsertRowid), message, topics, paths, by, createdAt };
  };

  const pathsOf = (personToken: string) =>
    new Set((db.prepare('SELECT path FROM repo_files WHERE person_token = ?').all(personToken) as unknown as Array<{ path: string }>).map((row) => row.path));

  return {
    tree: (personToken) => files(personToken).map(toEntry),

    read(personToken, path) {
      const row = db.prepare(`SELECT ${FILE_COLUMNS} FROM repo_files WHERE person_token = ? AND path = ?`).get(personToken, path) as FileRow | undefined;
      return row ? toFile(row) : undefined;
    },

    commit(personToken, draft) {
      const existing = pathsOf(personToken);
      const removed = draft.remove.filter((path) => existing.has(path));
      const kept = new Set([...existing].filter((path) => !removed.includes(path)));
      for (const file of draft.files) kept.add(file.path);
      if (kept.size > MAX_REPO_FILES) return { ok: false, reason: 'lleno' };

      const instant = now().toISOString();
      const insert = db.prepare('INSERT INTO repo_files (person_token, path, content, share, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)');
      const update = db.prepare('UPDATE repo_files SET content = ?, updated_at = ?, updated_by = ? WHERE person_token = ? AND path = ?');
      const drop = db.prepare('DELETE FROM repo_files WHERE person_token = ? AND path = ?');
      db.exec('BEGIN');
      try {
        for (const path of removed) drop.run(personToken, path);
        for (const file of draft.files) {
          if (existing.has(file.path) && !removed.includes(file.path)) update.run(file.content, instant, draft.by, personToken, file.path);
          else insert.run(personToken, file.path, file.content, file.share ?? DEFAULT_SHARE, instant, draft.by);
        }
        const commit = addCommit(personToken, draft.by, draft.message, draft.topics, [...draft.files.map((file) => file.path), ...removed]);
        db.exec('COMMIT');
        return { ok: true, commit };
      } catch (failure) {
        db.exec('ROLLBACK');
        throw failure;
      }
    },

    setShare(personToken, path, share) {
      const changed = db.prepare('UPDATE repo_files SET share = ? WHERE person_token = ? AND path = ?').run(share, personToken, path);
      if (Number(changed.changes) !== 1) return false;
      addCommit(personToken, 'persona', `Permiso de ${path}: ${share}`, [], [path]);
      return true;
    },

    remove(personToken, path, by) {
      const dropped = db.prepare('DELETE FROM repo_files WHERE person_token = ? AND path = ?').run(personToken, path);
      if (Number(dropped.changes) !== 1) return false;
      addCommit(personToken, by, `Borra ${path}`, [], [path]);
      return true;
    },

    log(personToken, limit) {
      const rows = db
        .prepare('SELECT id, message, topics, paths, author, created_at FROM repo_commits WHERE person_token = ? ORDER BY id DESC LIMIT ?')
        .all(personToken, limit) as unknown as CommitRow[];
      return rows.map(toCommit);
    },

    version(personToken) {
      const row = db.prepare('SELECT MAX(id) AS last FROM repo_commits WHERE person_token = ?').get(personToken) as { last: number | null } | undefined;
      return Number(row?.last ?? 0);
    },

    readable: (personToken) => files(personToken).filter((file) => file.share !== 'nunca'),
  };
}
