import { randomBytes } from 'node:crypto';
import { MessageChannel, receiveMessageOnPort, Worker } from 'node:worker_threads';
import { camelCaseNamesIn, hasReturning, isInsert, isTableInfo, scriptToPostgres, toPostgres } from './dialect.js';
import type { Request, Response, Row, SqlValue, Target } from './protocol.js';

export type { SqlValue, Target } from './protocol.js';

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface StatementSync {
  run(...params: SqlValue[]): RunResult;
  get(...params: SqlValue[]): Row | undefined;
  all(...params: SqlValue[]): Row[];
}

export interface DatabaseSync {
  prepare(sql: string): StatementSync;
  exec(sql: string): void;
  close(): void;
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 30_000;
const NO_ANSWER = 'La base de datos no respondió a tiempo.';

interface Bridge {
  worker: Worker;
  flag: Int32Array;
  receive(): Response | undefined;
}

let bridge: Bridge | null = null;
let lastRequest = 0;
let lastSchema = 0;
const originalNames = new Map<string, string>();

function startBridge(): Bridge {
  const signal = new SharedArrayBuffer(4);
  const { port1, port2 } = new MessageChannel();
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { workerData: { signal, port: port2 }, transferList: [port2] });
  worker.unref();
  port1.unref();
  worker.on('error', () => {
    bridge = null;
  });
  worker.on('exit', () => {
    bridge = null;
  });
  return { worker, flag: new Int32Array(signal), receive: () => receiveMessageOnPort(port1)?.message as Response | undefined };
}

export const databaseStats = { queries: 0, ms: 0 };

function ask(request: Omit<Request, 'id'>): { rows: Row[]; affected: number } {
  const started = performance.now();
  try {
    return send(request);
  } finally {
    databaseStats.queries += 1;
    databaseStats.ms += performance.now() - started;
  }
}

function send(request: Omit<Request, 'id'>): { rows: Row[]; affected: number } {
  const active = (bridge ??= startBridge());
  const id = (lastRequest += 1);
  const deadline = Date.now() + TIMEOUT_MS;
  Atomics.store(active.flag, 0, 0);
  active.worker.postMessage({ ...request, id } satisfies Request);
  for (;;) {
    const response = active.receive();
    if (response?.id === id) {
      if ('error' in response) throw new DatabaseError(response.error, response.code);
      return response;
    }
    if (response) continue;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new DatabaseError(NO_ANSWER, null);
    Atomics.wait(active.flag, 0, 0, Math.min(remaining, 50));
    Atomics.store(active.flag, 0, 0);
  }
}

function remember(sql: string) {
  for (const name of camelCaseNamesIn(sql)) originalNames.set(name.toLowerCase(), name);
}

function asStored(row: Row): Row {
  const restored: Row = {};
  for (const [name, value] of Object.entries(row)) restored[originalNames.get(name) ?? name] = typeof value === 'boolean' ? Number(value) : value;
  return restored;
}

const asNamedInCode = (column: Row): Row => ({ ...column, name: typeof column.name === 'string' ? (originalNames.get(column.name) ?? column.name) : column.name });

export function openDatabase(target: Target): DatabaseSync {
  const schema = target.kind === 'memory' ? `m${process.pid}_${(lastSchema += 1)}_${randomBytes(4).toString('hex')}` : null;
  const query = (sql: string, params: SqlValue[]) => {
    const outcome = ask({ target, schema, action: 'query', sql, params });
    return { rows: outcome.rows.map(asStored), affected: outcome.affected };
  };
  return {
    prepare(sql) {
      remember(sql);
      const text = toPostgres(sql);
      const insertion = isInsert(text) && !hasReturning(text);
      return {
        run(...params) {
          const outcome = query(insertion ? `${text} RETURNING *` : text, params);
          const last = outcome.rows.at(-1);
          const key = last?.id ?? last?.rowid;
          return { changes: insertion ? outcome.rows.length : outcome.affected, lastInsertRowid: typeof key === 'number' ? key : 0 };
        },
        get: (...params) => query(text, params).rows[0],
        all: (...params) => (isTableInfo(sql) ? query(text, params).rows.map(asNamedInCode) : query(text, params).rows),
      };
    },
    exec(sql) {
      remember(sql);
      ask({ target, schema, action: 'script', sql: scriptToPostgres(sql), params: [] });
    },
    close() {
      ask({ target, schema, action: 'close', sql: '', params: [] });
    },
  };
}
