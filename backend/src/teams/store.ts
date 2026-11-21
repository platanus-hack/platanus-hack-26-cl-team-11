import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from '../pg/database.js';

export interface Team {
  id: string;
  name: string;
  joinCode: string;
}

export interface TeamMember {
  token: string;
  name: string;
}

export type JoinStatus = 'pendiente' | 'miembro';

export interface TeamInvite {
  code: string;
  teamId: string;
  expiresAt: string;
}

export const INVITE_DAYS = 7;
const INVITE_CODE_BYTES = 12;
const DAY_MS = 86_400_000;

export interface JoinRequest {
  id: string;
  teamId: string;
  token: string;
  name: string;
  approvedBy: string[];
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
  requestJoin(teamId: string, personToken: string): JoinStatus;
  approveJoin(requestId: string, approverToken: string): JoinStatus;
  findJoinRequest(requestId: string): JoinRequest | undefined;
  joinRequestsOf(teamId: string): JoinRequest[];
  pendingTeamsOf(personToken: string): Team[];
  adminsOf(teamId: string): string[];
  isAdmin(teamId: string, personToken: string): boolean;
  makeAdmin(teamId: string, personToken: string): void;
  createInvite(teamId: string, createdBy: string, now: Date): TeamInvite;
  findInvite(code: string, now: Date): TeamInvite | undefined;
  invitesOf(teamId: string, now: Date): TeamInvite[];
  revokeInvite(teamId: string, code: string): void;
}

interface InviteRow {
  code: string;
  team_id: string;
  expires_at: string;
}

interface TeamRow {
  id: string;
  name: string;
  join_code: string;
}

interface JoinRequestRow {
  id: string;
  team_id: string;
  token: string;
  name: string;
}

const REQUEST_COLUMNS = 'r.id AS id, r.team_id AS team_id, r.person_token AS token, p.name AS name';

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
    CREATE TABLE IF NOT EXISTS team_join_requests (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams (id),
      person_token TEXT NOT NULL REFERENCES people (token),
      requested_at TEXT NOT NULL,
      UNIQUE (team_id, person_token)
    );
    CREATE TABLE IF NOT EXISTS team_admins (
      team_id TEXT NOT NULL REFERENCES teams (id),
      person_token TEXT NOT NULL REFERENCES people (token),
      PRIMARY KEY (team_id, person_token)
    );
    CREATE TABLE IF NOT EXISTS team_invites (
      code TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams (id),
      created_by TEXT NOT NULL REFERENCES people (token),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS team_join_approvals (
      request_id TEXT NOT NULL REFERENCES team_join_requests (id),
      approver_token TEXT NOT NULL REFERENCES people (token),
      PRIMARY KEY (request_id, approver_token)
    );
  `);

  const now = () => new Date().toISOString();

  const toJoinRequest = (row: JoinRequestRow): JoinRequest => {
    const approvals = db.prepare('SELECT approver_token FROM team_join_approvals WHERE request_id = ?').all(row.id) as unknown as Array<{ approver_token: string }>;
    return { id: row.id, teamId: row.team_id, token: row.token, name: row.name, approvedBy: approvals.map((approval) => approval.approver_token) };
  };

  const addMember = (teamId: string, personToken: string) => {
    db.prepare('INSERT OR IGNORE INTO team_members (team_id, person_token, joined_at) VALUES (?, ?, ?)').run(teamId, personToken, now());
  };

  const isMember = (teamId: string, personToken: string) =>
    db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND person_token = ?').get(teamId, personToken) !== undefined;

  const memberTokensOf = (teamId: string) =>
    (db.prepare('SELECT person_token FROM team_members WHERE team_id = ?').all(teamId) as unknown as Array<{ person_token: string }>).map((row) => row.person_token);

  const adminsOf = (teamId: string): string[] => {
    const named = db
      .prepare('SELECT a.person_token AS token FROM team_admins a JOIN team_members m ON m.team_id = a.team_id AND m.person_token = a.person_token WHERE a.team_id = ?')
      .all(teamId) as unknown as Array<{ token: string }>;
    if (named.length > 0) return named.map((row) => row.token);
    const first = db.prepare('SELECT person_token AS token FROM team_members WHERE team_id = ? ORDER BY joined_at, rowid LIMIT 1').get(teamId) as { token: string } | undefined;
    return first ? [first.token] : [];
  };

  const toInvite = (row: InviteRow): TeamInvite => ({ code: row.code, teamId: row.team_id, expiresAt: row.expires_at });

  const findJoinRequest = (requestId: string): JoinRequest | undefined => {
    const row = db
      .prepare(`SELECT ${REQUEST_COLUMNS} FROM team_join_requests r JOIN people p ON p.token = r.person_token WHERE r.id = ?`)
      .get(requestId) as JoinRequestRow | undefined;
    return row ? toJoinRequest(row) : undefined;
  };

  const dropJoinRequest = (requestId: string) => {
    db.prepare('DELETE FROM team_join_approvals WHERE request_id = ?').run(requestId);
    db.prepare('DELETE FROM team_join_requests WHERE id = ?').run(requestId);
  };

  const settleJoinRequest = (requestId: string): JoinStatus => {
    const request = findJoinRequest(requestId);
    if (!request) return 'pendiente';
    if (!memberTokensOf(request.teamId).every((memberToken) => request.approvedBy.includes(memberToken))) return 'pendiente';
    dropJoinRequest(request.id);
    addMember(request.teamId, request.token);
    return 'miembro';
  };

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

    addMember,

    removeMember(teamId, personToken) {
      const keptAdmins = adminsOf(teamId).filter((admin) => admin !== personToken);
      db.prepare('DELETE FROM team_members WHERE team_id = ? AND person_token = ?').run(teamId, personToken);
      db.prepare('DELETE FROM team_admins WHERE team_id = ? AND person_token = ?').run(teamId, personToken);
      for (const admin of keptAdmins) db.prepare('INSERT OR IGNORE INTO team_admins (team_id, person_token) VALUES (?, ?)').run(teamId, admin);
      const request = db.prepare('SELECT id FROM team_join_requests WHERE team_id = ? AND person_token = ?').get(teamId, personToken) as { id: string } | undefined;
      if (request) dropJoinRequest(request.id);
    },

    membersOf(teamId) {
      const rows = db
        .prepare('SELECT p.token AS token, p.name AS name FROM team_members m JOIN people p ON p.token = m.person_token WHERE m.team_id = ? ORDER BY m.joined_at, m.rowid')
        .all(teamId) as unknown as TeamMember[];
      return rows.map((row) => ({ token: row.token, name: row.name }));
    },

    teamsOf(personToken) {
      const rows = db
        .prepare('SELECT t.id AS id, t.name AS name, t.join_code AS join_code FROM team_members m JOIN teams t ON t.id = m.team_id WHERE m.person_token = ? ORDER BY m.joined_at')
        .all(personToken) as unknown as TeamRow[];
      return rows.map(toTeam);
    },

    isMember,

    requestJoin(teamId, personToken) {
      if (isMember(teamId, personToken)) return 'miembro';
      db.prepare('INSERT OR IGNORE INTO team_join_requests (id, team_id, person_token, requested_at) VALUES (?, ?, ?, ?)').run(
        `sol_${randomBytes(8).toString('hex')}`,
        teamId,
        personToken,
        now(),
      );
      const request = db.prepare('SELECT id FROM team_join_requests WHERE team_id = ? AND person_token = ?').get(teamId, personToken) as { id: string } | undefined;
      return request ? settleJoinRequest(request.id) : 'pendiente';
    },

    approveJoin(requestId, approverToken) {
      db.prepare('INSERT OR IGNORE INTO team_join_approvals (request_id, approver_token) VALUES (?, ?)').run(requestId, approverToken);
      return settleJoinRequest(requestId);
    },

    findJoinRequest,

    joinRequestsOf(teamId) {
      const rows = db
        .prepare(`SELECT ${REQUEST_COLUMNS} FROM team_join_requests r JOIN people p ON p.token = r.person_token WHERE r.team_id = ? ORDER BY r.requested_at, p.name`)
        .all(teamId) as unknown as JoinRequestRow[];
      return rows.map(toJoinRequest);
    },

    adminsOf,

    isAdmin: (teamId, personToken) => adminsOf(teamId).includes(personToken),

    makeAdmin(teamId, personToken) {
      if (!isMember(teamId, personToken)) return;
      for (const admin of [...adminsOf(teamId), personToken]) db.prepare('INSERT OR IGNORE INTO team_admins (team_id, person_token) VALUES (?, ?)').run(teamId, admin);
    },

    createInvite(teamId, createdBy, instant) {
      const invite: TeamInvite = { code: randomBytes(INVITE_CODE_BYTES).toString('base64url'), teamId, expiresAt: new Date(instant.getTime() + INVITE_DAYS * DAY_MS).toISOString() };
      db.prepare('INSERT INTO team_invites (code, team_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(invite.code, teamId, createdBy, instant.toISOString(), invite.expiresAt);
      return invite;
    },

    findInvite(code, instant) {
      const row = db.prepare('SELECT code, team_id, expires_at FROM team_invites WHERE code = ? AND expires_at >= ?').get(code, instant.toISOString()) as InviteRow | undefined;
      return row ? toInvite(row) : undefined;
    },

    invitesOf(teamId, instant) {
      const rows = db.prepare('SELECT code, team_id, expires_at FROM team_invites WHERE team_id = ? AND expires_at >= ? ORDER BY created_at DESC').all(teamId, instant.toISOString()) as unknown as InviteRow[];
      return rows.map(toInvite);
    },

    revokeInvite(teamId, code) {
      db.prepare('DELETE FROM team_invites WHERE team_id = ? AND code = ?').run(teamId, code);
    },

    pendingTeamsOf(personToken) {
      const rows = db
        .prepare('SELECT t.id AS id, t.name AS name, t.join_code AS join_code FROM team_join_requests r JOIN teams t ON t.id = r.team_id WHERE r.person_token = ? ORDER BY r.requested_at')
        .all(personToken) as unknown as TeamRow[];
      return rows.map(toTeam);
    },
  };
}
