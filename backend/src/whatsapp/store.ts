import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { randomCode } from '../codes.js';

export const LINK_CODE_LENGTH = 6;
export const LINK_CODE_MINUTES = 15;
const MINUTE_MS = 60_000;

export type PromptKind = 'propuesta' | 'permiso';

export interface WhatsAppPrompt {
  id: string;
  personToken: string;
  kind: PromptKind;
  ref: string;
  choice: string | null;
}

export interface PromptOption {
  choice: string;
  title: string;
}

export interface InboxMessage {
  id: number;
  body: string;
  promptId: string | null;
  options: PromptOption[];
  createdAt: string;
}

export interface LinkCode {
  code: string;
  expiresAt: string;
}

export interface WhatsAppStore {
  createCode(personToken: string, now: Date): LinkCode;
  redeemCode(code: string, now: Date): string | undefined;
  link(personToken: string, phone: string, now: Date): void;
  unlink(personToken: string): void;
  phoneOf(personToken: string): string | undefined;
  personOf(phone: string): string | undefined;
  openPrompt(personToken: string, kind: PromptKind, ref: string, now: Date): string | null;
  findPrompt(id: string): WhatsAppPrompt | undefined;
  closePrompt(id: string, choice: string, now: Date): boolean;
  firstDelivery(key: string, now: Date): boolean;
  addMessage(personToken: string, body: string, promptId: string | null, options: PromptOption[], now: Date): number;
  lastMessageId(personToken: string): number;
  messagesAfter(personToken: string, id: number): InboxMessage[];
  recentMessages(personToken: string, limit: number): InboxMessage[];
  openPromptMessages(personToken: string): InboxMessage[];
}

interface MessageRow {
  id: number;
  body: string;
  prompt_id: string | null;
  options: string;
  created_at: string;
}

const MESSAGE_COLUMNS = 'm.id AS id, m.body AS body, m.prompt_id AS prompt_id, m.options AS options, m.created_at AS created_at';

const toMessage = (row: MessageRow): InboxMessage => ({
  id: Number(row.id),
  body: row.body,
  promptId: row.prompt_id,
  options: JSON.parse(row.options) as PromptOption[],
  createdAt: row.created_at,
});

interface PromptRow {
  id: string;
  person_token: string;
  kind: PromptKind;
  ref: string;
  choice: string | null;
}

export function openWhatsAppStore(db: DatabaseSync): WhatsAppStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_links (
      person_token TEXT PRIMARY KEY REFERENCES people (token),
      phone TEXT NOT NULL UNIQUE,
      linked_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS whatsapp_codes (
      code TEXT PRIMARY KEY,
      person_token TEXT NOT NULL REFERENCES people (token),
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS whatsapp_prompts (
      id TEXT PRIMARY KEY,
      person_token TEXT NOT NULL REFERENCES people (token),
      kind TEXT NOT NULL CHECK (kind IN ('propuesta', 'permiso')),
      ref TEXT NOT NULL,
      choice TEXT,
      created_at TEXT NOT NULL,
      answered_at TEXT,
      UNIQUE (person_token, kind, ref)
    );
    CREATE TABLE IF NOT EXISTS agent_inbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_token TEXT NOT NULL REFERENCES people (token),
      body TEXT NOT NULL,
      prompt_id TEXT,
      options TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS agent_inbox_by_person ON agent_inbox (person_token, id);
    CREATE TABLE IF NOT EXISTS whatsapp_deliveries (
      key TEXT PRIMARY KEY,
      received_at TEXT NOT NULL
    );
  `);

  return {
    createCode(personToken, now) {
      db.prepare('DELETE FROM whatsapp_codes WHERE person_token = ? OR expires_at < ?').run(personToken, now.toISOString());
      const code = randomCode(LINK_CODE_LENGTH);
      const expiresAt = new Date(now.getTime() + LINK_CODE_MINUTES * MINUTE_MS).toISOString();
      db.prepare('INSERT INTO whatsapp_codes (code, person_token, expires_at) VALUES (?, ?, ?)').run(code, personToken, expiresAt);
      return { code, expiresAt };
    },

    redeemCode(code, now) {
      const row = db.prepare('SELECT person_token FROM whatsapp_codes WHERE code = ? AND expires_at >= ?').get(code, now.toISOString()) as
        | { person_token: string }
        | undefined;
      if (!row) return undefined;
      db.prepare('DELETE FROM whatsapp_codes WHERE code = ?').run(code);
      return row.person_token;
    },

    link(personToken, phone, now) {
      db.prepare('DELETE FROM whatsapp_links WHERE person_token = ? OR phone = ?').run(personToken, phone);
      db.prepare('INSERT INTO whatsapp_links (person_token, phone, linked_at) VALUES (?, ?, ?)').run(personToken, phone, now.toISOString());
    },

    unlink(personToken) {
      db.prepare('DELETE FROM whatsapp_links WHERE person_token = ?').run(personToken);
    },

    phoneOf(personToken) {
      const row = db.prepare('SELECT phone FROM whatsapp_links WHERE person_token = ?').get(personToken) as { phone: string } | undefined;
      return row?.phone;
    },

    personOf(phone) {
      const row = db.prepare('SELECT person_token FROM whatsapp_links WHERE phone = ?').get(phone) as { person_token: string } | undefined;
      return row?.person_token;
    },

    openPrompt(personToken, kind, ref, now) {
      const id = `wp${randomBytes(8).toString('hex')}`;
      const opened = db
        .prepare('INSERT INTO whatsapp_prompts (id, person_token, kind, ref, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (person_token, kind, ref) DO NOTHING')
        .run(id, personToken, kind, ref, now.toISOString());
      return opened.changes > 0 ? id : null;
    },

    findPrompt(id) {
      const row = db.prepare('SELECT id, person_token, kind, ref, choice FROM whatsapp_prompts WHERE id = ?').get(id) as PromptRow | undefined;
      return row ? { id: row.id, personToken: row.person_token, kind: row.kind, ref: row.ref, choice: row.choice } : undefined;
    },

    closePrompt(id, choice, now) {
      const closed = db.prepare('UPDATE whatsapp_prompts SET choice = ?, answered_at = ? WHERE id = ? AND choice IS NULL').run(choice, now.toISOString(), id);
      return closed.changes > 0;
    },

    firstDelivery(key, now) {
      const stored = db.prepare('INSERT INTO whatsapp_deliveries (key, received_at) VALUES (?, ?) ON CONFLICT (key) DO NOTHING').run(key, now.toISOString());
      return stored.changes > 0;
    },

    addMessage(personToken, body, promptId, options, now) {
      const added = db
        .prepare('INSERT INTO agent_inbox (person_token, body, prompt_id, options, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(personToken, body, promptId, JSON.stringify(options), now.toISOString());
      return Number(added.lastInsertRowid);
    },

    lastMessageId(personToken) {
      const row = db.prepare('SELECT MAX(id) AS last FROM agent_inbox WHERE person_token = ?').get(personToken) as { last: number | null };
      return Number(row.last ?? 0);
    },

    messagesAfter(personToken, id) {
      const rows = db.prepare(`SELECT ${MESSAGE_COLUMNS} FROM agent_inbox m WHERE m.person_token = ? AND m.id > ? ORDER BY m.id`).all(personToken, id) as unknown as MessageRow[];
      return rows.map(toMessage);
    },

    recentMessages(personToken, limit) {
      const rows = db.prepare(`SELECT ${MESSAGE_COLUMNS} FROM agent_inbox m WHERE m.person_token = ? ORDER BY m.id DESC LIMIT ?`).all(personToken, limit) as unknown as MessageRow[];
      return rows.map(toMessage).reverse();
    },

    openPromptMessages(personToken) {
      const rows = db
        .prepare(`SELECT ${MESSAGE_COLUMNS} FROM agent_inbox m JOIN whatsapp_prompts p ON p.id = m.prompt_id WHERE m.person_token = ? AND p.choice IS NULL ORDER BY m.id`)
        .all(personToken) as unknown as MessageRow[];
      return rows.map(toMessage);
    },
  };
}
