export interface SourceSync {
  last: string;
  total: number;
}

export interface SourceConnection {
  account: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface Source {
  id: string;
  label: string;
  how: string;
  connect: 'push' | 'key' | 'oauth' | 'soon';
  provider: string | null;
  sync: SourceSync | null;
  connection: SourceConnection | null;
}

export interface PersonEvent {
  id: number;
  source: string;
  type: string;
  occurredAt: string;
  summary: string;
  receivedAt: string;
}

export interface PersonPage {
  name: string;
  healthIngestPath: string;
  publicBaseUrl: string | null;
  sources: Source[];
  events: PersonEvent[];
}

export interface CreatedPerson {
  token: string;
  name: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? String(body.error) : `Error ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const personPath = (token: string) => `/api/people/${encodeURIComponent(token)}`;

export const fetchPerson = (token: string) => request<PersonPage>(personPath(token));
export const createPerson = (name: string) => request<CreatedPerson>('/api/people', post({ name }));
export const connectSource = (token: string, source: string, secret: string) =>
  request<{ account: string; imported: number }>(`${personPath(token)}/connections/${source}`, post({ secret }));
export const syncSource = (token: string, source: string) => request<{ imported: number }>(`${personPath(token)}/connections/${source}/sync`, post());
export const oauthStartUrl = (token: string, provider: string) => `${personPath(token)}/oauth/${encodeURIComponent(provider)}/start`;
export const disconnectSource = (token: string, source: string) => request<{ ok: boolean }>(`${personPath(token)}/connections/${source}`, { method: 'DELETE' });
