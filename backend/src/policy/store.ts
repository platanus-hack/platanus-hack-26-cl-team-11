import type { DatabaseSync } from 'node:sqlite';
import { DEFAULT_VISIBILITY, type SignalVisibility, type Visibility } from '../signals.js';

export interface Policy extends SignalVisibility {
  includeInPulse: boolean;
}

export const SIGNAL_KEYS = ['energy', 'load', 'blockers', 'expertise'] as const;
export type SignalKey = (typeof SIGNAL_KEYS)[number];

export const VISIBILITIES: readonly Visibility[] = ['siempre', 'preguntar', 'nunca'];
export const isVisibility = (value: unknown): value is Visibility => typeof value === 'string' && (VISIBILITIES as readonly string[]).includes(value);

export const DEFAULT_POLICY: Policy = { ...DEFAULT_VISIBILITY, includeInPulse: true };

export interface PolicyStore {
  get(personToken: string): Policy;
  set(personToken: string, changes: Partial<Policy>): Policy;
}

const PULSE_KEY = 'pulse';

export function openPolicyStore(db: DatabaseSync): PolicyStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS policies (
      person_token TEXT NOT NULL REFERENCES people (token),
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (person_token, key)
    );
  `);

  const upsert = db.prepare('INSERT INTO policies (person_token, key, value) VALUES (?, ?, ?) ON CONFLICT (person_token, key) DO UPDATE SET value = excluded.value');

  const get = (personToken: string): Policy => {
    const rows = db.prepare('SELECT key, value FROM policies WHERE person_token = ?').all(personToken) as unknown as Array<{ key: string; value: string }>;
    const policy: Policy = { ...DEFAULT_POLICY };
    for (const row of rows) {
      if (row.key === PULSE_KEY) policy.includeInPulse = row.value === 'si';
      const signal = SIGNAL_KEYS.find((key) => key === row.key);
      if (signal && isVisibility(row.value)) policy[signal] = row.value;
    }
    return policy;
  };

  return {
    get,
    set(personToken, changes) {
      for (const key of SIGNAL_KEYS) {
        const value = changes[key];
        if (value !== undefined) upsert.run(personToken, key, value);
      }
      if (changes.includeInPulse !== undefined) upsert.run(personToken, PULSE_KEY, changes.includeInPulse ? 'si' : 'no');
      return get(personToken);
    },
  };
}
