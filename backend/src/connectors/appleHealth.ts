import type { EventDraft, JsonObject, PushBatch, PushConnector } from '../types.js';

const SECONDS_PER_HOUR = 3600;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const LONGEST_SINGLE_NIGHT_HOURS = 20;
const HOURS_IN_A_DAY = 24;
const HOURS_FROM_EVENING_TO_NEXT_DAY = 6;
const MAX_BATCH_LINES = 4000;
const MAX_BATCH_DAYS = 62;
const IGNORED_SAMPLE_LENGTH = 80;
const FIELD_SEPARATOR = '|';
const BATCH_FIELDS = ['sleep_samples', 'steps_by_day', 'resting_hr_by_day', 'hrv_by_day', 'active_energy_by_day', 'workouts'];
const LOCAL_MOMENT = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;
const ACCENTS = /[̀-ͯ]/g;
const AWAKE_LABELS = ['awake', 'despiert'];
const IN_BED_LABELS = ['in bed', 'inbed', 'en cama', 'en la cama'];

type Span = [number, number];
type SleepKind = 'asleep' | 'inBed' | 'awake';

interface DayRecord {
  asleep: Span[];
  inBed: Span[];
  steps: number[];
  restingHeartRate: number[];
  heartRateVariability: number[];
  activeEnergy: number[];
  workoutMinutes: number[];
}

const toNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

function reportedSleepHours(payload: JsonObject): number | null {
  const seconds = toNumber(payload.sleep_seconds);
  if (seconds !== null) return seconds / SECONDS_PER_HOUR;
  const reported = toNumber(payload.sleep_hours);
  if (reported === null) return null;
  return reported > HOURS_IN_A_DAY ? reported / SECONDS_PER_HOUR : reported;
}

function toEvent(payload: JsonObject, receivedAt: string = new Date().toISOString()): EventDraft {
  const reportedHours = reportedSleepHours(payload);
  const spansSeveralNights = reportedHours !== null && reportedHours > LONGEST_SINGLE_NIGHT_HOURS;
  const sleepHours = reportedHours === null || spansSeveralNights || reportedHours <= 0 ? null : reportedHours;
  const restingHeartRate = toNumber(payload.resting_hr);
  const steps = toNumber(payload.steps);

  const parts: string[] = [];
  if (sleepHours !== null) parts.push(`sueño ${sleepHours.toFixed(1)} h`);
  if (spansSeveralNights) parts.push(`sueño de varias noches sumado (${reportedHours.toFixed(1)} h), no se usa`);
  if (restingHeartRate !== null) parts.push(`pulso en reposo ${Math.round(restingHeartRate)} lpm`);
  if (steps !== null) parts.push(`${Math.round(steps)} pasos`);

  return {
    source: 'apple_health',
    type: 'salud_diaria',
    occurredAt: typeof payload.date === 'string' && payload.date ? payload.date : receivedAt,
    summary: parts.length ? parts.join(' · ') : 'datos de salud recibidos sin campos reconocidos',
    raw: reportedHours === null ? payload : { ...payload, sleep_hours: sleepHours, reported: payload },
  };
}

const emptyDay = (): DayRecord => ({ asleep: [], inBed: [], steps: [], restingHeartRate: [], heartRateVariability: [], activeEnergy: [], workoutMinutes: [] });

const linesOf = (value: unknown): string[] => {
  const lines = Array.isArray(value) ? value.map((item) => String(item ?? '')) : typeof value === 'string' ? value.split(/\r?\n/) : [];
  return lines.map((line) => line.trim()).filter(Boolean);
};

const fieldsOf = (line: string) => line.split(FIELD_SEPARATOR).map((field) => field.trim());
const dayKeyOf = (moment: number) => new Date(moment).toISOString().slice(0, 10);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const meanOf = (values: number[]) => (values.length ? sum(values) / values.length : null);
const rounded = (value: number, digits: number) => Number(value.toFixed(digits));
const plain = (text: string) => text.normalize('NFD').replace(ACCENTS, '').toLowerCase();

const localMomentOf = (text: string | undefined): number | null => {
  const match = LOCAL_MOMENT.exec(text ?? '');
  if (!match) return null;
  const [, year, month, day, hour = '0', minute = '0'] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
};

const spanOf = (startText: string | undefined, endText: string | undefined): Span | null => {
  const localStart = localMomentOf(startText);
  const localEnd = localMomentOf(endText);
  if (localStart === null || localEnd === null) return null;
  const exactStart = Date.parse(startText ?? '');
  const exactEnd = Date.parse(endText ?? '');
  const exact = Number.isFinite(exactStart) && Number.isFinite(exactEnd);
  const start = exact ? exactStart : localStart;
  const end = exact ? exactEnd : localEnd;
  return end > start && end - start <= LONGEST_SINGLE_NIGHT_HOURS * MS_PER_HOUR ? [start, end] : null;
};

const sleepKindOf = (label: string | undefined): SleepKind => {
  const value = plain(label ?? '');
  if (AWAKE_LABELS.some((known) => value.includes(known))) return 'awake';
  if (IN_BED_LABELS.some((known) => value.includes(known))) return 'inBed';
  return 'asleep';
};

const hoursCovered = (spans: Span[]): number => {
  let total = 0;
  let coveredUntil = Number.NEGATIVE_INFINITY;
  for (const [start, end] of [...spans].sort((left, right) => left[0] - right[0])) {
    const from = Math.max(start, coveredUntil);
    if (end <= from) continue;
    total += end - from;
    coveredUntil = end;
  }
  return total / MS_PER_HOUR;
};

function dayEvent(day: string, record: DayRecord): EventDraft | null {
  const asleepHours = hoursCovered(record.asleep);
  const measuredHours = asleepHours > 0 ? asleepHours : hoursCovered(record.inBed);
  const sleepHours = measuredHours > 0 && measuredHours <= LONGEST_SINGLE_NIGHT_HOURS ? rounded(measuredHours, 2) : null;
  const restingHeartRate = meanOf(record.restingHeartRate);
  const heartRateVariability = meanOf(record.heartRateVariability);
  const steps = record.steps.length ? Math.round(sum(record.steps)) : null;
  const activeEnergy = record.activeEnergy.length ? Math.round(sum(record.activeEnergy)) : null;
  const workouts = record.workoutMinutes.length;
  const workoutMinutes = Math.round(sum(record.workoutMinutes));

  const parts: string[] = [];
  if (sleepHours !== null) parts.push(`sueño ${sleepHours.toFixed(1)} h`);
  if (restingHeartRate !== null) parts.push(`pulso en reposo ${Math.round(restingHeartRate)} lpm`);
  if (heartRateVariability !== null) parts.push(`variabilidad ${Math.round(heartRateVariability)} ms`);
  if (steps !== null) parts.push(`${steps} pasos`);
  if (activeEnergy !== null) parts.push(`${activeEnergy} kcal activas`);
  if (workouts > 0) parts.push(`${workouts === 1 ? '1 entrenamiento' : `${workouts} entrenamientos`} (${workoutMinutes} min)`);
  if (!parts.length) return null;

  const raw: JsonObject = { date: day, format: 2 };
  if (sleepHours !== null) {
    raw.sleep_hours = sleepHours;
    raw.sleep_basis = asleepHours > 0 ? 'dormido' : 'en_cama';
  }
  if (restingHeartRate !== null) raw.resting_hr = rounded(restingHeartRate, 1);
  if (heartRateVariability !== null) raw.hrv_ms = rounded(heartRateVariability, 1);
  if (steps !== null) raw.steps = steps;
  if (activeEnergy !== null) raw.active_energy_kcal = activeEnergy;
  if (workouts > 0) {
    raw.workouts = workouts;
    raw.workout_minutes = workoutMinutes;
  }

  return { source: 'apple_health', type: 'salud_diaria', occurredAt: day, summary: parts.join(' · '), raw, externalId: `dia:${day}` };
}

function toBatch(payload: JsonObject, receivedAt: string = new Date().toISOString()): PushBatch | null {
  if (!BATCH_FIELDS.some((field) => Object.hasOwn(payload, field))) return null;

  const days = new Map<string, DayRecord>();
  const recordOf = (moment: number): DayRecord => {
    const day = dayKeyOf(moment);
    const known = days.get(day);
    if (known) return known;
    const created = emptyDay();
    days.set(day, created);
    return created;
  };

  let remaining = MAX_BATCH_LINES;
  let ignored = 0;
  let ignoredSample: string | null = null;
  const read = (field: string, accept: (fields: string[]) => boolean) => {
    for (const line of linesOf(payload[field])) {
      if (remaining > 0 && accept(fieldsOf(line))) {
        remaining -= 1;
        continue;
      }
      ignored += 1;
      ignoredSample ??= line.slice(0, IGNORED_SAMPLE_LENGTH);
    }
  };

  const daily = (pick: (record: DayRecord) => number[]) => (fields: string[]) => {
    const moment = localMomentOf(fields[0]);
    const value = toNumber(fields[1]);
    if (moment === null || value === null || value < 0) return false;
    pick(recordOf(moment)).push(value);
    return true;
  };

  read('sleep_samples', ([startText, endText, label]) => {
    const span = spanOf(startText, endText);
    const localStart = localMomentOf(startText);
    if (!span || localStart === null) return false;
    const kind = sleepKindOf(label);
    if (kind === 'awake') return true;
    const record = recordOf(localStart + HOURS_FROM_EVENING_TO_NEXT_DAY * MS_PER_HOUR);
    (kind === 'inBed' ? record.inBed : record.asleep).push(span);
    return true;
  });
  read('steps_by_day', daily((record) => record.steps));
  read('resting_hr_by_day', daily((record) => record.restingHeartRate));
  read('hrv_by_day', daily((record) => record.heartRateVariability));
  read('active_energy_by_day', daily((record) => record.activeEnergy));
  read('workouts', ([startText, endText]) => {
    const span = spanOf(startText, endText);
    const localStart = localMomentOf(startText);
    if (!span || localStart === null) return false;
    recordOf(localStart).workoutMinutes.push((span[1] - span[0]) / MS_PER_MINUTE);
    return true;
  });

  const received = Date.parse(receivedAt);
  const today = Number.isFinite(received) ? received : Date.now();
  const earliest = dayKeyOf(today - MAX_BATCH_DAYS * MS_PER_DAY);
  const latest = dayKeyOf(today + MS_PER_DAY);
  const events = [...days.entries()]
    .filter(([day]) => day >= earliest && day <= latest)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, record]) => dayEvent(day, record))
    .filter((event): event is EventDraft => event !== null);

  return { events, ignored, ignoredSample };
}

export const appleHealth: PushConnector = {
  id: 'apple_health',
  label: 'Apple Health',
  how: 'Atajo de iOS',
  kind: 'push',
  ingestSlug: 'health',
  toEvent,
  toBatch,
};
