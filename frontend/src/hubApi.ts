export interface HubItem {
  id: number;
  source: string;
  summary: string;
  topics: string[];
  occurredAt: string;
  receivedAt: string;
}

export interface HubSource {
  id: string;
  label: string;
  category: string;
  how: string;
  connected: boolean;
  account: string | null;
  connectedAt: string | null;
  lastUpdate: string | null;
  total: number;
  items: HubItem[];
}

export interface HubLink {
  a: string;
  b: string;
  topics: Array<{ id: string; label: string }>;
}

export interface ContextMap {
  name: string;
  mock: true;
  topics: Record<string, string>;
  sources: HubSource[];
  links: HubLink[];
}

async function call<T>(path: string, method = 'GET'): Promise<T> {
  const response = await fetch(path, { method });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body && typeof body === 'object' && 'error' in body ? String(body.error) : `Error ${response.status}`);
  return body as T;
}

export const contextPath = (token: string) => `/api/context/${encodeURIComponent(token)}`;
export const fetchContext = (token: string) => call<ContextMap>(contextPath(token));
export const connectMock = (token: string, source: string) => call<unknown>(`${contextPath(token)}/sources/${source}`, 'POST');
export const disconnectMock = (token: string, source: string) => call<unknown>(`${contextPath(token)}/sources/${source}`, 'DELETE');
export const simulatePush = (token: string) => call<{ item: HubItem | null }>(`${contextPath(token)}/simulate`, 'POST');
