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
}

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
  };
}
