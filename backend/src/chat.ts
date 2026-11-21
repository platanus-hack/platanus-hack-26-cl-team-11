import type { DatabaseSync } from './pg/database.js';

export const MAX_CHAT_TEXT_LENGTH = 1000;
const DEFAULT_LIMIT = 30;

export interface SaidMessage {
  id: number;
  text: string;
  at: string;
}

export interface ChatStore {
  add(personToken: string, text: string, now: Date): void;
  recent(personToken: string, limit?: number): SaidMessage[];
}

export function openChatStore(db: DatabaseSync): ChatStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_said (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_token TEXT NOT NULL REFERENCES people (token),
      text TEXT NOT NULL,
      at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS chat_said_by_person ON chat_said (person_token, id);
  `);

  return {
    add(personToken, text, now) {
      db.prepare('INSERT INTO chat_said (person_token, text, at) VALUES (?, ?, ?)').run(personToken, text, now.toISOString());
    },
    recent(personToken, limit = DEFAULT_LIMIT) {
      const rows = db.prepare('SELECT id, text, at FROM chat_said WHERE person_token = ? ORDER BY id DESC LIMIT ?').all(personToken, limit) as unknown as SaidMessage[];
      return rows.map((row) => ({ id: Number(row.id), text: row.text, at: row.at })).reverse();
    },
  };
}
