import type { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import type { Vault } from './crypto.js';
import type { Connection, EventDraft, Person, SourceId, StoredEvent } from './types.js';

export interface SourceSync {
  last: string;
  total: number;
}

export interface Store {
  addPerson(name: string): Person;
  findPerson(token: string): Person | undefined;
  saveEvent(personToken: string, draft: EventDraft): StoredEvent | null;
  listEvents(personToken: string, limit?: number): StoredEvent[];
  syncBySource(personToken: string): Partial<Record<SourceId, SourceSync>>;
  saveConnection(personToken: string, source: SourceId, account: string, secret: string): void;
  findConnection(personToken: string, source: SourceId): Connection | undefined;
  listConnections(personToken: string): Connection[];
  listAllConnections(): Array<{ personToken: string; source: SourceId }>;
  updateSecret(personToken: string, source: SourceId, secret: string): void;
  markSynced(personToken: string, source: SourceId, error: string | null): void;
  removeConnection(personToken: string, source: SourceId): void;
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

interface ConnectionRow {
  source: SourceId;
  account: string;
  secret_sealed: string;
  connected_at: string;
  last_synced_at: string | null;
  last_error: string | null;
}

const toEvent = (row: EventRow): StoredEvent => ({
  id: row.id,
  source: row.source,
  type: row.type,
  occurredAt: row.occurred_at,
  summary: row.summary,
  raw: JSON.parse(row.raw),
  receivedAt: row.received_at,
});

export function openStore(db: DatabaseSync, vault: Vault): Store {

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
    CREATE TABLE IF NOT EXISTS connections (
      person_token TEXT NOT NULL REFERENCES people (token),
      source TEXT NOT NULL,
      account TEXT NOT NULL,
      secret_sealed TEXT NOT NULL,
      connected_at TEXT NOT NULL,
      last_synced_at TEXT,
      last_error TEXT,
      PRIMARY KEY (person_token, source)
    );
  `);

  const eventColumns = db.prepare('PRAGMA table_info(events)').all() as unknown as Array<{ name: string }>;
  if (!eventColumns.some((column) => column.name === 'external_id')) db.exec('ALTER TABLE events ADD COLUMN external_id TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS events_external ON events (person_token, source, external_id) WHERE external_id IS NOT NULL');

  const now = () => new Date().toISOString();

  const toConnection = (row: ConnectionRow): Connection => ({
    source: row.source,
    account: row.account,
    secret: vault.open(row.secret_sealed),
    connectedAt: row.connected_at,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
  });

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
        .prepare(
          'INSERT OR IGNORE INTO events (person_token, source, type, occurred_at, summary, raw, received_at, external_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(personToken, draft.source, draft.type, draft.occurredAt, draft.summary, JSON.stringify(draft.raw), receivedAt, draft.externalId ?? null);
      return Number(result.changes) ? { ...draft, id: Number(result.lastInsertRowid), receivedAt } : null;
    },

    listEvents(personToken, limit = 50) {
      const rows = db
        .prepare('SELECT id, source, type, occurred_at, summary, raw, received_at FROM events WHERE person_token = ? ORDER BY occurred_at DESC, id DESC LIMIT ?')
        .all(personToken, limit) as unknown as EventRow[];
      return rows.map(toEvent);
    },

    syncBySource(personToken) {
      const rows = db
        .prepare('SELECT source, MAX(received_at) AS last, COUNT(*) AS total FROM events WHERE person_token = ? GROUP BY source')
        .all(personToken) as unknown as Array<{ source: SourceId; last: string; total: number }>;
      return Object.fromEntries(rows.map((row) => [row.source, { last: row.last, total: Number(row.total) }]));
    },

    saveConnection(personToken, source, account, secret) {
      db.prepare(
        `INSERT INTO connections (person_token, source, account, secret_sealed, connected_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (person_token, source) DO UPDATE SET account = excluded.account, secret_sealed = excluded.secret_sealed, connected_at = excluded.connected_at, last_error = NULL`,
      ).run(personToken, source, account, vault.seal(secret), now());
    },

    findConnection(personToken, source) {
      const row = db.prepare('SELECT * FROM connections WHERE person_token = ? AND source = ?').get(personToken, source) as ConnectionRow | undefined;
      return row ? toConnection(row) : undefined;
    },

    listConnections(personToken) {
      const rows = db.prepare('SELECT * FROM connections WHERE person_token = ?').all(personToken) as unknown as ConnectionRow[];
      return rows.map(toConnection);
    },

    listAllConnections() {
      const rows = db.prepare('SELECT person_token, source FROM connections ORDER BY person_token, source').all() as unknown as Array<{ person_token: string; source: SourceId }>;
      return rows.map((row) => ({ personToken: row.person_token, source: row.source }));
    },

    updateSecret(personToken, source, secret) {
      db.prepare('UPDATE connections SET secret_sealed = ? WHERE person_token = ? AND source = ?').run(vault.seal(secret), personToken, source);
    },

    markSynced(personToken, source, error) {
      db.prepare('UPDATE connections SET last_synced_at = ?, last_error = ? WHERE person_token = ? AND source = ?').run(now(), error, personToken, source);
    },

    removeConnection(personToken, source) {
      db.prepare('DELETE FROM connections WHERE person_token = ? AND source = ?').run(personToken, source);
      db.prepare('DELETE FROM events WHERE person_token = ? AND source = ?').run(personToken, source);
    },
  };
}
