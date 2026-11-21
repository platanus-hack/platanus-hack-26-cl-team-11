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

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const post = (body?: unknown) => send('POST', body);
const put = (body: unknown) => send('PUT', body);

const personPath = (token: string) => `/api/people/${encodeURIComponent(token)}`;

export const fetchPerson = (token: string) => request<PersonPage>(personPath(token));
export const createPerson = (name: string) => request<CreatedPerson>('/api/people', post({ name }));
export const connectSource = (token: string, source: string, secret: string) =>
  request<{ account: string; imported: number }>(`${personPath(token)}/connections/${source}`, post({ secret }));
export const syncSource = (token: string, source: string) => request<{ imported: number }>(`${personPath(token)}/connections/${source}/sync`, post());
export const oauthStartUrl = (token: string, provider: string) => `${personPath(token)}/oauth/${encodeURIComponent(provider)}/start`;
export const disconnectSource = (token: string, source: string) => request<{ ok: boolean }>(`${personPath(token)}/connections/${source}`, { method: 'DELETE' });

export type Visibility = 'siempre' | 'preguntar' | 'nunca';

export interface LevelSignal {
  level: 'baja' | 'media' | 'alta' | 'sin_datos';
  statement: string;
  basis: string[];
  visibility: Visibility;
}

export interface Blocker {
  topic: string;
  since: string;
  statement: string;
  source: 'checkin' | 'linear';
  visibility: Visibility;
}

export type SignalKey = 'energy' | 'load' | 'blockers' | 'expertise';
export type SignalVisibility = Record<SignalKey, Visibility>;

export interface Signals {
  energy: LevelSignal;
  load: LevelSignal;
  blockers: Blocker[];
  expertise: string[];
  blockerBasis: string[];
  visibility: SignalVisibility;
  asOf: string;
}

export const fetchSignals = (token: string) => request<{ name: string; signals: Signals }>(`${personPath(token)}/signals`);

export const MOODS = ['bien', 'normal', 'cansada', 'mal'] as const;
export type Mood = (typeof MOODS)[number];

export interface CheckinDraft {
  mood: Mood;
  blocker: string | null;
  note: string | null;
}

export interface CheckinEntry extends CheckinDraft {
  at: string;
}

export const fetchCheckins = (token: string) => request<CheckinEntry[]>(`${personPath(token)}/checkins`);
export const recordCheckin = (token: string, checkin: CheckinDraft) =>
  request<{ ok: boolean; signals: Signals }>(`${personPath(token)}/checkins`, post(checkin));

export const VISIBILITIES: readonly Visibility[] = ['siempre', 'preguntar', 'nunca'];
export type Policy = SignalVisibility & { includeInPulse: boolean };

export const fetchPolicy = (token: string) => request<Policy>(`${personPath(token)}/policy`);
export const updatePolicy = (token: string, changes: Partial<Policy>) => request<Policy>(`${personPath(token)}/policy`, put(changes));

export interface TeamSummary {
  id: string;
  name: string;
}

export interface JoinRequest {
  id: string;
  name: string;
  approvals: number;
  needed: number;
  approvedByMe: boolean;
}

export interface Team extends TeamSummary {
  joinCode: string;
  members: string[];
  requests: JoinRequest[];
}

export type JoinStatus = 'pendiente' | 'miembro';

const teamPath = (token: string, teamId: string) => `${personPath(token)}/teams/${encodeURIComponent(teamId)}`;

export const fetchTeams = (token: string) => request<{ teams: Team[]; pending: TeamSummary[] }>(`${personPath(token)}/teams`);
export const createTeam = (token: string, name: string) => request<TeamSummary>(`${personPath(token)}/teams`, post({ name }));
export const joinTeam = (token: string, joinCode: string) => request<TeamSummary & { status: JoinStatus }>(`${personPath(token)}/teams/join`, post({ joinCode }));
export const approveJoin = (token: string, teamId: string, requestId: string) =>
  request<{ status: JoinStatus }>(`${teamPath(token, teamId)}/requests/${encodeURIComponent(requestId)}/approve`, post());
export const leaveTeam = (token: string, teamId: string) => request<{ ok: boolean }>(teamPath(token, teamId), { method: 'DELETE' });

export type PulseLevel = 'baja' | 'media' | 'alta';

interface PulseUnavailable {
  available: false;
  reason: 'grupo_pequeno';
  needed: number;
}

export type PulseSignal = { available: true; level: PulseLevel; contributors: number } | PulseUnavailable;
export type PulseCount = { available: true; total: number; contributors: number } | PulseUnavailable;

export interface Pulse {
  energy: PulseSignal;
  load: PulseSignal;
  blockersOpen: PulseCount;
}

export const fetchPulse = (token: string, teamId: string) => request<{ team: string; members: number; pulse: Pulse }>(`${teamPath(token, teamId)}/pulse`);

export const POST_KINDS = ['pregunta', 'pedido', 'propuesta'] as const;
export type PostKind = (typeof POST_KINDS)[number];
export type VoteValue = 'a_favor' | 'en_contra';

export interface BoardReply {
  id: string;
  postId: string;
  authorName: string;
  text: string | null;
  createdAt: string;
  tellable: boolean;
  mine: boolean;
}

export interface VoteTally {
  aFavor: number;
  enContra: number;
  total: number;
}

export interface BoardPost {
  id: string;
  teamId: string;
  authorName: string;
  kind: PostKind;
  text: string;
  createdAt: string;
  status: 'abierto' | 'cerrado';
  mine: boolean;
  replies: BoardReply[];
  tally: VoteTally | null;
  myVote: VoteValue | null;
}

const boardPostPath = (token: string, postId: string) => `${personPath(token)}/board/${encodeURIComponent(postId)}`;

export const fetchOpenPosts = (token: string, teamId: string) => request<{ posts: BoardPost[] }>(`${teamPath(token, teamId)}/board?status=abierto`);
export const publishPost = (token: string, teamId: string, kind: PostKind, text: string) =>
  request<BoardPost>(`${teamPath(token, teamId)}/board`, post({ kind, text }));
export const replyToPost = (token: string, postId: string, text: string, tellable: boolean) =>
  request<BoardReply>(`${boardPostPath(token, postId)}/replies`, post({ text, tellable }));
export const voteOnPost = (token: string, postId: string, value: VoteValue) =>
  request<VoteTally & { myVote: VoteValue | null }>(`${boardPostPath(token, postId)}/votes`, post({ value }));
export const closePost = (token: string, postId: string) => request<BoardPost>(`${boardPostPath(token, postId)}/close`, post());
