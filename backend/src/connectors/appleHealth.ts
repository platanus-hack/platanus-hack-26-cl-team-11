import type { EventDraft, JsonObject, PushConnector } from '../types.js';

const toNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

function toEvent(payload: JsonObject, receivedAt: string = new Date().toISOString()): EventDraft {
  const sleepHours = toNumber(payload.sleep_hours);
  const restingHeartRate = toNumber(payload.resting_hr);
  const steps = toNumber(payload.steps);

  const parts: string[] = [];
  if (sleepHours !== null) parts.push(`sueño ${sleepHours.toFixed(1)} h`);
  if (restingHeartRate !== null) parts.push(`pulso en reposo ${Math.round(restingHeartRate)} lpm`);
  if (steps !== null) parts.push(`${Math.round(steps)} pasos`);

  return {
    source: 'apple_health',
    type: 'salud_diaria',
    occurredAt: typeof payload.date === 'string' && payload.date ? payload.date : receivedAt,
    summary: parts.length ? parts.join(' · ') : 'datos de salud recibidos sin campos reconocidos',
    raw: payload,
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
