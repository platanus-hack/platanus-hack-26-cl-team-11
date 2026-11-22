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
  changesElsewhere: Int32Array;
  generation: number;
  receive(): Response | undefined;
}

let bridge: Bridge | null = null;
let lastRequest = 0;
let lastSchema = 0;
const originalNames = new Map<string, string>();

let bridgesStarted = 0;

function startBridge(): Bridge {
  const signal = new SharedArrayBuffer(4);
  const changesElsewhere = new SharedArrayBuffer(4);
  const { port1, port2 } = new MessageChannel();
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { workerData: { signal, changesElsewhere, port: port2 }, transferList: [port2] });
  worker.unref();
  port1.unref();
  worker.on('error', () => {
    bridge = null;
  });
  worker.on('exit', () => {
    bridge = null;
  });
  return { worker, flag: new Int32Array(signal), changesElsewhere: new Int32Array(changesElsewhere), generation: (bridgesStarted += 1), receive: () => receiveMessageOnPort(port1)?.message as Response | undefined };
}

export const databaseStats = { queries: 0, ms: 0, changes: 0, lastChange: '' };

function ask(request: Omit<Request, 'id'>): { rows: Row[]; affected: number; changed: boolean } {
  const started = performance.now();
  try {
    return send(request);
  } finally {
    databaseStats.queries += 1;
    databaseStats.ms += performance.now() - started;
  }
}

function send(request: Omit<Request, 'id'>): { rows: Row[]; affected: number; changed: boolean } {
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

const REMEMBERED_FOR_MS = 120_000;
const MOST_REMEMBERED = 4000;
const READS = /^\s*SELECT\b/i;
const DEPENDS_ON_THE_MOMENT = /\b(?:setval|nextval|random|now|clock_timestamp|pg_\w+)\s*\(|\binformation_schema\b|\bcurrent_schema\b|\bFOR\s+UPDATE\b/i;
const ONLY_ENSURES = /^\s*CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s+IF\s+NOT\s+EXISTS\b/i;

interface Remembered {
  rows: Row[];
  at: number;
  world: string;
}

const worldNow = () => (bridge ? `${bridge.generation}:${Atomics.load(bridge.changesElsewhere, 0)}` : '0:0');

const keyable = (params: SqlValue[]) => params.every((value) => value === null || typeof value === 'string' || typeof value === 'number');

export function openDatabase(target: Target): DatabaseSync {
  const schema = target.kind === 'memory' ? `m${process.pid}_${(lastSchema += 1)}_${randomBytes(4).toString('hex')}` : null;
  const remembered = new Map<string, Remembered>();
  const forget = (sql: string) => {
    remembered.clear();
    databaseStats.changes += 1;
    databaseStats.lastChange = sql.slice(0, 60);
  };
  const query = (sql: string, params: SqlValue[], changes: boolean) => {
    const outcome = ask({ target, schema, action: 'query', sql, params, changes });
    if (outcome.changed) forget(sql);
    return { rows: outcome.rows.map(asStored), affected: outcome.affected };
  };
  const read = (sql: string, params: SqlValue[]): Row[] => {
    if (!keyable(params)) return query(sql, params, false).rows;
    const key = `${sql}\u0001${JSON.stringify(params)}`;
    const known = remembered.get(key);
    const now = Date.now();
    if (known && now - known.at < REMEMBERED_FOR_MS && known.world === worldNow()) return known.rows.map((row) => ({ ...row }));
    const rows = query(sql, params, false).rows;
    if (remembered.size >= MOST_REMEMBERED) remembered.clear();
    remembered.set(key, { rows, at: now, world: worldNow() });
    return rows.map((row) => ({ ...row }));
  };
  return {
    prepare(sql) {
      remember(sql);
      const text = toPostgres(sql);
      const insertion = isInsert(text) && !hasReturning(text);
      const reads = READS.test(text);
      const repeatable = reads && !DEPENDS_ON_THE_MOMENT.test(text);
      const rowsOf = (params: SqlValue[]) => (repeatable ? read(text, params) : query(text, params, !reads).rows);
      return {
        run(...params) {
          const outcome = query(insertion ? `${text} RETURNING *` : text, params, true);
          const last = outcome.rows.at(-1);
          const key = last?.id ?? last?.rowid;
          return { changes: insertion ? outcome.rows.length : outcome.affected, lastInsertRowid: typeof key === 'number' ? key : 0 };
        },
        get: (...params) => rowsOf(params)[0],
        all: (...params) => (isTableInfo(sql) ? rowsOf(params).map(asNamedInCode) : rowsOf(params)),
      };
    },
    exec(sql) {
      remember(sql);
      const script = scriptToPostgres(sql);
      const changes = !script.split(';\n').every((statement) => ONLY_ENSURES.test(statement));
      if (ask({ target, schema, action: 'script', sql: script, params: [], changes }).changed) forget(script);
    },
    close() {
      remembered.clear();
      ask({ target, schema, action: 'close', sql: '', params: [], changes: false });
    },
  };
}

export function oncePerDatabase<Store>(open: (db: DatabaseSync) => Store): (db: DatabaseSync) => Store {
  const opened = new WeakMap<DatabaseSync, Store>();
  return (db) => {
    const known = opened.get(db);
    if (known) return known;
    const store = open(db);
    opened.set(db, store);
    return store;
  };
}
