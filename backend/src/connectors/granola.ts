import { callGranolaTool } from '../oauth/granola.js';
import type { EventDraft, OAuthConnector } from '../types.js';

const MEETINGS_PER_PAGE = 100;
const MAX_PAGES = 3;
const NOTE_URL = 'https://notes.granola.ai/d/';
const UNTITLED = 'Reunión sin título';
const MEETING_BLOCK = /<meeting\s([^>]*)>([\s\S]*?)<\/meeting>/g;
const ATTRIBUTE = /([a-z_]+)="([^"]*)"/g;
const PARTICIPANT_TOTAL = /<known_participants[^>]*\btotal="(\d+)"/;
const NEXT_CURSOR = /<pagination[^>]*\bhas_more="true"[^>]*\bnext_cursor="([^"]+)"/;
const XML_ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" };
const XML_ENTITY = /&(?:amp|lt|gt|quot|apos|#39);/g;

const decoded = (text: string) => text.replace(XML_ENTITY, (entity) => XML_ENTITIES[entity] ?? entity);

const attributesOf = (tag: string): Record<string, string> => Object.fromEntries([...tag.matchAll(ATTRIBUTE)].map((match) => [match[1] ?? '', decoded(match[2] ?? '')]));

export function meetingsIn(listing: string): EventDraft[] {
  const drafts: EventDraft[] = [];
  for (const block of listing.matchAll(MEETING_BLOCK)) {
    const attributes = attributesOf(block[1] ?? '');
    const id = attributes.id;
    const startedAt = attributes.meeting_at ?? attributes.created_at;
    if (!id || !startedAt || Number.isNaN(Date.parse(startedAt))) continue;
    const title = attributes.title?.trim() || null;
    const total = PARTICIPANT_TOTAL.exec(block[2] ?? '')?.[1];
    const people = total === undefined ? null : Number(total);
    drafts.push({
      source: 'granola',
      type: 'nota_de_reunion',
      externalId: id,
      occurredAt: startedAt,
      summary: people === null ? (title ?? UNTITLED) : `${title ?? UNTITLED} · ${people} ${people === 1 ? 'asistente' : 'asistentes'}`,
      raw: {
        id,
        title,
        web_url: `${NOTE_URL}${id}`,
        attendees: people,
        organizer: attributes.organizer ?? null,
        calendar_event: { scheduled_start_time: startedAt, scheduled_end_time: null },
      },
    });
  }
  return drafts;
}

export const granola: OAuthConnector = {
  id: 'granola',
  label: 'Granola',
  how: 'Cuenta de Granola',
  kind: 'oauth',
  provider: 'granola',
  scopes: ['openid', 'email', 'profile', 'offline_access'],

  async pull(accessToken, _account, since, fetchImpl) {
    const drafts: EventDraft[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const listing: string = await callGranolaTool(fetchImpl, accessToken, 'search_meetings', {
        from_date: since.toISOString(),
        limit: MEETINGS_PER_PAGE,
        attended_only: true,
        include_shared: false,
        max_participants: 0,
        ...(cursor ? { cursor } : {}),
      });
      drafts.push(...meetingsIn(listing));
      cursor = NEXT_CURSOR.exec(listing)?.[1] ?? null;
      if (!cursor) break;
    }
    return drafts;
  },
};
