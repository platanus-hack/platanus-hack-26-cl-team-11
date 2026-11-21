import type { DatabaseSync } from 'node:sqlite';

export const MAX_PROFILE_TEXT_LENGTH = 120;

export interface Profile {
  goal: string | null;
  guide: string | null;
}

export interface ProfileStore {
  get(personToken: string): Profile;
  set(personToken: string, changes: Partial<Profile>): Profile;
}

export function openProfileStore(db: DatabaseSync): ProfileStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS person_profiles (
      person_token TEXT PRIMARY KEY REFERENCES people (token),
      goal TEXT,
      guide TEXT
    );
  `);

  const get = (personToken: string): Profile => {
    const row = db.prepare('SELECT goal, guide FROM person_profiles WHERE person_token = ?').get(personToken) as unknown as Profile | undefined;
    return { goal: row?.goal ?? null, guide: row?.guide ?? null };
  };

  return {
    get,
    set(personToken, changes) {
      const next = { ...get(personToken), ...changes };
      db.prepare('INSERT INTO person_profiles (person_token, goal, guide) VALUES (?, ?, ?) ON CONFLICT (person_token) DO UPDATE SET goal = excluded.goal, guide = excluded.guide').run(
        personToken,
        next.goal,
        next.guide,
      );
      return next;
    },
  };
}
