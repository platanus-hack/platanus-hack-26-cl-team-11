export const SOURCES = [
  { id: 'apple_health', label: 'Apple Health', how: 'Atajo de iOS', available: true },
  { id: 'google_calendar', label: 'Google Calendar', how: 'Cuenta de Google', available: false },
  { id: 'gmail', label: 'Gmail', how: 'Cuenta de Google', available: false },
  { id: 'granola', label: 'Granola', how: 'Llave personal', available: false },
  { id: 'github', label: 'GitHub', how: 'Cuenta de GitHub', available: false },
] as const;

export type SourceId = (typeof SOURCES)[number]['id'];

export interface Person {
  token: string;
  name: string;
}

export interface EventDraft {
  source: SourceId;
  type: string;
  occurredAt: string;
  summary: string;
  raw: unknown;
}

export interface StoredEvent extends EventDraft {
  id: number;
  receivedAt: string;
}

export type JsonObject = Record<string, unknown>;
