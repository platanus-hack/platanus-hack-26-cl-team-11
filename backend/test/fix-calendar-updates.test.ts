import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from '../src/context.js';
import { deriveSignals } from '../src/signals.js';
import { syncSource } from '../src/sync.js';
import type { Fetch } from '../src/types.js';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

interface FakeMeeting {
  id: string;
  start: number;
  minutes: number;
  status?: string;
  declined?: boolean;
}

interface FakeCalendar {
  meetings: FakeMeeting[];
  nextPageToken?: string;
}

const toItem = (meeting: FakeMeeting) => ({
  id: meeting.id,
  status: meeting.status ?? 'confirmed',
  summary: 'Planning',
  start: { dateTime: new Date(meeting.start).toISOString() },
  end: { dateTime: new Date(meeting.start + meeting.minutes * MINUTE_MS).toISOString() },
  attendees: [{ self: true, responseStatus: meeting.declined ? 'declined' : 'accepted' }],
});

const calendarFetch = (calendar: FakeCalendar): Fetch =>
  (async (input: Parameters<Fetch>[0]) =>
    String(input).startsWith('https://www.googleapis.com/calendar/v3/')
      ? Response.json({ items: calendar.meetings.map(toItem), ...(calendar.nextPageToken ? { nextPageToken: calendar.nextPageToken } : {}) })
      : new Response('{}', { status: 404 })) as Fetch;

const setup = (meetings: FakeMeeting[]) => {
  const calendar: FakeCalendar = { meetings };
  const ctx = createContext({ location: ':memory:', fetch: calendarFetch(calendar) });
  const { token } = ctx.store.addPerson('Ana');
  ctx.store.saveConnection(token, 'google_calendar', 'ana@example.com', JSON.stringify({ accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 60 * MINUTE_MS }));
  const sync = () => syncSource(ctx, token, 'google_calendar');
  const meetingsStored = () => ctx.store.listEvents(token, 500).filter((event) => event.source === 'google_calendar');
  const loadAt = (now: Date) => deriveSignals(ctx.store.listEvents(token, 500), now).load.statement;
  return { ctx, token, calendar, sync, meetingsStored, loadAt };
};

test('a meeting moved to another day leaves today and counts on its new day', async () => {
  const now = new Date();
  const { calendar, sync, meetingsStored, loadAt } = setup([{ id: 'planning', start: now.getTime(), minutes: 300 }]);
  assert.equal(await sync(), 1);
  assert.equal(loadAt(now), 'Carga alta hoy');
  const [first] = meetingsStored();

  const moved = now.getTime() + 3 * DAY_MS;
  calendar.meetings = [{ id: 'planning', start: moved, minutes: 300 }];
  assert.equal(await sync(), 1);
  const stored = meetingsStored();
  assert.equal(stored.length, 1);
  assert.equal(stored[0]?.id, first?.id);
  assert.equal(stored[0]?.occurredAt, new Date(moved).toISOString());
  assert.equal(loadAt(now), 'Carga baja hoy');
  assert.equal(loadAt(new Date(moved)), 'Carga alta hoy');
});

test('a meeting cancelled or declined after it was imported stops counting', async () => {
  const now = new Date();
  const planning: FakeMeeting = { id: 'planning', start: now.getTime(), minutes: 300 };
  const standup: FakeMeeting = { id: 'standup', start: now.getTime() + 1000, minutes: 15 };

  const removed = setup([planning, standup]);
  assert.equal(await removed.sync(), 2);
  assert.equal(removed.loadAt(now), 'Carga alta hoy');
  removed.calendar.meetings = [standup];
  assert.equal(await removed.sync(), 0);
  assert.deepEqual(removed.meetingsStored().map((event) => (event.raw as { id: string }).id), ['standup']);
  assert.equal(removed.loadAt(now), 'Carga baja hoy');

  for (const change of [{ status: 'cancelled' }, { declined: true }]) {
    const changed = setup([planning, standup]);
    await changed.sync();
    changed.calendar.meetings = [{ ...planning, ...change }, standup];
    await changed.sync();
    assert.deepEqual(changed.meetingsStored().map((event) => (event.raw as { id: string }).id), ['standup']);
    assert.equal(changed.loadAt(now), 'Carga baja hoy');
  }
});

test('a truncated list, a meeting outside the pulled window and other sources are never pruned', async () => {
  const now = Date.now();
  const { ctx, token, calendar, sync, meetingsStored } = setup([
    { id: 'planning', start: now, minutes: 60 },
    { id: 'review', start: now + DAY_MS, minutes: 60 },
  ]);
  ctx.store.saveEvent(token, { source: 'google_calendar', type: 'reunion', externalId: 'old', occurredAt: new Date(now - 30 * DAY_MS).toISOString(), summary: 'Vieja', raw: { id: 'old' } });
  ctx.store.saveEvent(token, { source: 'granola', type: 'nota_de_reunion', externalId: 'note', occurredAt: new Date(now).toISOString(), summary: 'Nota', raw: { id: 'note' } });
  await sync();
  assert.equal(meetingsStored().length, 3);

  calendar.meetings = [{ id: 'planning', start: now, minutes: 60 }];
  calendar.nextPageToken = 'more';
  await sync();
  assert.equal(meetingsStored().length, 3);

  calendar.nextPageToken = undefined;
  await sync();
  assert.deepEqual(meetingsStored().map((event) => (event.raw as { id: string }).id).sort(), ['old', 'planning']);
  assert.equal(ctx.store.listEvents(token, 500).filter((event) => event.source === 'granola').length, 1);
});

test('saving the same external event again changes nothing, and a changed one replaces the stored row', async () => {
  const { ctx, token } = setup([]);
  const note = { source: 'granola', type: 'nota_de_reunion', externalId: 'note', occurredAt: '2026-11-20T15:00:00.000Z', summary: 'Planificación · 2 asistentes', raw: { summary_text: 'Primera versión' } };
  const first = ctx.store.saveEvent(token, note);
  assert.ok(first);
  const before = ctx.store.listEvents(token);
  assert.equal(ctx.store.saveEvent(token, note), null);
  assert.deepEqual(ctx.store.listEvents(token), before);

  const updated = ctx.store.saveEvent(token, { ...note, summary: 'Planificación · 3 asistentes', raw: { summary_text: 'Versión final' } });
  assert.equal(updated?.id, first.id);
  const stored = ctx.store.listEvents(token);
  assert.equal(stored.length, 1);
  assert.equal(stored[0]?.id, first.id);
  assert.equal(stored[0]?.summary, 'Planificación · 3 asistentes');
  assert.deepEqual(stored[0]?.raw, { summary_text: 'Versión final' });

  const other = ctx.store.addPerson('Tomás');
  assert.ok(ctx.store.saveEvent(other.token, note));
  const push = { source: 'apple_health', type: 'salud_diaria', occurredAt: '2026-11-20', summary: 'sueño 7.0 h', raw: { sleep_hours: 7 } };
  const pushes = [ctx.store.saveEvent(token, push), ctx.store.saveEvent(token, push)];
  assert.ok(pushes[0] && pushes[1]);
  assert.notEqual(pushes[0].id, pushes[1].id);
  assert.equal(ctx.store.listEvents(token).length, 3);
});
