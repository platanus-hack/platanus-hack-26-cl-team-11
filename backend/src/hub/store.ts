import type { DatabaseSync } from '../pg/database.js';

export interface HubItem {
  id: number;
  source: string;
  summary: string;
  topics: string[];
  occurredAt: string;
  receivedAt: string;
}

export interface HubConnection {
  source: string;
  account: string;
  connectedAt: string;
}

export interface HubItemDraft {
  source: string;
  summary: string;
  topics: string[];
  occurredAt: string;
}

export interface HubStore {
  connect(personToken: string, source: string, account: string): HubConnection;
  disconnect(personToken: string, source: string): void;
  connections(personToken: string): HubConnection[];
  addItem(personToken: string, draft: HubItemDraft): HubItem;
  items(personToken: string, source: string, limit: number): HubItem[];
  countBySource(personToken: string): Record<string, number>;
}

interface ItemRow {
  id: number;
  source: string;
  summary: string;
  topics: string;
  occurred_at: string;
  received_at: string;
}

const toItem = (row: ItemRow): HubItem => ({
  id: Number(row.id),
  source: row.source,
  summary: row.summary,
  topics: JSON.parse(row.topics) as string[],
  occurredAt: row.occurred_at,
  receivedAt: row.received_at,
});

export function openHubStore(db: DatabaseSync, now: () => Date = () => new Date()): HubStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hub_connections (
      person_token TEXT NOT NULL,
      source TEXT NOT NULL,
      account TEXT NOT NULL,
      connected_at TEXT NOT NULL,
      PRIMARY KEY (person_token, source)
    );
    CREATE TABLE IF NOT EXISTS hub_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_token TEXT NOT NULL,
      source TEXT NOT NULL,
      summary TEXT NOT NULL,
      topics TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      received_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS hub_items_person ON hub_items (person_token, source, occurred_at);
  `);

  return {
    connect(personToken, source, account) {
      const connectedAt = now().toISOString();
      db.prepare(
        `INSERT INTO hub_connections (person_token, source, account, connected_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (person_token, source) DO UPDATE SET account = excluded.account`,
      ).run(personToken, source, account, connectedAt);
      return db
        .prepare('SELECT source, account, connected_at AS connectedAt FROM hub_connections WHERE person_token = ? AND source = ?')
        .get(personToken, source) as unknown as HubConnection;
    },

    disconnect(personToken, source) {
      db.prepare('DELETE FROM hub_connections WHERE person_token = ? AND source = ?').run(personToken, source);
      db.prepare('DELETE FROM hub_items WHERE person_token = ? AND source = ?').run(personToken, source);
    },

    connections(personToken) {
      return db
        .prepare('SELECT source, account, connected_at AS connectedAt FROM hub_connections WHERE person_token = ? ORDER BY connected_at, source')
        .all(personToken) as unknown as HubConnection[];
    },

    addItem(personToken, draft) {
      const receivedAt = now().toISOString();
      const result = db
        .prepare('INSERT INTO hub_items (person_token, source, summary, topics, occurred_at, received_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(personToken, draft.source, draft.summary, JSON.stringify(draft.topics), draft.occurredAt, receivedAt);
      return { ...draft, id: Number(result.lastInsertRowid), receivedAt };
    },

    items(personToken, source, limit) {
      const rows = db
        .prepare('SELECT id, source, summary, topics, occurred_at, received_at FROM hub_items WHERE person_token = ? AND source = ? ORDER BY occurred_at DESC, id DESC LIMIT ?')
        .all(personToken, source, limit) as unknown as ItemRow[];
      return rows.map(toItem);
    },

    countBySource(personToken) {
      const rows = db
        .prepare('SELECT source, COUNT(*) AS total FROM hub_items WHERE person_token = ? GROUP BY source')
        .all(personToken) as unknown as Array<{ source: string; total: number }>;
      return Object.fromEntries(rows.map((row) => [row.source, Number(row.total)]));
    },
  };
}
