import { parentPort, workerData, type MessagePort } from 'node:worker_threads';
import { PGlite, types } from '@electric-sql/pglite';
import pg from 'pg';
import type { Request, Response, Row, SqlValue, Target } from './protocol.js';

interface Outcome {
  rows: Row[];
  affected: number;
}

interface Backend {
  schema: string | null;
  query(sql: string, params: SqlValue[]): Promise<Outcome>;
  script(sql: string): Promise<void>;
  close(): Promise<void>;
}

const INT8 = 20;
const NUMERIC = 1700;
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

pg.types.setTypeParser(INT8, Number);
pg.types.setTypeParser(NUMERIC, Number);

const { signal, port } = workerData as { signal: SharedArrayBuffer; port: MessagePort };
const flag = new Int32Array(signal);
const backends = new Map<string, Promise<Backend>>();

function needsEncryption(url: string): boolean {
  const host = new URL(url).hostname;
  return host.includes('.') && !LOCAL_HOSTS.includes(host);
}

function postgresBackend(url: string): Backend {
  let client: pg.Client | null = null;
  const binary = (value: SqlValue) => (value instanceof Uint8Array ? Buffer.from(value) : value);

  const connected = async () => {
    if (client) return client;
    const fresh = new pg.Client({ connectionString: url, keepAlive: true, ssl: needsEncryption(url) ? { rejectUnauthorized: false } : undefined });
    const lost = () => {
      if (client !== fresh) return;
      client = null;
      backend.schema = '';
    };
    fresh.on('error', lost);
    fresh.on('end', lost);
    await fresh.connect();
    client = fresh;
    return fresh;
  };

  const backend: Backend = {
    schema: null,
    async query(sql, params) {
      const result = await (await connected()).query(sql, params.map(binary));
      return { rows: result.rows as Row[], affected: result.rowCount ?? 0 };
    },
    async script(sql) {
      await (await connected()).query(sql);
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
    return { rows: [], affected: 0 };
  }
  return backend.query(request.sql, request.params);
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
      (outcome) => answer({ id: request.id, ...outcome }),
      (failure: unknown) => {
        const error = failure as { message?: string; code?: string };
        answer({ id: request.id, error: error.message ?? String(failure), code: typeof error.code === 'string' ? error.code : null });
      },
    ),
  );
});
