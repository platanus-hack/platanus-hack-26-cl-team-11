import type { SignalKey, Policy } from '../policy/store.js';
import type { Signals } from '../signals.js';

export type Mood = 'bien' | 'normal' | 'cansada' | 'mal';
export type PostKind = 'pregunta' | 'pedido' | 'propuesta';

export interface RecordCheckin {
  type: 'record_checkin';
  mood: Mood;
  blocker: string | null;
  note: string | null;
}

export interface PostToBoard {
  type: 'post_to_board';
  teamId: string;
  kind: PostKind;
  text: string;
  discloses: SignalKey[];
}

export interface ReplyToPost {
  type: 'reply_to_post';
  postId: string;
  text: string;
  tellable: boolean;
  discloses: SignalKey[];
}

export type SharingAction = PostToBoard | ReplyToPost;
export type AgentAction = RecordCheckin | SharingAction;

export interface ChatTurn {
  from: 'owner' | 'agent';
  text: string;
  at: string;
}

export interface BoardPostView {
  id: string;
  teamId: string;
  teamName: string;
  kind: PostKind;
  text: string;
  authorName: string;
}

export type Situation =
  | { kind: 'owner_message'; text: string; history: ChatTurn[]; teams: Array<{ id: string; name: string }> }
  | { kind: 'board_post'; post: BoardPostView }
  | { kind: 'board_reply'; post: BoardPostView; replierName: string; text: string | null };

export interface BrainInput {
  ownerName: string;
  signals: Signals;
  policy: Policy;
  situation: Situation;
}

export interface BrainOutput {
  say: string | null;
  actions: AgentAction[];
}

export interface Brain {
  decide(input: BrainInput): Promise<BrainOutput>;
}

export type ActivityKind =
  | 'checkin'
  | 'publicacion'
  | 'respuesta'
  | 'pide_permiso'
  | 'permiso_aprobado'
  | 'permiso_rechazado'
  | 'no_comparte'
  | 'sin_respuesta';

export interface Activity {
  id: number;
  teamId: string | null;
  at: string;
  actorName: string;
  toName: string | null;
  kind: ActivityKind;
  text: string;
  postId: string | null;
}

export type ApprovalStatus = 'pendiente' | 'aprobada' | 'rechazada';

export interface Approval {
  id: string;
  question: string;
  action: SharingAction;
  status: ApprovalStatus;
  createdAt: string;
  resolvedAt: string | null;
}
