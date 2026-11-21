import type { Policy } from './policy/store.js';
import type { LevelSignal, Signals } from './signals.js';

export const MIN_GROUP_SIZE = 3;

type KnownLevel = 'baja' | 'media' | 'alta';

export type PulseSignal = { available: true; level: KnownLevel; contributors: number } | { available: false; reason: 'grupo_pequeno'; needed: number };
export type PulseCount = { available: true; total: number; contributors: number } | { available: false; reason: 'grupo_pequeno'; needed: number };

export interface Pulse {
  energy: PulseSignal;
  load: PulseSignal;
  blockersOpen: PulseCount;
}

export interface PulseMember {
  signals: Signals;
  policy: Policy;
}

const LEVEL_ORDER: readonly KnownLevel[] = ['baja', 'media', 'alta'];
const tooSmall = (needed: number) => ({ available: false as const, reason: 'grupo_pequeno' as const, needed });
const isKnown = (level: LevelSignal['level']): level is KnownLevel => level !== 'sin_datos';

function levelPulse(members: PulseMember[], key: 'energy' | 'load', minGroupSize: number): PulseSignal {
  const levels = members
    .filter((member) => member.policy.includeInPulse && member.policy[key] !== 'nunca')
    .map((member) => member.signals[key].level)
    .filter(isKnown)
    .sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b));
  const median = levels[Math.floor((levels.length - 1) / 2)];
  if (levels.length < minGroupSize || !median) return tooSmall(minGroupSize);
  return { available: true, level: median, contributors: levels.length };
}

function blockerPulse(members: PulseMember[], minGroupSize: number): PulseCount {
  const contributing = members.filter((member) => member.policy.includeInPulse && member.policy.blockers !== 'nunca');
  if (contributing.length < minGroupSize) return tooSmall(minGroupSize);
  return { available: true, total: contributing.reduce((sum, member) => sum + member.signals.blockers.length, 0), contributors: contributing.length };
}

export function teamPulse(members: PulseMember[], minGroupSize: number = MIN_GROUP_SIZE): Pulse {
  return {
    energy: levelPulse(members, 'energy', minGroupSize),
    load: levelPulse(members, 'load', minGroupSize),
    blockersOpen: blockerPulse(members, minGroupSize),
  };
}
