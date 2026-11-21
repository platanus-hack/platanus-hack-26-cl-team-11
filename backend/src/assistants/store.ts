import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { normalizeCode, randomCode, sha256 } from '../codes.js';

export const ASSISTANT_KINDS = ['claude-code', 'claude', 'codex', 'chatgpt', 'grok', 'openclaw', 'cursor', 'gemini', 'instinct', 'otro'] as const;
export type AssistantKind = (typeof ASSISTANT_KINDS)[number];
export const isAssistantKind = (value: unknown): value is AssistantKind => typeof value === 'string' && (ASSISTANT_KINDS as readonly string[]).includes(value);

export const ASSISTANT_NAMES: Record<AssistantKind, string> = {
  'claude-code': 'Claude Code',
  claude: 'Claude',
  codex: 'Codex',
  chatgpt: 'ChatGPT',
  grok: 'Grok',
  openclaw: 'OpenClaw',
  cursor: 'Cursor',
  gemini: 'Gemini',
  instinct: 'Instinct',
  otro: 'Asistente',
};

export const ASSISTANT_TOKEN_PREFIX = 'rda_';
export const PAIRING_MINUTES = 15;
export const MAX_ASSISTANTS_PER_PERSON = 10;
const PAIRING_CODE_LENGTH = 8;
const TOKEN_BYTES = 32;
const MINUTE_MS = 60_000;

export interface Assistant {
  id: string;
  personToken: string;
  kind: AssistantKind;
  label: string;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface Pairing {
  code: string;
  personToken: string;
  expiresAt: string;
}

export type PairingState = 'vigente' | 'usado' | 'vencido' | 'desconocido';

export type Redeemed = { state: 'vigente'; assistant: Assistant; token: string } | { state: Exclude<PairingState, 'vigente'> | 'lleno' };

export interface AssistantStore {
  createPairing(personToken: string): Pairing;
  pairingState(code: string): { state: PairingState; code: string; personToken: string | null; expiresAt: string | null };
  redeem(code: string, kind: AssistantKind, label: string): Redeemed;
  authenticate(token: string): Assistant | undefined;
  assistantsOf(personToken: string): Assistant[];
  revoke(personToken: string, assistantId: string): boolean;
  addPasted(personToken: string, kind: AssistantKind): { label: string; created: boolean };
}

interface PairingRow {
  code: string;
  person_token: string;
  expires_at: string;
  used_at: string | null;
}

interface AssistantRow {
  id: string;
  person_token: string;
  kind: AssistantKind;
  label: string;
  created_at: string;
  last_seen_at: string | null;
}

const ASSISTANT_COLUMNS = 'id, person_token, kind, label, created_at, last_seen_at';

const toAssistant = (row: AssistantRow): Assistant => ({
  id: row.id,
  personToken: row.person_token,
  kind: row.kind,
  label: row.label,
  createdAt: row.created_at,
  lastSeenAt: row.last_seen_at,
});

export function openAssistantStore(db: DatabaseSync, now: () => Date = () => new Date()): AssistantStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_pairings (
      code TEXT PRIMARY KEY,
      person_token TEXT NOT NULL REFERENCES people (token),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS assistants (
      id TEXT PRIMARY KEY,
      person_token TEXT NOT NULL REFERENCES people (token),
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      last_seen_at TEXT,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS assistants_person ON assistants (person_token);
  `);

  const findPairing = (code: string) => db.prepare('SELECT code, person_token, expires_at, used_at FROM assistant_pairings WHERE code = ?').get(normalizeCode(code)) as PairingRow | undefined;

  const stateOf = (row: PairingRow | undefined): PairingState => {
    if (!row) return 'desconocido';
    if (row.used_at) return 'usado';
    return row.expires_at <= now().toISOString() ? 'vencido' : 'vigente';
  };

  const assistantsOf = (personToken: string) =>
    (db.prepare(`SELECT ${ASSISTANT_COLUMNS} FROM assistants WHERE person_token = ? AND revoked_at IS NULL ORDER BY created_at, rowid`).all(personToken) as unknown as AssistantRow[]).map(toAssistant);

  const newToken = () => `${ASSISTANT_TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString('base64url')}`;

  const insert = (personToken: string, kind: AssistantKind, label: string, token: string, instant: string): Assistant => {
    const assistant: Assistant = { id: `asi_${randomBytes(8).toString('hex')}`, personToken, kind, label, createdAt: instant, lastSeenAt: instant };
    db.prepare('INSERT INTO assistants (id, person_token, kind, label, token_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      assistant.id,
      personToken,
      kind,
      label,
      sha256(token),
      instant,
      instant,
    );
    return assistant;
  };

  return {
    createPairing(personToken) {
      const created = now();
      const expiresAt = new Date(created.getTime() + PAIRING_MINUTES * MINUTE_MS).toISOString();
      db.prepare('DELETE FROM assistant_pairings WHERE person_token = ? AND used_at IS NULL').run(personToken);
      const code = randomCode(PAIRING_CODE_LENGTH);
      db.prepare('INSERT INTO assistant_pairings (code, person_token, created_at, expires_at) VALUES (?, ?, ?, ?)').run(code, personToken, created.toISOString(), expiresAt);
      return { code, personToken, expiresAt };
    },

    pairingState(code) {
      const row = findPairing(code);
      return { state: stateOf(row), code: normalizeCode(code), personToken: row?.person_token ?? null, expiresAt: row?.expires_at ?? null };
    },

    redeem(code, kind, label) {
      const row = findPairing(code);
      const state = stateOf(row);
      if (!row || state !== 'vigente') return { state: state === 'vigente' ? 'desconocido' : state };
      if (assistantsOf(row.person_token).length >= MAX_ASSISTANTS_PER_PERSON) return { state: 'lleno' };
      const instant = now().toISOString();
      const claimed = db.prepare('UPDATE assistant_pairings SET used_at = ? WHERE code = ? AND used_at IS NULL').run(instant, row.code);
      if (Number(claimed.changes) !== 1) return { state: 'usado' };
      const token = newToken();
      return { state: 'vigente', assistant: insert(row.person_token, kind, label, token, instant), token };
    },

    authenticate(token) {
      if (!token.startsWith(ASSISTANT_TOKEN_PREFIX)) return undefined;
      const row = db.prepare(`SELECT ${ASSISTANT_COLUMNS} FROM assistants WHERE token_hash = ? AND revoked_at IS NULL`).get(sha256(token)) as AssistantRow | undefined;
      if (!row) return undefined;
      const instant = now().toISOString();
      db.prepare('UPDATE assistants SET last_seen_at = ? WHERE id = ?').run(instant, row.id);
      return { ...toAssistant(row), lastSeenAt: instant };
    },

    assistantsOf,

    addPasted(personToken, kind) {
      const label = `${ASSISTANT_NAMES[kind]} (pegado a mano)`;
      const connected = assistantsOf(personToken);
      if (connected.some((assistant) => assistant.kind === kind && assistant.label === label)) return { label, created: false };
      if (connected.length >= MAX_ASSISTANTS_PER_PERSON) return { label, created: false };
      insert(personToken, kind, label, newToken(), now().toISOString());
      return { label, created: true };
    },

    revoke(personToken, assistantId) {
      const revoked = db.prepare('UPDATE assistants SET revoked_at = ? WHERE id = ? AND person_token = ? AND revoked_at IS NULL').run(now().toISOString(), assistantId, personToken);
      return Number(revoked.changes) === 1;
    },
  };
}
