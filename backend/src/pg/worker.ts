import { parentPort, workerData, type MessagePort } from 'node:worker_threads';
import { PGlite, types } from '@electric-sql/pglite';
import pg from 'pg';
import type { Request, Response, Row, SqlValue, Target } from './protocol.js';

interface Outcome {
  rows: Row[];
  affected: number;
  changed?: boolean;
}

const ROW_CHANGES = /^\s*(?:INSERT|UPDATE|DELETE)\b/i;
const KEEPS_DATA = /^\s*(?:BEGIN|COMMIT|SAVEPOINT|RELEASE)\b[^;]*;?\s*$/i;

interface Backend {
  schema: string | null;
  announce?(): void;
  query(sql: string, params: SqlValue[]): Promise<Outcome>;
  script(sql: string): Promise<void>;
  close(): Promise<void>;
}

const INT8 = 20;
const NUMERIC = 1700;
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];
const CONNECT_TIMEOUT_MS = 10_000;
const QUERY_TIMEOUT_MS = 25_000;
const SQL_STATE = /^[0-9A-Z]{5}$/;
const CONNECTION_LOST_CLASSES = ['08', '57'];
const TRANSACTION_START = /^\s*BEGIN\b/i;
const TRANSACTION_END = /^\s*(COMMIT|ROLLBACK)\s*;?\s*$/i;

pg.types.setTypeParser(INT8, Number);
pg.types.setTypeParser(NUMERIC, Number);

const { signal, changesElsewhere, port } = workerData as { signal: SharedArrayBuffer; changesElsewhere: SharedArrayBuffer; port: MessagePort };
const flag = new Int32Array(signal);
const elsewhere = new Int32Array(changesElsewhere);
const CHANGES_CHANNEL = 'montu_cambios';
const backends = new Map<string, Promise<Backend>>();

function needsEncryption(url: string): boolean {
  const host = new URL(url).hostname;
  return host.includes('.') && !LOCAL_HOSTS.includes(host);
}

function postgresBackend(url: string): Backend {
  let client: pg.Client | null = null;
  let inTransaction = false;
  const binary = (value: SqlValue) => (value instanceof Uint8Array ? Buffer.from(value) : value);

  const connected = async () => {
    if (client) return client;
    const fresh = new pg.Client({
      connectionString: url,
      keepAlive: true,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      query_timeout: QUERY_TIMEOUT_MS,
      ssl: needsEncryption(url) ? { rejectUnauthorized: false } : undefined,
    });
    const lost = () => {
      if (client !== fresh) return;
      client = null;
      backend.schema = '';
    };
    fresh.on('error', lost);
    fresh.on('end', lost);
    await fresh.connect();
    const own = (fresh as unknown as { processID: number }).processID;
    fresh.on('notification', (message) => {
      if (message.processId !== own) Atomics.add(elsewhere, 0, 1);
    });
    await fresh.query(`LISTEN ${CHANGES_CHANNEL}`);
    Atomics.add(elsewhere, 0, 1);
    client = fresh;
    return fresh;
  };

  const discardUnlessServerRefused = (failure: unknown) => {
    const code = (failure as { code?: unknown }).code;
    const refusedByServer = typeof code === 'string' && SQL_STATE.test(code) && !CONNECTION_LOST_CLASSES.includes(code.slice(0, 2));
    if (refusedByServer) return false;
    const broken = client;
    client = null;
    backend.schema = '';
    broken?.end().catch(() => undefined);
    return true;
  };

  const send = async (sql: string, params?: SqlValue[]) => {
    const open = await connected();
    return params ? open.query(sql, params.map(binary)) : open.query(sql);
  };

  const run = async (sql: string, params?: SqlValue[]) => {
    try {
      const result = await send(sql, params);
      if (!params) inTransaction = TRANSACTION_START.test(sql) ? true : TRANSACTION_END.test(sql) ? false : inTransaction;
      return result;
    } catch (failure) {
      const connectionLost = discardUnlessServerRefused(failure);
      const wasInTransaction = inTransaction;
      if (connectionLost) inTransaction = false;
      if (!connectionLost || wasInTransaction) throw failure;
      return send(sql, params);
    }
  };

  const backend: Backend = {
    schema: null,
    async query(sql, params) {
      const result = await run(sql, params);
      return { rows: result.rows as Row[], affected: result.rowCount ?? 0 };
    },
    async script(sql) {
      await run(sql);
    },
    announce() {
      client?.query(`NOTIFY ${CHANGES_CHANNEL}`).catch(() => undefined);
    },
    async close() {
      const open = client;
      client = null;
      await open?.end();
    },
  };
  return backend;
}

async function embeddedBackend(): Promise<Backend> {
  const db = await PGlite.create(undefined, { parsers: { [types.INT8]: (value: string) => Number(value), [types.NUMERIC]: (value: string) => Number(value) } });
  return {
    schema: null,
    async query(sql, params) {
      const result = await db.query<Row>(sql, params);
      return { rows: result.rows, affected: result.affectedRows ?? 0 };
    },
    async script(sql) {
      await db.exec(sql);
    },
    close: () => db.close(),
  };
}

const keyOf = (target: Target) => (target.kind === 'postgres' ? `postgres:${target.url}` : 'memory');

function backendFor(target: Target): Promise<Backend> {
  const key = keyOf(target);
  const known = backends.get(key);
  if (known) return known;
  const testServer = process.env.TEST_DATABASE_URL?.trim();
  const opened = target.kind === 'postgres' ? Promise.resolve(postgresBackend(target.url)) : testServer ? Promise.resolve(postgresBackend(testServer)) : embeddedBackend();
  backends.set(key, opened);
  opened.catch(() => backends.delete(key));
  return opened;
}

const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;

async function within(backend: Backend, schema: string | null) {
  if (backend.schema === schema) return;
  if (schema) await backend.script(`CREATE SCHEMA IF NOT EXISTS ${quoted(schema)}; SET search_path TO ${quoted(schema)}`);
  else await backend.script('SET search_path TO public');
  backend.schema = schema;
}

async function handle(request: Request): Promise<Outcome> {
  const backend = await backendFor(request.target);
  if (request.action === 'close') {
    if (request.schema) {
      await backend.script(`DROP SCHEMA IF EXISTS ${quoted(request.schema)} CASCADE`);
      if (backend.schema === request.schema) backend.schema = '';
    } else {
      backends.delete(keyOf(request.target));
      await backend.close();
    }
    return { rows: [], affected: 0 };
  }
  await within(backend, request.schema);
  if (request.action === 'script') {
    await backend.script(request.sql);
    const altered = request.changes && !KEEPS_DATA.test(request.sql);
    if (altered) backend.announce?.();
    return { rows: [], affected: 0, changed: altered };
  }
  const outcome = await backend.query(request.sql, request.params);
  const changed = request.changes && (!ROW_CHANGES.test(request.sql) || outcome.affected > 0 || outcome.rows.length > 0);
  if (changed) backend.announce?.();
  return { ...outcome, changed };
}

function answer(response: Response) {
  port.postMessage(response);
  Atomics.store(flag, 0, 1);
  Atomics.notify(flag, 0);
}

let queue: Promise<void> = Promise.resolve();

parentPort?.on('message', (request: Request) => {
  queue = queue.then(() =>
    handle(request).then(
      (outcome) => answer({ id: request.id, rows: outcome.rows, affected: outcome.affected, changed: outcome.changed ?? false }),
      (failure: unknown) => {
        const error = failure as { message?: string; code?: string };
        answer({ id: request.id, error: error.message ?? String(failure), code: typeof error.code === 'string' ? error.code : null });
      },
    ),
  );
});
