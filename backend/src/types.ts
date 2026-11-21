export const SOURCES = [
  { id: 'apple_health', label: 'Apple Health', how: 'Atajo de iOS', connect: 'push' },
  { id: 'granola', label: 'Granola', how: 'Llave personal', connect: 'key' },
  { id: 'github', label: 'GitHub', how: 'Token personal', connect: 'key' },
  { id: 'google_calendar', label: 'Google Calendar', how: 'Cuenta de Google', connect: 'soon' },
  { id: 'gmail', label: 'Gmail', how: 'Cuenta de Google', connect: 'soon' },
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
  externalId?: string;
}

export interface StoredEvent extends EventDraft {
  id: number;
  receivedAt: string;
}

export interface Connection {
  source: SourceId;
  account: string;
  secret: string;
  connectedAt: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export type JsonObject = Record<string, unknown>;
export type Fetch = typeof fetch;

export interface KeyConnector {
  identify(secret: string, fetchImpl: Fetch): Promise<string>;
  pull(secret: string, account: string, since: Date, fetchImpl: Fetch): Promise<EventDraft[]>;
}

export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly status: number = 502,
  ) {
    super(message);
  }
}
