import type { EventDraft, JsonObject, PushConnector } from '../types.js';

const SECONDS_PER_HOUR = 3600;
const LONGEST_SINGLE_NIGHT_HOURS = 20;
const HOURS_IN_A_DAY = 24;

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

export const appleHealth: PushConnector = {
  id: 'apple_health',
  label: 'Apple Health',
  how: 'Atajo de iOS',
  kind: 'push',
  ingestSlug: 'health',
  toEvent,
};
