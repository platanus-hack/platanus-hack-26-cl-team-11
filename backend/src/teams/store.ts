import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export interface Team {
  id: string;
  name: string;
  joinCode: string;
}

export interface TeamMember {
  token: string;
  name: string;
}

export interface TeamStore {
  createTeam(name: string): Team;
  findTeam(id: string): Team | undefined;
  findTeamByJoinCode(joinCode: string): Team | undefined;
  addMember(teamId: string, personToken: string): void;
  removeMember(teamId: string, personToken: string): void;
  membersOf(teamId: string): TeamMember[];
  teamsOf(personToken: string): Team[];
  isMember(teamId: string, personToken: string): boolean;
}

interface TeamRow {
  id: string;
  name: string;
  join_code: string;
}

const toTeam = (row: TeamRow): Team => ({ id: row.id, name: row.name, joinCode: row.join_code });

export function openTeamStore(db: DatabaseSync): TeamStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      join_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS team_members (
      team_id TEXT NOT NULL REFERENCES teams (id),
      person_token TEXT NOT NULL REFERENCES people (token),
      joined_at TEXT NOT NULL,
      PRIMARY KEY (team_id, person_token)
    );
  `);

  const now = () => new Date().toISOString();

  return {
    createTeam(name) {
      const team: Team = { id: `team_${randomBytes(8).toString('hex')}`, name, joinCode: randomBytes(12).toString('base64url') };
      db.prepare('INSERT INTO teams (id, name, join_code, created_at) VALUES (?, ?, ?, ?)').run(team.id, team.name, team.joinCode, now());
      return team;
    },

    findTeam(id) {
      const row = db.prepare('SELECT id, name, join_code FROM teams WHERE id = ?').get(id) as TeamRow | undefined;
      return row ? toTeam(row) : undefined;
    },

    findTeamByJoinCode(joinCode) {
      const row = db.prepare('SELECT id, name, join_code FROM teams WHERE join_code = ?').get(joinCode) as TeamRow | undefined;
      return row ? toTeam(row) : undefined;
    },

    addMember(teamId, personToken) {
      db.prepare('INSERT OR IGNORE INTO team_members (team_id, person_token, joined_at) VALUES (?, ?, ?)').run(teamId, personToken, now());
    },

    removeMember(teamId, personToken) {
      db.prepare('DELETE FROM team_members WHERE team_id = ? AND person_token = ?').run(teamId, personToken);
    },

    membersOf(teamId) {
      const rows = db
        .prepare('SELECT p.token AS token, p.name AS name FROM team_members m JOIN people p ON p.token = m.person_token WHERE m.team_id = ? ORDER BY m.joined_at, p.name')
        .all(teamId) as unknown as TeamMember[];
      return rows.map((row) => ({ token: row.token, name: row.name }));
    },

    teamsOf(personToken) {
      const rows = db
        .prepare('SELECT t.id AS id, t.name AS name, t.join_code AS join_code FROM team_members m JOIN teams t ON t.id = m.team_id WHERE m.person_token = ? ORDER BY m.joined_at')
        .all(personToken) as unknown as TeamRow[];
      return rows.map(toTeam);
    },

    isMember(teamId, personToken) {
      return db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND person_token = ?').get(teamId, personToken) !== undefined;
    },
  };
}
