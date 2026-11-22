export type Target = { kind: 'postgres'; url: string } | { kind: 'memory' };

export type SqlValue = string | number | bigint | null | Uint8Array;

export type Row = Record<string, unknown>;

export interface Request {
  id: number;
  target: Target;
  schema: string | null;
  action: 'query' | 'script' | 'close';
  sql: string;
  params: SqlValue[];
  changes: boolean;
}

export type Response = { id: number; rows: Row[]; affected: number; changed: boolean } | { id: number; error: string; code: string | null };

export interface WorkerSetup {
  signal: SharedArrayBuffer;
  changesElsewhere: SharedArrayBuffer;
}
