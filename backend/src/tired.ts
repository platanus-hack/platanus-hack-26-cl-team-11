import type { DatabaseSync } from './pg/database.js';
import { DAY_MS, dayKeyOf } from './signals.js';
import type { EventDraft } from './types.js';

const MARK = 'hackaton';
const USUAL_NIGHTS = [7.4, 7.1, 7.6, 6.9, 7.3];
const SHORT_NIGHTS = [5.2, 4.4];
const LAST_NIGHTS = [3.4, 2.9, 3.8, 3.1, 4.2, 2.6, 3.6, 3.9, 3.2];
const STEPS_TODAY = [1840, 1210, 2460, 960, 2120, 1530, 2790, 1380, 1990];
const USUAL_STEPS = 7200;
const RESTED_NIGHT = 8 + 32 / 60;
const RESTED_STEPS = 6400;
const HACK_TITLE = 'Platanus Hack';
const HACK_START_UTC_HOUR = 12;
const HACK_MINUTES = 420;
const MINUTE_MS = 60_000;

const dayBefore = (today: string, days: number) => new Date(Date.parse(`${today}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);

const healthDay = (date: string, sleepHours: number, steps: number): EventDraft => ({
  source: 'apple_health',
  type: 'salud_diaria',
  occurredAt: date,
  summary: `sueño ${sleepHours.toFixed(1)} h · ${steps} pasos`,
  raw: { date, sleep_hours: sleepHours, steps, demo: MARK },
});

export interface DemoMeeting {
  title: string;
  hour: number;
  minute: number;
  minutes: number;
}

const SANTIAGO_UTC_OFFSET_HOURS = 3;

const meetingDraft = (day: string, meeting: DemoMeeting): EventDraft => {
  const start = new Date(Date.parse(`${day}T00:00:00Z`) + ((meeting.hour + SANTIAGO_UTC_OFFSET_HOURS) * 60 + meeting.minute) * MINUTE_MS);
  return {
    source: 'google_calendar',
    type: 'reunion',
    occurredAt: start.toISOString(),
    summary: `${meeting.title} · ${meeting.minutes} min`,
    raw: { title: meeting.title, start: start.toISOString(), end: new Date(start.getTime() + meeting.minutes * MINUTE_MS).toISOString(), durationMinutes: meeting.minutes, attendees: 0, declined: false, demo: MARK },
  };
};

export function tiredDrafts(position: number, now: Date, rested = false, tomorrow: DemoMeeting[] = []): EventDraft[] {
  const today = dayKeyOf(now);
  const pick = (values: number[]) => values[position % values.length] ?? values[0] ?? 0;
  const start = new Date(Date.parse(`${today}T00:00:00Z`) + HACK_START_UTC_HOUR * 60 * MINUTE_MS);
  const usual = USUAL_NIGHTS.map((hours, index) => healthDay(dayBefore(today, USUAL_NIGHTS.length + SHORT_NIGHTS.length - index), hours, USUAL_STEPS + index * 310));
  const short = SHORT_NIGHTS.map((hours, index) => healthDay(dayBefore(today, SHORT_NIGHTS.length - index), hours + (position % 3) * 0.2, 3100 - index * 600));
  return [
    ...usual,
    ...short,
    rested ? healthDay(today, RESTED_NIGHT, RESTED_STEPS) : healthDay(today, pick(LAST_NIGHTS), pick(STEPS_TODAY)),
    ...tomorrow.map((meeting) => meetingDraft(dayBefore(today, -1), meeting)),
    {
      source: 'google_calendar',
      type: 'reunion',
      occurredAt: start.toISOString(),
      summary: `${HACK_TITLE} · ${HACK_MINUTES} min`,
      raw: { title: HACK_TITLE, start: start.toISOString(), end: new Date(start.getTime() + HACK_MINUTES * MINUTE_MS).toISOString(), durationMinutes: HACK_MINUTES, attendees: 0, declined: false, demo: MARK },
    },
  ];
}

export const clearTired = (db: DatabaseSync) => Number(db.prepare(`DELETE FROM events WHERE raw LIKE ?`).run(`%"demo":"${MARK}"%`).changes);
