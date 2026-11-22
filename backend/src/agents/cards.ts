import { DAY_MS, DEFAULT_TIME_ZONE, dayKeyOf, instantOf, isFrom, MINUTE_MS, numberOf, rawOf, type LevelSignal, type Signals, type Visibility } from '../signals.js';
import type { StoredEvent } from '../types.js';

export type Availability = 'alta' | 'normal' | 'baja' | 'desconocida';

export interface Need {
  topic: string;
  statement: string;
}

export interface AgentCard {
  token: string;
  name: string;
  statements: string[];
  expertise: string[];
  availability: Availability;
  agenda?: string[];
  needs: Need[];
  pendingAsks: Need[];
}

export interface TopicDecisions {
  released: ReadonlySet<string>;
  denied: ReadonlySet<string>;
}

export interface RepoKnowledge {
  workingOn: string[];
  needs: Need[];
  expertise: string[];
}

export interface CardSource {
  token: string;
  name: string;
  signals: Signals;
  decisions: TopicDecisions;
  repo?: RepoKnowledge;
  recent?: string[];
  agenda?: string[];
}

export const MAX_NEEDS_PER_PERSON = 2;
const MAX_EXPERTISE = 12;

export const topicKeyOf = (topic: string) => topic.trim().toLocaleLowerCase('es');

const capacityStep = (signal: LevelSignal, visibility: Visibility, whenLow: number, whenHigh: number): number | null => {
  if (visibility === 'nunca' || signal.level === 'sin_datos') return null;
  return signal.level === 'baja' ? whenLow : signal.level === 'alta' ? whenHigh : 0;
};

function availabilityOf(signals: Signals): Availability {
  const steps = [
    capacityStep(signals.energy, signals.visibility.energy, -1, 1),
    capacityStep(signals.load, signals.visibility.load, 1, -1),
  ].filter((step): step is number => step !== null);
  if (steps.length === 0) return 'desconocida';
  const total = steps.reduce((sum, step) => sum + step, 0);
  return total < 0 ? 'baja' : total > 0 ? 'alta' : 'normal';
}

const MAX_AGENDA_BLOCKS = 6;
const FREE_DAY = 'libre todo el día';
const clockFormat = new Intl.DateTimeFormat('es-CL', { timeZone: DEFAULT_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function agendaOf(events: StoredEvent[], now: Date): string[] {
  const days = [
    { label: 'hoy', key: dayKeyOf(now) },
    { label: 'mañana', key: dayKeyOf(new Date(now.getTime() + DAY_MS)) },
  ];
  const meetings = events.filter((event) => isFrom(event, 'google_calendar', 'reunion') && rawOf(event).declined !== true);
  if (meetings.length === 0) return [];
  return days.flatMap(({ label, key }) => {
    const blocks = meetings
      .map((event) => {
        const raw = rawOf(event);
        const start = instantOf(raw.start) ?? instantOf(event.occurredAt);
        const minutes = numberOf(raw.durationMinutes);
        return start === null || minutes === null || dayKeyOf(new Date(start)) !== key ? null : { start, end: start + minutes * MINUTE_MS };
      })
      .filter((block): block is { start: number; end: number } => block !== null)
      .sort((left, right) => left.start - right.start)
      .slice(0, MAX_AGENDA_BLOCKS);
    if (blocks.length === 0) return [`${label}: ${FREE_DAY}`];
    return [`${label}: ocupado ${blocks.map((block) => `de ${clockFormat.format(new Date(block.start))} a ${clockFormat.format(new Date(block.end))}`).join(', ')}`];
  });
}

const mergeTopics = (first: string[], second: string[]): string[] => {
  const seen = new Set<string>();
  return [...first, ...second].filter((topic) => !seen.has(topicKeyOf(topic)) && Boolean(seen.add(topicKeyOf(topic)))).slice(0, MAX_EXPERTISE);
};

export function buildCard({ token, name, signals, decisions, repo, recent = [], agenda = [] }: CardSource): AgentCard {
  const statements: string[] = [...(repo?.workingOn ?? [])];
  if (signals.visibility.expertise !== 'nunca') statements.push(...recent);
  if (signals.visibility.expertise === 'siempre') statements.push(...signals.focus);
  if (signals.visibility.energy === 'siempre' && signals.energy.level !== 'sin_datos') statements.push(signals.energy.statement);
  if (signals.visibility.load === 'siempre' && signals.load.level !== 'sin_datos') statements.push(signals.load.statement);

  const needs: Need[] = [];
  const pendingAsks: Need[] = [];
  for (const blocker of signals.blockers) {
    const key = topicKeyOf(blocker.topic);
    if (blocker.visibility === 'nunca' || decisions.denied.has(key)) continue;
    const need = { topic: blocker.topic, statement: blocker.statement };
    if (blocker.visibility === 'siempre' || decisions.released.has(key)) needs.push(need);
    else pendingAsks.push(need);
  }
  for (const need of repo?.needs ?? []) {
    const key = topicKeyOf(need.topic);
    if (!decisions.denied.has(key) && !needs.some((known) => topicKeyOf(known.topic) === key)) needs.push(need);
  }

  const openNeeds = needs.slice(0, MAX_NEEDS_PER_PERSON);
  return {
    token,
    name,
    statements: [...statements, ...openNeeds.map((need) => need.statement)],
    expertise: mergeTopics(signals.visibility.expertise === 'siempre' ? signals.expertise : [], repo?.expertise ?? []),
    availability: availabilityOf(signals),
    agenda: signals.visibility.load === 'siempre' ? agenda : [],
    needs: openNeeds,
    pendingAsks,
  };
}
