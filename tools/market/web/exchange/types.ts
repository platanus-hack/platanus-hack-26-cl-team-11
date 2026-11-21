import type { Team } from '../market';

export const publicKinds = {
  binary: 'Sí / No',
  call: 'Call',
  put: 'Put',
  future: 'Futuro amplificado',
  linear: 'Futuro lineal',
  straddle: 'Straddle',
  range: 'Rango',
  race: 'Carrera',
  butterfly: 'Mariposa',
} as const;

export const kinds = { ...publicKinds, manual: 'Pregunta de Mati' } as const;
export type PublicKind = keyof typeof publicKinds;
export type Kind = keyof typeof kinds;
export type Side = 'buy' | 'sell';
export type Spec = {
  kind: PublicKind;
  team: string;
  expiry: number;
  strike?: number;
  width?: number;
  upper?: number;
  rival?: string;
};
export type Observation = {
  id: string;
  team: string;
  at: number;
  price: number;
  coveredThrough: number;
  baseline?: number;
};
type ManualSpec = {
  kind: 'manual';
  question: string;
  rule: string;
  resolver: string;
  expiry: number;
  decisionDeadline: number;
};
export type Market = (Spec | ManualSpec) & {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'pending' | 'settled' | 'voided';
  bestBid: number | null;
  bestAsk: number | null;
  lastPrice: number | null;
  volume: number;
  payout: number | null;
  settledAt: number | null;
  evidence?: {
    source?: string;
    observations?: Observation[];
    reason?: string;
    resolver?: string;
    outcome?: 'yes' | 'no' | 'void';
    at?: number;
    automatic?: boolean;
  } | null;
};
export type Level = { price: number; qty: number };
export type Fill = Level & { id: string; marketId: string; at: number };
export type Wallet = {
  available: number;
  locked: number;
  collateral: number;
  equityAtCost: number;
  markedEquity: number;
  markedPnl: number;
  settlementCredit: number;
  voidCredit: number;
  orders: (Level & { id: string; marketId: string; side: Side; remaining: number })[];
  positions: {
    marketId: string;
    side: 'long' | 'short';
    qty: number;
    collateral: number;
    pledged: number;
    mark: number;
    value: number;
    unrealizedPnl: number;
  }[];
  fills: (Fill & { side: Side })[];
  settlements: { marketId: string; amount: number; payout: number | null; at: number }[];
};
export type View = {
  markets: Market[];
  market: Market | null;
  book: { bids: Level[]; asks: Level[] };
  fills: Fill[];
  wallet: Wallet | null;
};
export type Command =
  | { type: 'join' }
  | { type: 'list'; spec: Spec }
  | { type: 'order'; marketId: string; side: Side; price: number; qty: number }
  | { type: 'cancel'; orderId: string };
export type Run = (command: Command) => void;

export const states = { open: 'Abierto', pending: 'Por liquidar', settled: 'Liquidado', voided: 'Anulado' };
export const n = (value: number) => value.toLocaleString('es-CL');
export const bps = (value: number) => n(Number((value / 100).toFixed(2))) + ' %';
export const when = (value: number) =>
  new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
export const teamName = (team: Team) =>
  team.name === team.team ? 'Equipo ' + team.team.replace('team-', '') : team.name + ' · ' + team.team;
export function getToken(): string {
  const key = 'mesa26.exchange.wallet.v1';
  const saved = localStorage.getItem(key);
  if (saved && /^[0-9a-f]{64}$/.test(saved)) return saved;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(key, token);
  return token;
}

export const teamText = (text: string) => text.replace(/\bteam-(\d+)\b/g, 'Equipo $1');
export function marketTitle(m: Market) {
  return m.kind === 'manual' ? m.question : teamText(m.title);
}
export function subject(m: Market) {
  if (m.kind === 'manual') return m.question;
  const team = teamText(m.team);
  if (m.kind === 'race') return team + ' vs. ' + teamText(m.rival ?? '');
  if (m.kind === 'linear') return team;
  if (m.kind === 'range') return team + ' · ' + bps(m.strike!) + '–' + bps(m.upper!);
  return team + ' · ' + bps(m.strike!);
}
