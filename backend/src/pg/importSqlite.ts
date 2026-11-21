import { existsSync, readFileSync, statSync } from 'node:fs';
import { DatabaseSync as SqliteDatabase } from 'node:sqlite';
import type { DatabaseSync, SqlValue } from './database.js';

const MAX_BATCH_ROWS = 200;
const MAX_BATCH_VALUES = 20_000;
const MAX_BACKUP_BYTES = 200 * 1024 * 1024;
const MISSING_PARENT = '23503';
const MAX_PROBLEMS_KEPT = 5;

export interface TableReport {
  table: string;
  found: number;
  copied: number;
  problems: string[];
}

export interface ImportReport {
  file: string;
  tables: TableReport[];
  backupBytes: number | null;
}

type SourceRow = Record<string, SqlValue>;

interface Plan {
  table: string;
  columns: string[];
  types: Map<string, string>;
  rows: SourceRow[];
}

const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;

const codeOf = (failure: unknown) => (failure as { code?: unknown }).code;

const messageOf = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure));

function fitted(value: SqlValue, type: string | undefined): SqlValue {
  if (typeof value === 'string') return value.includes('\u0000') ? value.replaceAll('\u0000', '') : value;
  if (typeof value === 'number' && type === 'text') return String(value);
  if (typeof value === 'bigint') return type === 'text' ? value.toString() : Number(value);
  return value;
}

function planFor(source: SqliteDatabase, db: DatabaseSync, table: string): Plan | string {
  const targetColumns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (targetColumns.length === 0) return 'La tabla no existe en Postgres.';
  const types = new Map(
    (db.prepare('SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?').all(table.toLowerCase()) as Array<{ name: string; type: string }>).map(
      (column) => [column.name.toLowerCase(), column.type],
    ),
  );
  const targetNames = new Set(targetColumns.map((column) => column.name.toLowerCase()));
  const sourceColumns = (source.prepare(`PRAGMA table_info(${quoted(table)})`).all() as Array<{ name: string }>).map((column) => column.name);
  const shared = sourceColumns.filter((name) => targetNames.has(name.toLowerCase()));
  const keepsOrder = targetNames.has('rowid') && !sourceColumns.some((name) => name.toLowerCase() === 'rowid');
  const selected = [...(keepsOrder ? ['rowid AS rowid'] : []), ...shared.map(quoted)].join(', ');
  const rows = source.prepare(`SELECT ${selected} FROM ${quoted(table)}${keepsOrder ? ' ORDER BY rowid' : ''}`).all() as SourceRow[];
  return { table, columns: [...(keepsOrder ? ['rowid'] : []), ...shared], types, rows };
}

function insert(db: DatabaseSync, plan: Plan, rows: SourceRow[]): number {
  const row = `(${plan.columns.map(() => '?').join(', ')})`;
  const values = rows.flatMap((source) => plan.columns.map((column) => fitted(source[column] ?? null, plan.types.get(column.toLowerCase()))));
  const sql = `INSERT INTO ${quoted(plan.table.toLowerCase())} (${plan.columns.map((column) => quoted(column.toLowerCase())).join(', ')}) VALUES ${rows.map(() => row).join(', ')} ON CONFLICT DO NOTHING RETURNING 1 AS copied`;
  return db.prepare(sql).all(...values).length;
}

function guarded<T>(db: DatabaseSync, work: () => T): T {
  db.exec('SAVEPOINT copia');
  try {
    const result = work();
    db.exec('RELEASE SAVEPOINT copia');
    return result;
  } catch (failure) {
    db.exec('ROLLBACK TO SAVEPOINT copia');
    throw failure;
  }
}

function copyWhole(db: DatabaseSync, plan: Plan): number {
  if (plan.columns.length === 0) return 0;
  const size = Math.max(1, Math.min(MAX_BATCH_ROWS, Math.floor(MAX_BATCH_VALUES / plan.columns.length)));
  let copied = 0;
  for (let start = 0; start < plan.rows.length; start += size) copied += insert(db, plan, plan.rows.slice(start, start + size));
  return copied;
}

function copyRowByRow(db: DatabaseSync, plan: Plan): TableReport {
  const report: TableReport = { table: plan.table, found: plan.rows.length, copied: 0, problems: [] };
  let failed = 0;
  for (const row of plan.rows) {
    try {
      report.copied += guarded(db, () => insert(db, plan, [row]));
    } catch (failure) {
      failed += 1;
      if (report.problems.length < MAX_PROBLEMS_KEPT) report.problems.push(messageOf(failure));
    }
  }
  if (failed > 0) report.problems.unshift(`${failed} filas no se pudieron copiar.`);
  return report;
}

function copyAll(db: DatabaseSync, plans: Plan[]): TableReport[] {
  const reports: TableReport[] = [];
  let pending = plans;
  for (;;) {
    const waiting: Plan[] = [];
    for (const plan of pending) {
      try {
        reports.push({ table: plan.table, found: plan.rows.length, copied: guarded(db, () => copyWhole(db, plan)), problems: [] });
      } catch (failure) {
        if (codeOf(failure) === MISSING_PARENT) waiting.push(plan);
        else reports.push(copyRowByRow(db, plan));
      }
    }
    if (waiting.length === 0) return reports;
    if (waiting.length === pending.length) return [...reports, ...waiting.map((plan) => copyRowByRow(db, plan))];
    pending = waiting;
  }
}

function continueSequences(db: DatabaseSync) {
  const identities = db.prepare("SELECT table_name AS tablename, column_name AS columnname FROM information_schema.columns WHERE table_schema = current_schema() AND is_identity = 'YES'").all() as Array<{
    tablename: string;
    columnname: string;
  }>;
  for (const { tablename, columnname } of identities) {
    db.prepare(`SELECT setval(pg_get_serial_sequence('${quoted(tablename)}', '${columnname}'), (SELECT COALESCE(MAX(${quoted(columnname)}), 0) FROM ${quoted(tablename)}) + 1, false)`).get();
  }
}

function keepBackup(db: DatabaseSync, file: string, takenAt: string): number | null {
  const size = statSync(file).size;
  if (size > MAX_BACKUP_BYTES) return null;
  db.exec('CREATE TABLE IF NOT EXISTS sqlite_backups (file TEXT PRIMARY KEY, taken_at TEXT NOT NULL, bytes BLOB NOT NULL)');
  db.prepare('INSERT INTO sqlite_backups (file, taken_at, bytes) VALUES (?, ?, ?) ON CONFLICT (file) DO NOTHING RETURNING file').all(file, takenAt, new Uint8Array(readFileSync(file)));
  return size;
}

export function importFromSqlite(db: DatabaseSync, file: string, now: Date = new Date()): ImportReport | null {
  if (!existsSync(file)) return null;
  db.exec('CREATE TABLE IF NOT EXISTS sqlite_imports (file TEXT PRIMARY KEY, imported_at TEXT NOT NULL, report TEXT NOT NULL)');
  if (db.prepare('SELECT file FROM sqlite_imports LIMIT 1').get()) return null;

  const source = new SqliteDatabase(file, { readOnly: true });
  try {
    const tables = (source.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string }>).map((table) => table.name);
    const missing: TableReport[] = [];
    const plans: Plan[] = [];
    for (const table of tables) {
      const plan = planFor(source, db, table);
      if (typeof plan === 'string') missing.push({ table, found: 0, copied: 0, problems: [plan] });
      else plans.push(plan);
    }

    db.exec('BEGIN');
    try {
      const report: ImportReport = { file, tables: [...copyAll(db, plans), ...missing].sort((a, b) => a.table.localeCompare(b.table)), backupBytes: null };
      continueSequences(db);
      report.backupBytes = keepBackup(db, file, now.toISOString());
      db.prepare('INSERT INTO sqlite_imports (file, imported_at, report) VALUES (?, ?, ?) RETURNING file').all(file, now.toISOString(), JSON.stringify(report));
      db.exec('COMMIT');
      return report;
    } catch (failure) {
      db.exec('ROLLBACK');
      throw failure;
    }
  } finally {
    source.close();
  }
}

export function describeImport(report: ImportReport): string[] {
  const found = report.tables.reduce((sum, table) => sum + table.found, 0);
  const copied = report.tables.reduce((sum, table) => sum + table.copied, 0);
  const troubled = report.tables.filter((table) => table.problems.length > 0 || table.copied !== table.found);
  return [
    `Importación desde SQLite: ${copied} de ${found} filas en ${report.tables.length} tablas. Respaldo: ${report.backupBytes === null ? 'no guardado' : `${report.backupBytes} bytes`}.`,
    ...troubled.map((table) => `Importación, tabla ${table.table}: ${table.copied} de ${table.found}. ${table.problems.join(' ')}`),
  ];
}
