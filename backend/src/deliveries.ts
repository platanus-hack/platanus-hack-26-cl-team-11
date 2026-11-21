import type { DatabaseSync } from 'node:sqlite';
import type { SourceId } from './types.js';

export interface Delivery {
  at: string;
  ok: boolean;
  message: string;
}

export interface DeliveryStore {
  record(personToken: string, source: SourceId, delivery: Delivery): void;
  latestBySource(personToken: string): Partial<Record<SourceId, Delivery>>;
}

interface DeliveryRow {
  source: SourceId;
  at: string;
  ok: number;
  message: string;
}

export function openDeliveryStore(db: DatabaseSync): DeliveryStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_deliveries (
      person_token TEXT NOT NULL REFERENCES people (token),
      source TEXT NOT NULL,
      at TEXT NOT NULL,
      ok INTEGER NOT NULL CHECK (ok IN (0, 1)),
      message TEXT NOT NULL,
      PRIMARY KEY (person_token, source)
    );
  `);

  return {
    record(personToken, source, delivery) {
      db.prepare(
        `INSERT INTO push_deliveries (person_token, source, at, ok, message) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (person_token, source) DO UPDATE SET at = excluded.at, ok = excluded.ok, message = excluded.message`,
      ).run(personToken, source, delivery.at, delivery.ok ? 1 : 0, delivery.message);
    },

    latestBySource(personToken) {
      const rows = db.prepare('SELECT source, at, ok, message FROM push_deliveries WHERE person_token = ?').all(personToken) as unknown as DeliveryRow[];
      return Object.fromEntries(rows.map((row) => [row.source, { at: row.at, ok: row.ok === 1, message: row.message }]));
    },
  };
}
