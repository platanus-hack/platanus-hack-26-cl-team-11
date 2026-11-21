import type { StoredEvent } from './types.js';

export type SignalLevel = 'baja' | 'media' | 'alta' | 'sin_datos';
export type Visibility = 'siempre' | 'preguntar' | 'nunca';

export interface LevelSignal {
  level: SignalLevel;
  statement: string;
  basis: string[];
  visibility: Visibility;
}

export interface Blocker {
  topic: string;
  since: string;
  statement: string;
  source: 'checkin' | 'linear';
  visibility: Visibility;
}

export interface SignalVisibility {
  energy: Visibility;
  load: Visibility;
  blockers: Visibility;
  expertise: Visibility;
}

export interface Signals {
  energy: LevelSignal;
  load: LevelSignal;
  blockers: Blocker[];
  blockerBasis: string[];
  expertise: string[];
  focus: string[];
  visibility: SignalVisibility;
  asOf: string;
}

export interface SignalOptions {
  timeZone?: string;
}

export const DEFAULT_TIME_ZONE = 'America/Santiago';
export const DEFAULT_VISIBILITY: SignalVisibility = { energy: 'preguntar', load: 'preguntar', blockers: 'siempre', expertise: 'siempre' };
export const FIXED_THRESHOLD_BASIS = 'umbral fijo por poco historial';

export const DAY_MS = 86_400_000;
export const MINUTE_MS = 60_000;

const MIN_BASELINE_NIGHTS = 3;
const LOW_SLEEP_RATIO = 0.85;
const HIGH_SLEEP_RATIO = 1.05;
const FIXED_LOW_SLEEP_HOURS = 6;
const FIXED_HIGH_SLEEP_HOURS = 7.5;
const MAX_SLEEP_HOURS = 24;
const LAST_NIGHT_MAX_AGE_DAYS = 1;
const MOOD_MAX_AGE_DAYS = 1;
const RECENT_NIGHTS_WINDOW_DAYS = 3;
const SUSTAINED_LOW_NIGHTS = 2;
const MOOD_ENERGY_STEP: Record<string, number> = { bien: 1, normal: 0, cansada: -1, mal: -1 };

const HEAVY_MEETING_MINUTES = 240;
const MODERATE_MEETING_MINUTES = 120;
const HEAVY_MEETING_COUNT = 6;
const MODERATE_MEETING_COUNT = 3;
const HEAVY_STARTED_TASKS = 5;
const MODERATE_STARTED_TASKS = 3;
const HEAVY_DUE_SOON_TASKS = 3;
const MODERATE_DUE_SOON_TASKS = 1;
const DUE_SOON_DAYS = 7;
const HEAVY_PRESSURE = 2;
const MODERATE_PRESSURE = 1;
const HIGH_LOAD_PRESSURE = 2;

const STALE_TASK_DAYS = 3;
const CHECKIN_BLOCKER_MAX_AGE_DAYS = 7;
export const STARTED_STATE = 'started';
export const CLOSED_STATES = ['completed', 'canceled'];

const MAX_REPOS = 5;
const MAX_FOCUS_TASKS = 3;
const MAX_FOCUS_PULLS = 2;
const MAX_FOCUS_REPOS = 2;
const RECENT_PULL_DAYS = 7;
const RECENT_COMMIT_DAYS = 3;
const MAX_TOPICS = 5;
const MIN_TOPIC_TITLES = 2;
const MIN_TOPIC_LENGTH = 3;
const GRAMMATICAL_WORDS = new Set([
  'del', 'las', 'los', 'una', 'uno', 'unas', 'unos', 'con', 'sin', 'por', 'para', 'que', 'como', 'sobre', 'desde', 'hasta', 'entre', 'esta', 'este',
  'the', 'and', 'for', 'with', 'from', 'into',
]);

const LEVELS = ['baja', 'media', 'alta'] as const;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WORD_BOUNDARY = /[^\p{L}\p{N}]+/u;

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

export function dayKeyOf(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter.format(instant);
}

const dayNumber = (dayKey: string) => Date.UTC(Number(dayKey.slice(0, 4)), Number(dayKey.slice(5, 7)) - 1, Number(dayKey.slice(8, 10))) / DAY_MS;
export const daysBetween = (fromDay: string, toDay: string) => dayNumber(toDay) - dayNumber(fromDay);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const rawOf = (event: StoredEvent): Record<string, unknown> => (isRecord(event.raw) ? event.raw : {});
export const textOf = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

export const numberOf = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value.replace(',', '.')) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export const instantOf = (value: unknown): number | null => {
  const text = textOf(value);
  const parsed = text ? Date.parse(text) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export const dayOf = (value: unknown, timeZone: string): string | null => {
  const text = textOf(value);
  if (!text) return null;
  if (DAY_KEY_PATTERN.test(text)) return text;
  const instant = instantOf(text);
  return instant === null ? null : dayKeyOf(new Date(instant), timeZone);
};

export const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
export const isFrom = (event: StoredEvent, source: string, type: string) => event.source === source && event.type === type;

const elapsedText = (days: number) => (days <= 0 ? 'desde hoy' : days === 1 ? 'desde ayer' : `desde hace ${days} días`);

export interface Night {
  day: string;
  hours: number;
  eventId: number;
}

export function nightsUntil(events: StoredEvent[], today: string, timeZone: string): Night[] {
  const byDay = new Map<string, Night>();
  for (const event of events) {
    if (!isFrom(event, 'apple_health', 'salud_diaria')) continue;
    const raw = rawOf(event);
    const hours = numberOf(raw.sleep_hours);
    const day = dayOf(raw.date, timeZone) ?? dayOf(event.occurredAt, timeZone) ?? dayOf(event.receivedAt, timeZone);
    if (hours === null || hours <= 0 || hours > MAX_SLEEP_HOURS || !day || daysBetween(day, today) < 0) continue;
    const known = byDay.get(day);
    if (!known || event.id > known.eventId) byDay.set(day, { day, hours, eventId: event.id });
  }
  return [...byDay.values()].sort((left, right) => dayNumber(right.day) - dayNumber(left.day));
}

export interface Checkin {
  at: number;
  day: string;
  eventId: number;
  mood: string | null;
  blocker: string | null;
}

export function checkinsUntil(events: StoredEvent[], today: string, timeZone: string): Checkin[] {
  const checkins: Checkin[] = [];
  for (const event of events) {
    if (!isFrom(event, 'checkin', 'checkin')) continue;
    const at = instantOf(event.occurredAt);
    const day = dayOf(event.occurredAt, timeZone);
    if (at === null || !day || daysBetween(day, today) < 0) continue;
    const raw = rawOf(event);
    checkins.push({ at, day, eventId: event.id, mood: textOf(raw.mood), blocker: textOf(raw.blocker) });
  }
  return checkins.sort((left, right) => right.at - left.at || right.eventId - left.eventId);
}

function deriveEnergy(nights: Night[], checkins: Checkin[], today: string): LevelSignal {
  const visibility = DEFAULT_VISIBILITY.energy;
  const latestNight = nights[0];
  const lastNight = latestNight && daysBetween(latestNight.day, today) <= LAST_NIGHT_MAX_AGE_DAYS ? latestNight : null;
  const latestCheckin = checkins[0];
  const reportedMood = latestCheckin && daysBetween(latestCheckin.day, today) <= MOOD_MAX_AGE_DAYS ? latestCheckin.mood : null;
  const moodStep = reportedMood !== null && Object.hasOwn(MOOD_ENERGY_STEP, reportedMood) ? (MOOD_ENERGY_STEP[reportedMood] ?? null) : null;

  if (!lastNight && moodStep === null) return { level: 'sin_datos', statement: 'Sin datos de energía', basis: [], visibility };

  const earlierHours = nights.slice(1).map((night) => night.hours);
  const ownAverage = lastNight && earlierHours.length >= MIN_BASELINE_NIGHTS ? mean(earlierHours) : null;
  const isShort = (hours: number) => (ownAverage !== null ? hours / ownAverage < LOW_SLEEP_RATIO : hours < FIXED_LOW_SLEEP_HOURS);
  const isLong = (hours: number) => (ownAverage !== null ? hours / ownAverage >= HIGH_SLEEP_RATIO : hours >= FIXED_HIGH_SLEEP_HOURS);

  const sleepStep = !lastNight ? 1 : isShort(lastNight.hours) ? 0 : isLong(lastNight.hours) ? 2 : 1;
  const level = LEVELS[Math.min(2, Math.max(0, sleepStep + (moodStep ?? 0)))] ?? 'media';
  const recentShortNights = lastNight
    ? nights.filter((night) => daysBetween(night.day, lastNight.day) < RECENT_NIGHTS_WINDOW_DAYS && isShort(night.hours)).length
    : 0;
  const period = level === 'baja' && recentShortNights >= SUSTAINED_LOW_NIGHTS ? 'esta semana' : 'hoy';

  const basis: string[] = [];
  if (lastNight) basis.push('apple_health');
  if (moodStep !== null) basis.push('checkin');
  if (lastNight && ownAverage === null) basis.push(FIXED_THRESHOLD_BASIS);

  return { level, statement: `Energía ${level} ${period}`, basis, visibility };
}

export interface Task {
  identifier: string;
  title: string;
  stateType: string | null;
  updatedAt: number;
  dueDay: string | null;
  eventId: number;
}

export function latestTasks(events: StoredEvent[], timeZone: string): Task[] {
  const byIdentifier = new Map<string, Task>();
  for (const event of events) {
    if (!isFrom(event, 'linear', 'tarea')) continue;
    const raw = rawOf(event);
    const identifier = textOf(raw.identifier);
    const updatedAt = instantOf(raw.updatedAt) ?? instantOf(event.occurredAt);
    if (!identifier || updatedAt === null) continue;
    const known = byIdentifier.get(identifier);
    if (known && (known.updatedAt > updatedAt || (known.updatedAt === updatedAt && known.eventId > event.id))) continue;
    byIdentifier.set(identifier, {
      identifier,
      title: textOf(raw.title) ?? identifier,
      stateType: textOf(raw.stateType),
      updatedAt,
      dueDay: dayOf(raw.dueDate, timeZone),
      eventId: event.id,
    });
  }
  return [...byIdentifier.values()].sort((left, right) => left.updatedAt - right.updatedAt || left.identifier.localeCompare(right.identifier));
}

interface MeetingDay {
  count: number;
  minutes: number;
  sources: string[];
}

function meetingsOn(events: StoredEvent[], today: string, timeZone: string): MeetingDay | null {
  const minutesByStart = new Map<number, number>();
  const sources = new Set<string>();

  for (const event of events) {
    if (!isFrom(event, 'google_calendar', 'reunion')) continue;
    sources.add('google_calendar');
    const raw = rawOf(event);
    const start = instantOf(raw.start) ?? instantOf(event.occurredAt);
    if (start === null || raw.declined === true || dayKeyOf(new Date(start), timeZone) !== today) continue;
    const end = instantOf(raw.end);
    const minutes = numberOf(raw.durationMinutes) ?? (end === null ? 0 : (end - start) / MINUTE_MS);
    minutesByStart.set(start, Math.max(0, minutes));
  }

  for (const event of events) {
    if (!isFrom(event, 'granola', 'nota_de_reunion')) continue;
    const schedule = rawOf(event).calendar_event;
    if (!isRecord(schedule)) continue;
    const start = instantOf(schedule.scheduled_start_time);
    const end = instantOf(schedule.scheduled_end_time);
    if (start === null || dayKeyOf(new Date(start), timeZone) !== today || minutesByStart.has(start)) continue;
    sources.add('granola');
    minutesByStart.set(start, end === null ? 0 : Math.max(0, (end - start) / MINUTE_MS));
  }

  if (sources.size === 0) return null;
  return { count: minutesByStart.size, minutes: [...minutesByStart.values()].reduce((total, minutes) => total + minutes, 0), sources: [...sources] };
}

const pressureOf = (heavy: boolean, moderate: boolean) => (heavy ? HEAVY_PRESSURE : moderate ? MODERATE_PRESSURE : 0);

function deriveLoad(meetings: MeetingDay | null, tasks: Task[], today: string): LevelSignal {
  const visibility = DEFAULT_VISIBILITY.load;
  if (!meetings && tasks.length === 0) return { level: 'sin_datos', statement: 'Sin datos de carga', basis: [], visibility };

  const started = tasks.filter((task) => task.stateType === STARTED_STATE).length;
  const dueSoon = tasks.filter(
    (task) => task.dueDay !== null && !CLOSED_STATES.includes(task.stateType ?? '') && daysBetween(today, task.dueDay) <= DUE_SOON_DAYS,
  ).length;

  const meetingPressure = meetings
    ? pressureOf(
        meetings.minutes >= HEAVY_MEETING_MINUTES || meetings.count >= HEAVY_MEETING_COUNT,
        meetings.minutes >= MODERATE_MEETING_MINUTES || meetings.count >= MODERATE_MEETING_COUNT,
      )
    : 0;
  const taskPressure = pressureOf(
    started >= HEAVY_STARTED_TASKS || dueSoon >= HEAVY_DUE_SOON_TASKS,
    started >= MODERATE_STARTED_TASKS || dueSoon >= MODERATE_DUE_SOON_TASKS,
  );
  const pressure = meetingPressure + taskPressure;
  const level = pressure >= HIGH_LOAD_PRESSURE ? 'alta' : pressure >= MODERATE_PRESSURE ? 'media' : 'baja';
  const period = taskPressure > meetingPressure ? 'esta semana' : 'hoy';

  return {
    level,
    statement: `Carga ${level} ${period}`,
    basis: [...(meetings?.sources ?? []), ...(tasks.length > 0 ? ['linear'] : [])],
    visibility,
  };
}

const sameTopic = (left: string, right: string) => left.toLocaleLowerCase('es') === right.toLocaleLowerCase('es');

function checkinBlocker(checkins: Checkin[], today: string): Blocker | null {
  const latest = checkins[0];
  if (!latest || latest.blocker === null || daysBetween(latest.day, today) > CHECKIN_BLOCKER_MAX_AGE_DAYS) return null;
  const topic = latest.blocker;
  let first = latest;
  for (const checkin of checkins.slice(1)) {
    if (checkin.blocker === null || !sameTopic(checkin.blocker, topic)) break;
    first = checkin;
  }
  return {
    topic,
    since: new Date(first.at).toISOString(),
    statement: `Bloqueo en «${topic}» ${elapsedText(daysBetween(first.day, today))}`,
    source: 'checkin',
    visibility: 'preguntar',
  };
}

function staleTaskBlockers(tasks: Task[], now: Date, today: string, timeZone: string): Blocker[] {
  return tasks
    .filter((task) => task.stateType === STARTED_STATE && now.getTime() - task.updatedAt >= STALE_TASK_DAYS * DAY_MS)
    .map((task) => ({
      topic: task.title,
      since: new Date(task.updatedAt).toISOString(),
      statement: `Sin avances en «${task.title}» ${elapsedText(daysBetween(dayKeyOf(new Date(task.updatedAt), timeZone), today))}`,
      source: 'linear' as const,
      visibility: 'siempre' as const,
    }));
}

const shortRepoName = (repo: string) => repo.slice(repo.lastIndexOf('/') + 1);

const rankedKeys = (counts: Map<string, number>, minimum: number, limit: number) =>
  [...counts.entries()]
    .filter(([, count]) => count >= minimum)
    .sort(([leftKey, leftCount], [rightKey, rightCount]) => rightCount - leftCount || leftKey.localeCompare(rightKey))
    .slice(0, limit)
    .map(([key]) => key);

function deriveExpertise(events: StoredEvent[], tasks: Task[]): string[] {
  const repoActivity = new Map<string, number>();
  const titles = new Map<string, string>();

  for (const event of events) {
    if (event.source !== 'github') continue;
    const raw = rawOf(event);
    const repo = textOf(raw.repo);
    if (repo) repoActivity.set(shortRepoName(repo), (repoActivity.get(shortRepoName(repo)) ?? 0) + Math.max(1, numberOf(raw.commits) ?? 1));
    const title = event.type === 'pull_request' ? textOf(raw.title) : null;
    if (title) titles.set(textOf(raw.url) ?? title, title);
  }
  for (const task of tasks) titles.set(task.identifier, task.title);

  const titlesPerWord = new Map<string, number>();
  for (const title of titles.values()) {
    const words = new Set(title.toLocaleLowerCase('es').split(WORD_BOUNDARY));
    for (const word of words) {
      if (word.length < MIN_TOPIC_LENGTH || GRAMMATICAL_WORDS.has(word) || numberOf(word) !== null) continue;
      titlesPerWord.set(word, (titlesPerWord.get(word) ?? 0) + 1);
    }
  }

  return [...new Set([...rankedKeys(repoActivity, 1, MAX_REPOS), ...rankedKeys(titlesPerWord, MIN_TOPIC_TITLES, MAX_TOPICS)])];
}

function deriveFocus(events: StoredEvent[], tasks: Task[], now: Date): string[] {
  const started = tasks
    .filter((task) => task.stateType === STARTED_STATE)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_FOCUS_TASKS)
    .map((task) => `Trabaja en «${task.title}»`);

  const openPulls = new Map<string, { title: string; repo: string; at: number }>();
  const lastCommitByRepo = new Map<string, number>();
  const ordered = events.filter((event) => event.source === 'github').sort((left, right) => (instantOf(left.occurredAt) ?? 0) - (instantOf(right.occurredAt) ?? 0));
  for (const event of ordered) {
    const raw = rawOf(event);
    const repo = textOf(raw.repo);
    const at = instantOf(event.occurredAt);
    if (!repo || at === null) continue;
    if (event.type === 'commit' && now.getTime() - at <= RECENT_COMMIT_DAYS * DAY_MS) lastCommitByRepo.set(shortRepoName(repo), at);
    const title = event.type === 'pull_request' ? textOf(raw.title) : null;
    if (!title) continue;
    const key = textOf(raw.url) ?? `${repo}:${title}`;
    if (raw.action === 'opened' && now.getTime() - at <= RECENT_PULL_DAYS * DAY_MS) openPulls.set(key, { title, repo: shortRepoName(repo), at });
    if (raw.action === 'closed') openPulls.delete(key);
  }
  const pulls = [...openPulls.values()]
    .sort((left, right) => right.at - left.at)
    .slice(0, MAX_FOCUS_PULLS)
    .map((pull) => `Tiene abierto «${pull.title}» en ${pull.repo}`);
  const pullRepos = new Set([...openPulls.values()].map((pull) => pull.repo));
  const repos = [...lastCommitByRepo.entries()]
    .filter(([repo]) => !pullRepos.has(repo))
    .sort(([, left], [, right]) => right - left)
    .slice(0, MAX_FOCUS_REPOS)
    .map(([repo]) => `Hizo commits en ${repo} en los últimos días`);

  return [...started, ...pulls, ...repos];
}

export function deriveSignals(events: StoredEvent[], now: Date, options: SignalOptions = {}): Signals {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const today = dayKeyOf(now, timeZone);
  const checkins = checkinsUntil(events, today, timeZone);
  const tasks = latestTasks(events, timeZone);
  const reportedBlocker = checkinBlocker(checkins, today);
  const latestCheckin = checkins[0];
  const hasRecentCheckin = latestCheckin !== undefined && daysBetween(latestCheckin.day, today) <= CHECKIN_BLOCKER_MAX_AGE_DAYS;

  return {
    energy: deriveEnergy(nightsUntil(events, today, timeZone), checkins, today),
    load: deriveLoad(meetingsOn(events, today, timeZone), tasks, today),
    blockers: [...(reportedBlocker ? [reportedBlocker] : []), ...staleTaskBlockers(tasks, now, today, timeZone)],
    blockerBasis: [...(hasRecentCheckin ? ['checkin'] : []), ...(tasks.length > 0 ? ['linear'] : [])],
    expertise: deriveExpertise(events, tasks),
    focus: deriveFocus(events, tasks, now),
    visibility: { ...DEFAULT_VISIBILITY },
    asOf: now.toISOString(),
  };
}
