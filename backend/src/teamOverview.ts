import type { Policy } from './policy/store.js';
import { MIN_GROUP_SIZE } from './pulse.js';
import type { Signals, SignalLevel } from './signals.js';
import type { Summary } from './summary.js';

type KnownLevel = Exclude<SignalLevel, 'sin_datos'>;

export interface OverviewInput {
  name: string;
  me: boolean;
  signals: Signals;
  summary: Summary;
  policy: Policy;
}

export interface OverviewMember {
  name: string;
  me: boolean;
  shares: boolean;
  energy: SignalLevel | null;
  sleepHours: number | null;
  steps: number | null;
  workoutMinutes: number | null;
}

export type TeamValue<Value> = { available: true; value: Value; contributors: number } | { available: false; needed: number };

export interface TeamOverview {
  members: OverviewMember[];
  energy: TeamValue<KnownLevel>;
  sleepHours: TeamValue<number>;
  steps: TeamValue<number>;
}

const LEVEL_ORDER: readonly KnownLevel[] = ['baja', 'media', 'alta'];

const isKnown = (level: SignalLevel): level is KnownLevel => level !== 'sin_datos';
const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;

function valueOf<Value>(values: Value[], combine: (values: Value[]) => Value, minGroupSize: number): TeamValue<Value> {
  return values.length >= minGroupSize ? { available: true, value: combine(values), contributors: values.length } : { available: false, needed: minGroupSize };
}

const isNumber = (value: number | null): value is number => value !== null;

export function teamOverview(inputs: OverviewInput[], minGroupSize: number = MIN_GROUP_SIZE): TeamOverview {
  const members = inputs.map((input): OverviewMember => {
    const shares = input.me || input.policy.energy === 'siempre';
    return {
      name: input.name,
      me: input.me,
      shares,
      energy: shares ? input.signals.energy.level : null,
      sleepHours: shares ? input.summary.sleep.lastHours : null,
      steps: shares ? input.summary.move.steps : null,
      workoutMinutes: shares ? input.summary.move.workoutMinutes : null,
    };
  });

  const counted = inputs.filter((input) => input.policy.includeInPulse && input.policy.energy !== 'nunca');
  const levels = counted.map((input) => input.signals.energy.level).filter(isKnown).sort((left, right) => LEVEL_ORDER.indexOf(left) - LEVEL_ORDER.indexOf(right));

  return {
    members,
    energy: valueOf(levels, (sorted) => sorted[Math.floor((sorted.length - 1) / 2)] ?? 'media', minGroupSize),
    sleepHours: valueOf(counted.map((input) => input.summary.sleep.lastHours).filter(isNumber), mean, minGroupSize),
    steps: valueOf(counted.map((input) => input.summary.move.steps).filter(isNumber), (values) => Math.round(values.reduce((total, value) => total + value, 0)), minGroupSize),
  };
}
