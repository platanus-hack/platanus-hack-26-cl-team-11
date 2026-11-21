import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EventDraft, Person, SourceId, StoredEvent } from './types.js';

export interface SourceSync {
  last: string;
  total: number;
}

export interface Store {
  addPerson(name: string): Person;
  findPerson(token: string): Person | undefined;
  saveEvent(personToken: string, draft: EventDraft): StoredEvent;
  listEvents(personToken: string, limit?: number): StoredEvent[];
  syncBySource(personToken: string): Partial<Record<SourceId, SourceSync>>;
}

interface EventRow {
  id: number;
  source: SourceId;
  type: string;
  occurred_at: string;
  summary: string;
  raw: string;
  received_at: string;
}

const defaultDataDir = () => join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

const toEvent = (row: EventRow): StoredEvent => ({
  id: row.id,
  source: row.source,
  type: row.type,
  occurredAt: row.occurred_at,
  summary: row.summary,
  raw: JSON.parse(row.raw),
  receivedAt: row.received_at,
});

export function openStore(location: string = process.env.DATA_DIR || defaultDataDir()): Store {
  const inMemory = location === ':memory:';
  if (!inMemory) mkdirSync(location, { recursive: true });
  const db = new DatabaseSync(inMemory ? ':memory:' : join(location, 'ronda.db'));

  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      token TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_token TEXT NOT NULL REFERENCES people (token),
      source TEXT NOT NULL,
      type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      summary TEXT NOT NULL,
      raw TEXT NOT NULL,
      received_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_person ON events (person_token, id);
  `);

  const now = () => new Date().toISOString();

  return {
    addPerson(name) {
      const person: Person = { token: randomBytes(18).toString('base64url'), name };
      db.prepare('INSERT INTO people (token, name, created_at) VALUES (?, ?, ?)').run(person.token, person.name, now());
      return person;
    },

    findPerson(token) {
      const row = db.prepare('SELECT token, name FROM people WHERE token = ?').get(token) as Person | undefined;
      return row ? { token: row.token, name: row.name } : undefined;
    },

    saveEvent(personToken, draft) {
      const receivedAt = now();
      const result = db
        .prepare('INSERT INTO events (person_token, source, type, occurred_at, summary, raw, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(personToken, draft.source, draft.type, draft.occurredAt, draft.summary, JSON.stringify(draft.raw), receivedAt);
      return { ...draft, id: Number(result.lastInsertRowid), receivedAt };
    },

    listEvents(personToken, limit = 50) {
      const rows = db
        .prepare('SELECT id, source, type, occurred_at, summary, raw, received_at FROM events WHERE person_token = ? ORDER BY id DESC LIMIT ?')
        .all(personToken, limit) as unknown as EventRow[];
      return rows.map(toEvent);
    },

    syncBySource(personToken) {
      const rows = db
        .prepare('SELECT source, MAX(received_at) AS last, COUNT(*) AS total FROM events WHERE person_token = ? GROUP BY source')
        .all(personToken) as unknown as Array<{ source: SourceId; last: string; total: number }>;
      return Object.fromEntries(rows.map((row) => [row.source, { last: row.last, total: Number(row.total) }]));
    },
  };
}
