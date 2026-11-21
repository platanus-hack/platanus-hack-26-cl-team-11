import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { DatabaseSync } from 'node:sqlite';
import type { AppContext } from '../context.js';
import { deriveSignals } from '../signals.js';
import { asObject, NOT_FOUND } from './shared.js';

export const MOODS = ['bien', 'normal', 'cansada', 'mal'] as const;
export type Mood = (typeof MOODS)[number];

export interface CheckinEntry {
  at: string;
  mood: Mood;
  blocker: string | null;
  note: string | null;
}

const CHECKIN_SOURCE = 'checkin';
const CHECKIN_TYPE = 'checkin';
const MAX_TEXT_LENGTH = 280;
const MAX_BODY_BYTES = 10_000;
const RECENT_CHECKINS = 14;
const SIGNAL_EVENT_LIMIT = 500;
const INVALID_MOOD = { error: `El ánimo debe ser uno de: ${MOODS.join(', ')}.` } as const;

type FreeText = { ok: true; value: string | null } | { ok: false; error: string };

interface CheckinRow {
  occurred_at: string;
  raw: string;
}

const isMood = (value: unknown): value is Mood => typeof value === 'string' && (MOODS as readonly string[]).includes(value);

const readFreeText = (value: unknown, label: string): FreeText => {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, error: `${label} debe ser texto.` };
  const text = value.trim();
  if ([...text].length > MAX_TEXT_LENGTH) return { ok: false, error: `${label} no puede tener más de ${MAX_TEXT_LENGTH} caracteres.` };
  return { ok: true, value: text || null };
};

const storedText = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

const summaryOf = (mood: Mood, blocker: string | null) => `Check-in: ${mood}${blocker ? ' · con un bloqueo' : ''}`;

function recentCheckins(db: DatabaseSync, personToken: string): CheckinEntry[] {
  const rows = db
    .prepare('SELECT occurred_at, raw FROM events WHERE person_token = ? AND source = ? AND type = ? ORDER BY occurred_at DESC, id DESC LIMIT ?')
    .all(personToken, CHECKIN_SOURCE, CHECKIN_TYPE, RECENT_CHECKINS) as unknown as CheckinRow[];
  const entries: CheckinEntry[] = [];
  for (const row of rows) {
    const raw = asObject(row.raw);
    if (!isMood(raw.mood)) continue;
    entries.push({ at: row.occurred_at, mood: raw.mood, blocker: storedText(raw.blocker), note: storedText(raw.note) });
  }
  return entries;
}

export function checkinRoutes({ db, store }: AppContext) {
  const routes = new Hono();

  const limitBody = bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: 'El check-in es demasiado largo.' }, 413) });

  routes.post('/people/:token/checkins', limitBody, async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const body = asObject(await c.req.text());
    if (!isMood(body.mood)) return c.json(INVALID_MOOD, 400);
    const blocker = readFreeText(body.blocker, 'El bloqueo');
    if (!blocker.ok) return c.json({ error: blocker.error }, 400);
    const note = readFreeText(body.note, 'La nota');
    if (!note.ok) return c.json({ error: note.error }, 400);

    const now = new Date();
    store.saveEvent(person.token, {
      source: CHECKIN_SOURCE,
      type: CHECKIN_TYPE,
      occurredAt: now.toISOString(),
      summary: summaryOf(body.mood, blocker.value),
      raw: { mood: body.mood, blocker: blocker.value, note: note.value },
    });
    return c.json({ ok: true, signals: deriveSignals(store.listEvents(person.token, SIGNAL_EVENT_LIMIT), now) }, 201);
  });

  routes.get('/people/:token/checkins', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json(recentCheckins(db, person.token));
  });

  return routes;
}
