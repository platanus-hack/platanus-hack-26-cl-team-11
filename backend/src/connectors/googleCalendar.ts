import { getGoogleJson } from '../oauth/google.js';
import type { EventDraft, Fetch, OAuthConnector, WindowPull } from '../types.js';

const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const UPCOMING_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS_PER_PULL = 250;

interface CalendarAttendee {
  self?: boolean;
  resource?: boolean;
  responseStatus?: string;
}

interface CalendarEvent {
  id: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  attendees?: CalendarAttendee[];
}

interface CalendarList {
  items?: CalendarEvent[];
  nextPageToken?: string;
}

interface Meeting {
  id: string;
  title: string;
  start: string;
  end: string;
  durationMinutes: number;
  attendees: number;
  declined: boolean;
}

function toMeeting(event: CalendarEvent): Meeting | null {
  const start = event.start?.dateTime;
  const end = event.end?.dateTime;
  if (event.status === 'cancelled' || !start || !end) return null;
  const people = (event.attendees ?? []).filter((attendee) => !attendee.resource);
  return {
    id: event.id,
    title: event.summary?.trim() || 'Reunión sin título',
    start,
    end,
    durationMinutes: Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000),
    attendees: people.length,
    declined: people.some((attendee) => attendee.self === true && attendee.responseStatus === 'declined'),
  };
}

const describeAttendees = (count: number) => (count === 0 ? '' : ` · ${count} ${count === 1 ? 'asistente' : 'asistentes'}`);

const toDraft = (meeting: Meeting): EventDraft => ({
  source: 'google_calendar',
  type: 'reunion',
  externalId: meeting.id,
  occurredAt: new Date(meeting.start).toISOString(),
  summary: `${meeting.title} · ${meeting.durationMinutes} min${describeAttendees(meeting.attendees)}`,
  raw: meeting,
});

async function pullWindow(accessToken: string, _account: string, since: Date, fetchImpl: Fetch): Promise<WindowPull> {
  const window = { from: since.toISOString(), to: new Date(Date.now() + UPCOMING_DAYS * DAY_MS).toISOString() };
  const query = new URLSearchParams({
    timeMin: window.from,
    timeMax: window.to,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(MAX_EVENTS_PER_PULL),
  });
  const list = await getGoogleJson<CalendarList>(fetchImpl, `${EVENTS_URL}?${query}`, accessToken, 'Google Calendar');
  const drafts = (list.items ?? [])
    .map(toMeeting)
    .filter((meeting): meeting is Meeting => meeting !== null && !meeting.declined)
    .map(toDraft);
  return { drafts, window: list.nextPageToken ? null : window };
}

export const googleCalendar: OAuthConnector = {
  id: 'google_calendar',
  label: 'Google Calendar',
  how: 'Cuenta de Google',
  kind: 'oauth',
  provider: 'google',
  scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  pullWindow,

  async pull(accessToken, account, since, fetchImpl) {
    return (await pullWindow(accessToken, account, since, fetchImpl)).drafts;
  },
};
