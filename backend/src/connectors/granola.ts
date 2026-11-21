import type { EventDraft, KeyConnector } from '../types.js';
import { getJson } from './http.js';

const BASE = 'https://public-api.granola.ai/v1';
const MAX_NOTES_PER_PULL = 20;

interface GranolaUser {
  name: string | null;
  email: string;
}

interface GranolaNoteSummary {
  id: string;
  title: string | null;
  owner: GranolaUser;
  created_at: string;
}

interface GranolaList {
  notes: GranolaNoteSummary[];
  hasMore: boolean;
  cursor: string | null;
}

interface GranolaNote extends GranolaNoteSummary {
  web_url: string;
  attendees: GranolaUser[];
  summary_text: string;
  calendar_event: { scheduled_start_time: string | null; scheduled_end_time: string | null } | null;
}

const headers = (secret: string) => ({ authorization: `Bearer ${secret}`, accept: 'application/json' });

export const granola: KeyConnector = {
  id: 'granola',
  label: 'Granola',
  how: 'Llave personal',
  kind: 'key',
  async identify(secret, fetchImpl) {
    const list = await getJson<GranolaList>(fetchImpl, `${BASE}/notes?page_size=1`, headers(secret), 'Granola');
    return list.notes[0]?.owner.email ?? 'cuenta de Granola';
  },

  async pull(secret, _account, since, fetchImpl) {
    const list = await getJson<GranolaList>(
      fetchImpl,
      `${BASE}/notes?page_size=${MAX_NOTES_PER_PULL}&created_after=${encodeURIComponent(since.toISOString())}`,
      headers(secret),
      'Granola',
    );
    const drafts: EventDraft[] = [];
    for (const item of list.notes) {
      const note = await getJson<GranolaNote>(fetchImpl, `${BASE}/notes/${item.id}`, headers(secret), 'Granola');
      const people = note.attendees.length;
      drafts.push({
        source: 'granola',
        type: 'nota_de_reunion',
        externalId: note.id,
        occurredAt: note.calendar_event?.scheduled_start_time ?? note.created_at,
        summary: `${note.title ?? 'Reunión sin título'} · ${people} ${people === 1 ? 'asistente' : 'asistentes'}`,
        raw: {
          id: note.id,
          title: note.title,
          web_url: note.web_url,
          attendees: note.attendees,
          summary_text: note.summary_text,
          calendar_event: note.calendar_event,
        },
      });
    }
    return drafts;
  },
};
