import { DatabaseSync as SqliteDatabase } from 'node:sqlite';
import type { DatabaseSync } from './database.js';

export function openSqlite(file: string): DatabaseSync {
  const db = new SqliteDatabase(file);
  return {
    prepare(sql) {
      const statement = db.prepare(sql);
      return {
        run(...params) {
          const result = statement.run(...params);
          return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
        },
        get: (...params) => statement.get(...params) as Record<string, unknown> | undefined,
        all: (...params) => statement.all(...params) as Array<Record<string, unknown>>,
      };
    },
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
  };
}
