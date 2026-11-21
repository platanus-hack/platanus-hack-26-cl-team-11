import type { TeamStore } from '../teams/store.js';
import type { JsonObject } from '../types.js';
import type { RoomEventType, RoomStore } from './store.js';

export function recordInRoomsOf(deps: { teams: TeamStore; rooms: RoomStore }, personToken: string, type: RoomEventType, payload: JsonObject): void {
  for (const team of deps.teams.teamsOf(personToken)) {
    if (deps.rooms.roomOfTeam(team.id)) deps.rooms.record(team.id, type, payload);
  }
}
