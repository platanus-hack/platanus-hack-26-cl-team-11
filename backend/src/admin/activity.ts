import { oncePerDatabase, type DatabaseSync } from '../pg/database.js';

export const activityOf = oncePerDatabase((db: DatabaseSync) => {
  db.exec(`CREATE TABLE IF NOT EXISTS montu_context_activity (
    person_token TEXT NOT NULL REFERENCES people (token), day TEXT NOT NULL,
    reads INTEGER NOT NULL DEFAULT 0, publications INTEGER NOT NULL DEFAULT 0,
    last_at TEXT NOT NULL, PRIMARY KEY (person_token, day)
  );`);
  return (owner: string, action: 'read' | 'publish') => {
    const at = new Date().toISOString();
    db.prepare(`INSERT INTO montu_context_activity (person_token, day, reads, publications, last_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (person_token, day) DO UPDATE SET reads = montu_context_activity.reads + excluded.reads,
      publications = montu_context_activity.publications + excluded.publications, last_at = excluded.last_at`)
      .run(owner, at.slice(0, 10), Number(action === 'read'), Number(action === 'publish'), at);
  };
});
