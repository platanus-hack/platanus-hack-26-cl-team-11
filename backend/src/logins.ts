import type { DatabaseSync } from 'node:sqlite';

export type LinkOutcome = 'asociada' | 'ya_era_tuya' | 'de_otra_persona';

export interface LoginStore {
  personOf(email: string): string | undefined;
  emailOf(personToken: string): string | undefined;
  link(email: string, personToken: string): LinkOutcome;
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

  const personOf = (email: string) => (db.prepare('SELECT person_token FROM logins WHERE email = ?').get(keyOf(email)) as { person_token: string } | undefined)?.person_token;

  return {
    personOf,

    emailOf(personToken) {
      const row = db.prepare('SELECT email FROM logins WHERE person_token = ? ORDER BY linked_at LIMIT 1').get(personToken) as { email: string } | undefined;
      return row?.email;
    },

    link(email, personToken) {
      const owner = personOf(email);
      if (owner) return owner === personToken ? 'ya_era_tuya' : 'de_otra_persona';
      db.prepare('INSERT INTO logins (email, person_token, linked_at) VALUES (?, ?, ?)').run(keyOf(email), personToken, new Date().toISOString());
      return 'asociada';
    },
  };
}
