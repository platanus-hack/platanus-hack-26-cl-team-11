import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from '../pg/database.js';

export const MESA_TEAM_ID = 'mesa-publica';
export const MESA_NAME = 'Mesa pública';
export const MIN_INTERVAL_SECONDS = 10;
export const MAX_INTERVAL_SECONDS = 86_400;
export const DEFAULT_MESA_DAILY_TOKEN_CAP = 3_000_000;
export const DEFAULT_MESA_OPERATORS: readonly string[] = ['mati@vita.lat', 'ian@vita.lat', 'lian@vita.lat', 'robert@getvita.ai', 'andres@getvita.ai'];

const INTERVAL_KEY = 'interval_seconds';
const FINGERPRINT_KEY = 'last_fingerprint';

export interface MesaStore {
  intervalSeconds(): number | null;
  setIntervalSeconds(seconds: number | null): void;
  fingerprint(): string | null;
  saveFingerprint(fingerprint: string): void;
  hasLeft(personToken: string): boolean;
  setLeft(personToken: string, left: boolean): void;
}

export const isInterval = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= MIN_INTERVAL_SECONDS && value <= MAX_INTERVAL_SECONDS;

export function openMesaStore(db: DatabaseSync, now: () => Date = () => new Date()): MesaStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mesa_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mesa_left (
      person_token TEXT PRIMARY KEY REFERENCES people (token),
      left_at TEXT NOT NULL
    );
  `);
  db.prepare('INSERT OR IGNORE INTO teams (id, name, join_code, created_at) VALUES (?, ?, ?, ?)').run(MESA_TEAM_ID, MESA_NAME, randomBytes(18).toString('base64url'), now().toISOString());

  const read = (key: string) => (db.prepare('SELECT value FROM mesa_settings WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? null;
  const write = (key: string, value: string) => db.prepare('INSERT INTO mesa_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, value);
  const clear = (key: string) => db.prepare('DELETE FROM mesa_settings WHERE key = ?').run(key);

  return {
    intervalSeconds() {
      const seconds = Number(read(INTERVAL_KEY));
      return isInterval(seconds) ? seconds : null;
    },

    setIntervalSeconds(seconds) {
      if (seconds === null) clear(INTERVAL_KEY);
      else write(INTERVAL_KEY, String(seconds));
    },

    fingerprint: () => read(FINGERPRINT_KEY),
    saveFingerprint: (fingerprint) => void write(FINGERPRINT_KEY, fingerprint),

    hasLeft(personToken) {
      return db.prepare('SELECT 1 FROM mesa_left WHERE person_token = ?').get(personToken) !== undefined;
    },

    setLeft(personToken, left) {
      if (left) db.prepare('INSERT OR IGNORE INTO mesa_left (person_token, left_at) VALUES (?, ?)').run(personToken, now().toISOString());
      else db.prepare('DELETE FROM mesa_left WHERE person_token = ?').run(personToken);
    },
  };
}
