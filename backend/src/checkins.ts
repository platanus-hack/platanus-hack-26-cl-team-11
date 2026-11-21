import type { Store } from './db.js';

export const MOODS = ['bien', 'normal', 'cansada', 'mal'] as const;
export type Mood = (typeof MOODS)[number];

export interface CheckinDraft {
  mood: Mood;
  blocker: string | null;
  note: string | null;
}

export const CHECKIN_SOURCE = 'checkin';
export const CHECKIN_TYPE = 'checkin';
export const MAX_CHECKIN_TEXT_LENGTH = 280;

export const isMood = (value: unknown): value is Mood => typeof value === 'string' && (MOODS as readonly string[]).includes(value);

const summaryOf = (mood: Mood, blocker: string | null) => `Check-in: ${mood}${blocker ? ' · con un bloqueo' : ''}`;

export function recordCheckin(store: Store, personToken: string, draft: CheckinDraft, now: Date): void {
  store.saveEvent(personToken, {
    source: CHECKIN_SOURCE,
    type: CHECKIN_TYPE,
    occurredAt: now.toISOString(),
    summary: summaryOf(draft.mood, draft.blocker),
    raw: { mood: draft.mood, blocker: draft.blocker, note: draft.note },
  });
}
