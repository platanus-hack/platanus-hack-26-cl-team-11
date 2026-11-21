import { personPath, post, request, send, type Visibility } from './api';

export const ASSISTANT_KINDS = ['claude-code', 'claude', 'codex', 'chatgpt', 'grok', 'openclaw', 'cursor', 'gemini', 'instinct', 'otro'] as const;
export type AssistantKind = (typeof ASSISTANT_KINDS)[number];

export const ASSISTANT_NAME: Record<AssistantKind, string> = {
  'claude-code': 'Claude Code',
  claude: 'Claude',
  codex: 'Codex',
  chatgpt: 'ChatGPT',
  grok: 'Grok',
  openclaw: 'OpenClaw',
  cursor: 'Cursor',
  gemini: 'Gemini',
  instinct: 'Instinct',
  otro: 'Otro asistente',
};

export interface Assistant {
  id: string;
  kind: AssistantKind;
  label: string;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface Pairing {
  code: string;
  path: string;
  expiresAt: string;
  minutes: number;
}

export interface RepoEntry {
  path: string;
  share: Visibility;
  size: number;
  updatedAt: string;
  updatedBy: string;
}

export interface RepoFile extends RepoEntry {
  content: string;
}

export interface RepoCommit {
  id: number;
  message: string;
  by: string;
  createdAt: string;
}

export interface RoomSummary {
  code: string;
  name: string;
  people: number;
  assistants: number;
}

export interface RoomPerson {
  id: string;
  name: string;
  assistants: AssistantKind[];
}

export interface RoomState {
  code: string;
  name: string;
  people: RoomPerson[];
  lastEventId: number;
}

export interface Joined {
  token: string;
  name: string;
  room: { code: string; name: string };
}

const roomPath = (code: string) => `/api/rooms/${encodeURIComponent(code)}`;
const repoFilePath = (token: string, path: string) => `${personPath(token)}/repo/file?path=${encodeURIComponent(path)}`;

export const createRoom = (name: string) => request<{ code: string; name: string }>('/api/rooms', post({ name }));
export const fetchRoom = (code: string) => request<RoomSummary>(roomPath(code));
export const fetchRoomState = (code: string) => request<RoomState>(`${roomPath(code)}/state`);
export const joinRoom = (code: string, who: { name: string } | { token: string }) => request<Joined>(`${roomPath(code)}/join`, post(who));

export const fetchAssistants = (token: string) => request<{ assistants: Assistant[] }>(`${personPath(token)}/assistants`);
export const createPairing = (token: string) => request<Pairing>(`${personPath(token)}/assistants/pairings`, post());
export const removeAssistant = (token: string, assistantId: string) =>
  request<{ ok: boolean }>(`${personPath(token)}/assistants/${encodeURIComponent(assistantId)}`, { method: 'DELETE' });

export const fetchRepo = (token: string) => request<{ files: RepoEntry[]; log: RepoCommit[] }>(`${personPath(token)}/repo`);
export const fetchRepoFile = (token: string, path: string) => request<RepoFile>(repoFilePath(token, path));
export const setRepoShare = (token: string, path: string, share: Visibility) => request<{ path: string; share: Visibility }>(`${personPath(token)}/repo/file`, send('PATCH', { path, share }));
export const deleteRepoFile = (token: string, path: string) => request<{ ok: boolean }>(repoFilePath(token, path), { method: 'DELETE' });
export const pasteAnswer = (token: string, kind: AssistantKind, content: string) => request<{ path: string }>(`${personPath(token)}/repo/paste`, post({ kind, content }));
