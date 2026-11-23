import type { DatabaseSync } from '../pg/database.js';
import type { NudgeKind } from './detectors.js';

export interface NudgeStore {
  record(personToken: string, kind: NudgeKind, ref: string, now: Date): boolean;
  countSince(personToken: string, since: string): number;
}

export function openNudgeStore(db: DatabaseSync): NudgeStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nudges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_token TEXT NOT NULL REFERENCES people (token),
      kind TEXT NOT NULL,
      ref TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (person_token, kind, ref)
    );
    CREATE INDEX IF NOT EXISTS nudges_by_person ON nudges (person_token, created_at);
  `);

  return {
    record(personToken, kind, ref, now) {
      const saved = db.prepare('INSERT INTO nudges (person_token, kind, ref, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (person_token, kind, ref) DO NOTHING').run(personToken, kind, ref, now.toISOString());
      return Number(saved.changes) === 1;
    },

    countSince(personToken, since) {
      const row = db.prepare('SELECT COUNT(*) AS total FROM nudges WHERE person_token = ? AND created_at >= ?').get(personToken, since) as { total: number } | undefined;
      return Number(row?.total ?? 0);
    },
  };
}
