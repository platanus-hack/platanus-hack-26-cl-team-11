export interface SourceSync {
  last: string;
  total: number;
}

export interface SourceConnection {
  account: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface Delivery {
  at: string;
  ok: boolean;
  message: string;
}

export interface Source {
  id: string;
  label: string;
  how: string;
  connect: 'push' | 'key' | 'oauth' | 'soon';
  provider: string | null;
  configured?: boolean;
  sync: SourceSync | null;
  delivery?: Delivery | null;
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

export interface HealthShortcut {
  url: string;
  name: string;
}

export interface PersonLogin {
  email: string | null;
  available: boolean;
}

export interface PersonPage {
  name: string;
  healthIngestPath: string;
  publicBaseUrl: string | null;
  healthShortcut: HealthShortcut | null;
  login?: PersonLogin;
  sources: Source[];
  events: PersonEvent[];
}

export interface CreatedPerson {
  token: string;
  name: string;
}

const RESTARTING_STATUSES = [502, 503, 504];
const RETRY_WAITS_MS = [1500, 3000, 5000, 8000, 10_000, 12_000];
const RESTARTING = 'El servidor se está reiniciando. Prueba de nuevo en un momento.';

const pause = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

async function fetchThroughRestart(path: string, init?: RequestInit): Promise<Response> {
  for (const wait of RETRY_WAITS_MS) {
    const response = await fetch(path, init).catch(() => null);
    if (response && !RESTARTING_STATUSES.includes(response.status)) return response;
    await pause(wait);
  }
  const last = await fetch(path, init).catch(() => null);
  if (!last || RESTARTING_STATUSES.includes(last.status)) throw new Error(RESTARTING);
  return last;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchThroughRestart(path, init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? String(body.error) : `Error ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

export const send = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const post = (body?: unknown) => send('POST', body);
const put = (body: unknown) => send('PUT', body);

export const personPath = (token: string) => `/api/people/${encodeURIComponent(token)}`;

export const fetchPerson = (token: string) => request<PersonPage>(personPath(token));

export type OnboardingStepId = 'equipo' | 'agente' | 'checkin' | 'whatsapp' | 'salud';

export interface OnboardingStep {
  id: OnboardingStepId;
  done: boolean;
}

export const fetchOnboarding = (token: string) => request<{ steps: OnboardingStep[]; pending: number }>(`${personPath(token)}/onboarding`);
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
  focus: string[];
  blockerBasis: string[];
  visibility: SignalVisibility;
  asOf: string;
}

export interface SummaryMeeting {
  title: string;
  start: string;
  minutes: number;
}

export interface SummaryTask {
  title: string;
  due: string | null;
}

export interface Summary {
  lines: string[];
  meetings: SummaryMeeting[];
  working: SummaryTask[];
  topics: string[];
  sleep: { lastHours: number | null; weekHours: number | null; usualHours: number | null };
  move: { workoutMinutes: number | null; steps: number | null };
  asOf: string;
}

export interface ChatOption {
  id: string;
  label: string;
}

export interface ChatMessage {
  key: string;
  role: 'persona' | 'agente';
  text: string;
  at: string;
  options: ChatOption[];
}

export interface ChatView {
  messages: ChatMessage[];
  configured: boolean;
  whatsapp: WhatsAppStatus;
}

const jsonPost = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const fetchChat = (token: string) => request<ChatView>(`${personPath(token)}/chat`);
export const sendChat = (token: string, text: string) => request<ChatView>(`${personPath(token)}/chat`, jsonPost({ text }));
export const answerChat = (token: string, option: string) => request<ChatView>(`${personPath(token)}/chat/answer`, jsonPost({ option }));

export type TeamValue<Value> = { available: true; value: Value; contributors: number } | { available: false; needed: number };

export interface OverviewMember {
  name: string;
  me: boolean;
  shares: boolean;
  energy: LevelSignal['level'] | null;
  sleepHours: number | null;
  steps: number | null;
  workoutMinutes: number | null;
}

export interface TeamOverview {
  members: OverviewMember[];
  energy: TeamValue<'baja' | 'media' | 'alta'>;
  sleepHours: TeamValue<number>;
  steps: TeamValue<number>;
}

export const fetchTeamOverview = (token: string, teamId: string) => request<TeamOverview>(`${personPath(token)}/teams/${encodeURIComponent(teamId)}/overview`);

export interface Profile {
  goal: string | null;
  guide: string | null;
}

export const fetchProfile = (token: string) => request<Profile>(`${personPath(token)}/profile`);
export const saveProfile = (token: string, changes: Partial<Profile>) =>
  request<Profile>(`${personPath(token)}/profile`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(changes) });

export const fetchSignals = (token: string) => request<{ name: string; signals: Signals; summary: Summary }>(`${personPath(token)}/signals`);

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

export interface TeamPerson {
  id: string;
  name: string;
  admin: boolean;
  me: boolean;
  pending: OnboardingStepId[] | null;
}

export interface TeamInvite {
  code: string;
  path: string;
  expiresAt: string;
}

export interface Team extends TeamSummary {
  joinCode: string;
  roomCode: string | null;
  members: string[];
  admin: boolean;
  people: TeamPerson[];
  invites: TeamInvite[];
  requests: JoinRequest[];
}

export interface InviteSummary {
  team: string;
  people: number;
  expiresAt: string;
}

export type JoinStatus = 'pendiente' | 'miembro';

const teamPath = (token: string, teamId: string) => `${personPath(token)}/teams/${encodeURIComponent(teamId)}`;

export const fetchTeams = (token: string) => request<{ teams: Team[]; pending: TeamSummary[] }>(`${personPath(token)}/teams`);
export const createTeam = (token: string, name: string) => request<TeamSummary>(`${personPath(token)}/teams`, post({ name }));
export const joinTeam = (token: string, joinCode: string) => request<TeamSummary & { status: JoinStatus }>(`${personPath(token)}/teams/join`, post({ joinCode }));
export const approveJoin = (token: string, teamId: string, requestId: string) =>
  request<{ status: JoinStatus }>(`${teamPath(token, teamId)}/requests/${encodeURIComponent(requestId)}/approve`, post());
export const leaveTeam = (token: string, teamId: string) => request<{ ok: boolean }>(teamPath(token, teamId), { method: 'DELETE' });
export const createInvite = (token: string, teamId: string) => request<TeamInvite>(`${teamPath(token, teamId)}/invites`, post());
export const revokeInvite = (token: string, teamId: string, code: string) => request<{ ok: boolean }>(`${teamPath(token, teamId)}/invites/${encodeURIComponent(code)}`, { method: 'DELETE' });
export const removeMember = (token: string, teamId: string, memberId: string) =>
  request<{ ok: boolean }>(`${teamPath(token, teamId)}/members/${encodeURIComponent(memberId)}`, { method: 'DELETE' });
export const makeAdmin = (token: string, teamId: string, memberId: string) => request<{ ok: boolean }>(`${teamPath(token, teamId)}/members/${encodeURIComponent(memberId)}/admin`, post());
export const fetchInvite = (code: string) => request<InviteSummary>(`/api/invites/${encodeURIComponent(code)}`);
export const joinInvite = (code: string, who: { name: string } | { token: string }) =>
  request<{ token: string; name: string; team: TeamSummary }>(`/api/invites/${encodeURIComponent(code)}/join`, post(who));

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
  byAgent: boolean;
  mine: boolean;
}

export interface BoardAnswer {
  status: 'en_curso' | 'lista' | 'fallida';
  text: string | null;
  sources: string[];
  asked: number;
  problem: string | null;
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
  answer: BoardAnswer | null;
  tally: VoteTally | null;
  myVote: VoteValue | null;
}

const boardPostPath = (token: string, postId: string) => `${personPath(token)}/board/${encodeURIComponent(postId)}`;

export const fetchOpenPosts = (token: string, teamId: string) => request<{ configured: boolean; posts: BoardPost[] }>(`${teamPath(token, teamId)}/board?status=abierto`);
export const publishPost = (token: string, teamId: string, kind: PostKind, text: string) =>
  request<BoardPost>(`${teamPath(token, teamId)}/board`, post({ kind, text }));
export const replyToPost = (token: string, postId: string, text: string, tellable: boolean) =>
  request<BoardReply>(`${boardPostPath(token, postId)}/replies`, post({ text, tellable }));
export const voteOnPost = (token: string, postId: string, value: VoteValue) =>
  request<VoteTally & { myVote: VoteValue | null }>(`${boardPostPath(token, postId)}/votes`, post({ value }));
export const closePost = (token: string, postId: string) => request<BoardPost>(`${boardPostPath(token, postId)}/close`, post());
export const askAgents = (token: string, postId: string) => request<BoardPost>(`${boardPostPath(token, postId)}/ask`, post());

export type RoundStatus = 'en_curso' | 'lista' | 'fallida';
export type HelpAnswer = 'si' | 'parcial' | 'no';
export type PartyRole = 'pide' | 'ayuda';
export type PartyAnswer = 'pendiente' | 'acepta' | 'rechaza';
export type PartyDecision = 'acepta' | 'rechaza';
export type ProposalStatus = 'por_aprobar' | 'acordada' | 'descartada';

export interface AgentRound {
  id: string;
  status: RoundStatus;
  startedAt: string;
  finishedAt: string | null;
  problem: string | null;
}

export interface AgentAsk {
  topic: string;
  statement: string;
}

export interface AgentMessage {
  fromName: string;
  text: string;
  createdAt: string;
}

export interface AgentThread {
  id: string;
  topic: string;
  requesterName: string;
  helperName: string;
  help: HelpAnswer | null;
  mine: boolean;
  messages: AgentMessage[] | null;
}

export interface ProposalParty {
  name: string;
  role: PartyRole;
  answer: PartyAnswer;
  me: boolean;
}

export interface AgentProposal {
  id: string;
  topic: string;
  text: string;
  createdAt: string;
  status: ProposalStatus;
  parties: ProposalParty[];
  myAnswer: PartyAnswer | null;
}

export interface AgentsView {
  configured: boolean;
  round: AgentRound | null;
  asks: AgentAsk[];
  threads: AgentThread[];
  proposals: AgentProposal[];
}

const agentsPath = (token: string) => `${personPath(token)}/agents`;

export const fetchAgents = (token: string, teamId: string) => request<AgentsView>(`${teamPath(token, teamId)}/agents`);
export const startRound = (token: string, teamId: string) => request<{ id: string }>(`${teamPath(token, teamId)}/agents/rounds`, post());
export const decideAsk = (token: string, topic: string, allow: boolean) => request<{ topic: string; allow: boolean }>(`${agentsPath(token)}/asks`, post({ topic, allow }));
export const answerProposal = (token: string, proposalId: string, answer: PartyDecision) =>
  request<AgentProposal>(`${agentsPath(token)}/proposals/${encodeURIComponent(proposalId)}/answer`, post({ answer }));

export interface WhatsAppStatus {
  configured: boolean;
  linked: boolean;
  phoneEnding: string | null;
}

export interface WhatsAppLink {
  code: string;
  url: string | null;
  expiresAt: string;
}

const whatsappPath = (token: string) => `${personPath(token)}/whatsapp`;

export const fetchWhatsApp = (token: string) => request<WhatsAppStatus>(whatsappPath(token));
export const startWhatsAppLink = (token: string) => request<WhatsAppLink>(`${whatsappPath(token)}/link`, post());
export const disconnectWhatsApp = (token: string) => request<WhatsAppStatus>(whatsappPath(token), { method: 'DELETE' });

export const GOOGLE_LOGIN_PATH = '/api/login/google/start';
export const googleLinkPath = (token: string) => `${personPath(token)}/login/google/start`;
export const fetchLoginOptions = () => request<{ google: boolean }>('/api/login');
