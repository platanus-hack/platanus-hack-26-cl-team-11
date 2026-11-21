import {
  CLOSED_STATES,
  DAY_MS,
  DEFAULT_TIME_ZONE,
  MINUTE_MS,
  STARTED_STATE,
  checkinsUntil,
  dayKeyOf,
  daysBetween,
  instantOf,
  isFrom,
  latestTasks,
  mean,
  nightsUntil,
  numberOf,
  rawOf,
  textOf,
  type SignalOptions,
  type Signals,
} from './signals.js';
import type { StoredEvent } from './types.js';

export interface SummaryMeeting {
  title: string;
  start: string;
  minutes: number;
}

export interface SummaryTask {
  title: string;
  due: string | null;
}

export interface SummarySleep {
  lastHours: number | null;
  weekHours: number | null;
  usualHours: number | null;
}

export interface SummaryMove {
  workoutMinutes: number | null;
  steps: number | null;
}

export interface Summary {
  lines: string[];
  meetings: SummaryMeeting[];
  working: SummaryTask[];
  topics: string[];
  sleep: SummarySleep;
  move: SummaryMove;
  asOf: string;
}

const WEEK_NIGHTS = 7;
const MIN_WEEK_NIGHTS = 3;
const MIN_USUAL_NIGHTS = 3;
const SHORT_WEEK_RATIO = 0.92;
const LONG_WEEK_RATIO = 1.05;
const TIRED_MOODS = ['cansada', 'mal'];
const MIN_TIRED_DAYS = 2;
const BUSY_MEETING_MINUTES = 180;
const BUSY_MEETING_COUNT = 4;
const DUE_SOON_DAYS = 7;
const MAX_WORKING = 4;
const MAX_TOPICS = 5;
const MAX_LINES = 4;
const FALLBACK_TITLE = 'Reunión';

const hoursText = (hours: number) => `${hours.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
const durationText = (minutes: number) => {
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return hours === 0 ? `${rest} min` : rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};
const countText = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const clockOf = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('es-CL', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

function meetingsOn(events: StoredEvent[], day: string, timeZone: string): SummaryMeeting[] | null {
  const byStart = new Map<number, SummaryMeeting>();
  let connected = false;
  for (const event of events) {
    if (!isFrom(event, 'google_calendar', 'reunion')) continue;
    connected = true;
    const raw = rawOf(event);
    const start = instantOf(raw.start) ?? instantOf(event.occurredAt);
    if (start === null || raw.declined === true || dayKeyOf(new Date(start), timeZone) !== day) continue;
    const end = instantOf(raw.end);
    const minutes = numberOf(raw.durationMinutes) ?? (end === null ? 0 : (end - start) / MINUTE_MS);
    byStart.set(start, { title: textOf(raw.title) ?? FALLBACK_TITLE, start: new Date(start).toISOString(), minutes: Math.max(0, minutes) });
  }
  return connected ? [...byStart.values()].sort((left, right) => left.start.localeCompare(right.start)) : null;
}

function dayLine(meetings: SummaryMeeting[] | null, now: Date, timeZone: string): string | null {
  if (!meetings) return null;
  if (meetings.length === 0) return 'Hoy no tienes reuniones.';
  const minutes = meetings.reduce((total, meeting) => total + meeting.minutes, 0);
  const busy = minutes >= BUSY_MEETING_MINUTES || meetings.length >= BUSY_MEETING_COUNT;
  const next = meetings.find((meeting) => Date.parse(meeting.start) > now.getTime());
  const verb = next ? 'tienes' : 'tuviste';
  const opening = `Hoy ${verb} ${busy ? 'el día cargado' : 'un día liviano'}: ${countText(meetings.length, 'reunión', 'reuniones')}, ${durationText(minutes)} en total.`;
  return next ? `${opening} La próxima es «${next.title}» a las ${clockOf(next.start, timeZone)}.` : opening;
}

function tomorrowLine(meetings: SummaryMeeting[] | null, timeZone: string): string | null {
  const first = meetings?.[0];
  if (!meetings || !first) return null;
  return `Mañana tienes ${countText(meetings.length, 'reunión', 'reuniones')}. La primera es «${first.title}» a las ${clockOf(first.start, timeZone)}.`;
}

function sleepOf(events: StoredEvent[], today: string, timeZone: string): SummarySleep {
  const nights = nightsUntil(events, today, timeZone);
  const week = nights.filter((night) => daysBetween(night.day, today) <= WEEK_NIGHTS);
  const before = nights.filter((night) => daysBetween(night.day, today) > WEEK_NIGHTS);
  const last = nights[0] && daysBetween(nights[0].day, today) <= 1 ? nights[0].hours : null;
  return {
    lastHours: last,
    weekHours: week.length >= MIN_WEEK_NIGHTS ? mean(week.map((night) => night.hours)) : null,
    usualHours: before.length >= MIN_USUAL_NIGHTS ? mean(before.map((night) => night.hours)) : null,
  };
}

function moveToday(events: StoredEvent[], today: string, timeZone: string): SummaryMove {
  let latest: StoredEvent | null = null;
  for (const event of events) {
    if (!isFrom(event, 'apple_health', 'salud_diaria')) continue;
    const day = textOf(rawOf(event).date) ?? dayKeyOf(new Date(event.occurredAt), timeZone);
    if (day === today && (!latest || event.id > latest.id)) latest = event;
  }
  const raw = latest ? rawOf(latest) : {};
  return { workoutMinutes: numberOf(raw.workout_minutes), steps: numberOf(raw.steps) };
}

function sleepLine(sleep: SummarySleep): string | null {
  if (sleep.weekHours === null) return sleep.lastHours === null ? null : `Anoche dormiste ${hoursText(sleep.lastHours)}.`;
  if (sleep.usualHours === null) return `Esta semana dormiste ${hoursText(sleep.weekHours)} por noche.`;
  const ratio = sleep.weekHours / sleep.usualHours;
  if (ratio < SHORT_WEEK_RATIO) return `Vienes de una semana de poco sueño: ${hoursText(sleep.weekHours)} por noche, y lo tuyo son ${hoursText(sleep.usualHours)}.`;
  if (ratio >= LONG_WEEK_RATIO) return `Vienes de una semana de buen descanso: ${hoursText(sleep.weekHours)} por noche, sobre tus ${hoursText(sleep.usualHours)} de siempre.`;
  return `Esta semana dormiste lo de siempre: ${hoursText(sleep.weekHours)} por noche.`;
}

function moodLine(events: StoredEvent[], today: string, timeZone: string): string | null {
  const days = new Set<string>();
  const latestByDay = new Map<string, string | null>();
  for (const checkin of checkinsUntil(events, today, timeZone)) {
    if (daysBetween(checkin.day, today) > WEEK_NIGHTS || latestByDay.has(checkin.day)) continue;
    latestByDay.set(checkin.day, checkin.mood);
    if (checkin.mood && TIRED_MOODS.includes(checkin.mood)) days.add(checkin.day);
  }
  return days.size >= MIN_TIRED_DAYS ? `En ${days.size} de tus últimos check-ins llegaste con cansancio.` : null;
}

export function deriveSummary(events: StoredEvent[], signals: Signals, now: Date, options: SignalOptions = {}): Summary {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const today = dayKeyOf(now, timeZone);
  const meetings = meetingsOn(events, today, timeZone);
  const tomorrow = meetingsOn(events, dayKeyOf(new Date(now.getTime() + DAY_MS), timeZone), timeZone);
  const sleep = sleepOf(events, today, timeZone);
  const tasks = latestTasks(events, timeZone).filter((task) => !CLOSED_STATES.includes(task.stateType ?? ''));

  const working = tasks
    .filter((task) => task.stateType === STARTED_STATE || (task.dueDay !== null && daysBetween(today, task.dueDay) <= DUE_SOON_DAYS))
    .sort((left, right) => (left.dueDay ?? '9').localeCompare(right.dueDay ?? '9') || right.updatedAt - left.updatedAt)
    .slice(0, MAX_WORKING)
    .map((task) => ({ title: task.title, due: task.dueDay }));

  const dueSoon = working.filter((task) => task.due !== null);
  const dueLine = dueSoon.length === 0 ? null : dueSoon.length === 1 ? `Esta semana vence «${dueSoon[0]?.title}».` : `Esta semana vencen ${dueSoon.length} tareas tuyas.`;
  const blocker = signals.blockers[0];

  const lines = [dayLine(meetings, now, timeZone), tomorrowLine(tomorrow, timeZone), sleepLine(sleep), blocker ? `${blocker.statement}.` : null, dueLine, moodLine(events, today, timeZone)]
    .filter((line): line is string => line !== null)
    .slice(0, MAX_LINES);

  return {
    lines,
    meetings: meetings ?? [],
    working,
    topics: signals.expertise.slice(0, MAX_TOPICS),
    sleep,
    move: moveToday(events, today, timeZone),
    asOf: now.toISOString(),
  };
}
