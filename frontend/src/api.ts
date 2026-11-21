export interface SourceSync {
  last: string;
  total: number;
}

export interface Source {
  id: string;
  label: string;
  how: string;
  available: boolean;
  sync: SourceSync | null;
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

export const fetchPerson = (token: string) => request<PersonPage>(`/api/people/${encodeURIComponent(token)}`);

export const createPerson = (name: string) =>
  request<CreatedPerson>('/api/people', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
