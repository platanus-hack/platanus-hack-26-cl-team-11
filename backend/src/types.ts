export type SourceId = string;
export type JsonObject = Record<string, unknown>;
export type Fetch = typeof fetch;

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

interface ConnectorInfo {
  id: SourceId;
  label: string;
  how: string;
}

export interface PushConnector extends ConnectorInfo {
  kind: 'push';
  ingestSlug: string;
  toEvent(payload: JsonObject, receivedAt?: string): EventDraft;
}

export interface KeyConnector extends ConnectorInfo {
  kind: 'key';
  identify(secret: string, fetchImpl: Fetch): Promise<string>;
  pull(secret: string, account: string, since: Date, fetchImpl: Fetch): Promise<EventDraft[]>;
}

export interface OAuthConnector extends ConnectorInfo {
  kind: 'oauth';
  provider: string;
  scopes: string[];
  pull(accessToken: string, account: string, since: Date, fetchImpl: Fetch): Promise<EventDraft[]>;
}

export interface SoonConnector extends ConnectorInfo {
  kind: 'soon';
}

export type Connector = PushConnector | KeyConnector | OAuthConnector | SoonConnector;

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
}

export interface OAuthProvider {
  id: string;
  authorizeUrl(input: { credentials: OAuthCredentials; redirectUri: string; scopes: string[]; state: string }): string;
  exchange(code: string, credentials: OAuthCredentials, redirectUri: string, fetchImpl: Fetch): Promise<OAuthTokens>;
  refresh(refreshToken: string, credentials: OAuthCredentials, fetchImpl: Fetch): Promise<OAuthTokens>;
  identify(accessToken: string, fetchImpl: Fetch): Promise<string>;
}

export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly status: number = 502,
  ) {
    super(message);
  }
}
