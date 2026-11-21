import type { DatabaseSync } from './pg/database.js';

export type LinkOutcome = 'asociada' | 'ya_era_tuya' | 'de_otra_persona';

export interface Login {
  email: string;
  name: string | null;
}

export interface LoginStore {
  personOf(email: string): string | undefined;
  loginOf(personToken: string): Login | undefined;
  link(email: string, personToken: string, name?: string | null): LinkOutcome;
  assign(email: string, personToken: string, name: string | null): void;
}

const keyOf = (email: string) => email.trim().toLowerCase();

export function openLoginStore(db: DatabaseSync): LoginStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS logins (
      email TEXT PRIMARY KEY,
      person_token TEXT NOT NULL REFERENCES people (token),
      linked_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS logins_by_person ON logins (person_token);
  `);
  const columns = db.prepare('PRAGMA table_info(logins)').all() as unknown as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'name')) db.exec('ALTER TABLE logins ADD COLUMN name TEXT');

  const now = () => new Date().toISOString();
  const personOf = (email: string) => (db.prepare('SELECT person_token FROM logins WHERE email = ?').get(keyOf(email)) as { person_token: string } | undefined)?.person_token;

  return {
    personOf,

    loginOf(personToken) {
      const row = db.prepare('SELECT email, name FROM logins WHERE person_token = ? ORDER BY linked_at LIMIT 1').get(personToken) as { email: string; name: string | null } | undefined;
      return row ? { email: row.email, name: row.name } : undefined;
    },

    link(email, personToken, name = null) {
      const owner = personOf(email);
      if (owner) return owner === personToken ? 'ya_era_tuya' : 'de_otra_persona';
      db.prepare('INSERT INTO logins (email, person_token, linked_at, name) VALUES (?, ?, ?, ?)').run(keyOf(email), personToken, now(), name);
      return 'asociada';
    },

    assign(email, personToken, name) {
      db.prepare(
        `INSERT INTO logins (email, person_token, linked_at, name) VALUES (?, ?, ?, ?)
         ON CONFLICT (email) DO UPDATE SET person_token = excluded.person_token, linked_at = excluded.linked_at, name = COALESCE(excluded.name, logins.name)`,
      ).run(keyOf(email), personToken, now(), name);
    },
  };
}
