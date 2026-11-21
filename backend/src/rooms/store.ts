import type { DatabaseSync } from '../pg/database.js';
import { normalizeCode, randomCode } from '../codes.js';
import type { JsonObject } from '../types.js';

export const ROOM_EVENT_TYPES = ['persona_entra', 'asistente_conecta', 'repo_cambia', 'ronda_empieza', 'pedido_busca', 'hilo_abre', 'hilo_responde', 'propuesta_nace', 'pedido_cierra', 'ronda_termina'] as const;
export type RoomEventType = (typeof ROOM_EVENT_TYPES)[number];

const ROOM_CODE_LENGTH = 6;
const CODE_ATTEMPTS = 5;

export interface Room {
  code: string;
  teamId: string;
  name: string;
}

export interface RoomEvent {
  id: number;
  type: RoomEventType;
  payload: JsonObject;
  createdAt: string;
}

export interface RoomStore {
  createRoom(teamId: string): Room;
  findRoom(code: string): Room | undefined;
  roomOfTeam(teamId: string): Room | undefined;
  record(teamId: string, type: RoomEventType, payload: JsonObject): void;
  eventsAfter(teamId: string, afterId: number, limit: number): RoomEvent[];
  lastEventId(teamId: string): number;
  lastEventOfType(teamId: string, type: RoomEventType): number;
}

interface RoomRow {
  code: string;
  team_id: string;
  name: string;
}

interface EventRow {
  id: number;
  type: RoomEventType;
  payload: string;
  created_at: string;
}

const ROOM_COLUMNS = 'r.code AS code, r.team_id AS team_id, t.name AS name';
const toRoom = (row: RoomRow): Room => ({ code: row.code, teamId: row.team_id, name: row.name });

export function openRoomStore(db: DatabaseSync, now: () => Date = () => new Date()): RoomStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      team_id TEXT NOT NULL UNIQUE REFERENCES teams (id),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS room_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS room_events_team ON room_events (team_id, id);
  `);

  const roomOfTeam = (teamId: string) => {
    const row = db.prepare(`SELECT ${ROOM_COLUMNS} FROM rooms r JOIN teams t ON t.id = r.team_id WHERE r.team_id = ?`).get(teamId) as RoomRow | undefined;
    return row ? toRoom(row) : undefined;
  };

  const findRoom = (code: string) => {
    const row = db.prepare(`SELECT ${ROOM_COLUMNS} FROM rooms r JOIN teams t ON t.id = r.team_id WHERE r.code = ?`).get(normalizeCode(code)) as RoomRow | undefined;
    return row ? toRoom(row) : undefined;
  };

  return {
    createRoom(teamId) {
      const existing = roomOfTeam(teamId);
      if (existing) return existing;
      for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
        const inserted = db.prepare('INSERT OR IGNORE INTO rooms (code, team_id, created_at) VALUES (?, ?, ?)').run(randomCode(ROOM_CODE_LENGTH), teamId, now().toISOString());
        if (Number(inserted.changes) === 1) break;
      }
      const room = roomOfTeam(teamId);
      if (!room) throw new Error('Could not create the room.');
      return room;
    },

    findRoom,
    roomOfTeam,

    record(teamId, type, payload) {
      db.prepare('INSERT INTO room_events (team_id, type, payload, created_at) VALUES (?, ?, ?, ?)').run(teamId, type, JSON.stringify(payload), now().toISOString());
    },

    eventsAfter(teamId, afterId, limit) {
      const rows = db
        .prepare('SELECT id, type, payload, created_at FROM room_events WHERE team_id = ? AND id > ? ORDER BY id LIMIT ?')
        .all(teamId, afterId, limit) as unknown as EventRow[];
      return rows.map((row) => ({ id: Number(row.id), type: row.type, payload: JSON.parse(row.payload) as JsonObject, createdAt: row.created_at }));
    },

    lastEventId(teamId) {
      const row = db.prepare('SELECT MAX(id) AS last FROM room_events WHERE team_id = ?').get(teamId) as { last: number | null } | undefined;
      return Number(row?.last ?? 0);
    },

    lastEventOfType(teamId, type) {
      const row = db.prepare('SELECT MAX(id) AS last FROM room_events WHERE team_id = ? AND type = ?').get(teamId, type) as { last: number | null } | undefined;
      return Number(row?.last ?? 0);
    },
  };
}
