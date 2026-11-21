import type { SignalKey, Signals, Visibility } from './api';
import type { GlyphName } from './Glyph';

const MAX_TOPICS_SHOWN = 4;

export interface SignalGroup {
  key: SignalKey;
  title: string;
  glyph: GlyphName;
}

export const SIGNAL_GROUPS: readonly SignalGroup[] = [
  { key: 'energy', title: 'Energía', glyph: 'energy' },
  { key: 'load', title: 'Carga', glyph: 'load' },
  { key: 'blockers', title: 'Bloqueos', glyph: 'blockers' },
  { key: 'expertise', title: 'Temas de trabajo', glyph: 'expertise' },
];

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  siempre: 'Se comparte',
  preguntar: 'Te pregunta antes',
  nunca: 'Privado',
};

const topicsText = (topics: string[]) => (topics.length > 0 ? `Sabe de ${topics.join(', ')}` : 'Sin temas de trabajo todavía');

export function statementsOf(signals: Signals, key: SignalKey, complete = false): string[] {
  if (key === 'energy') return [signals.energy.statement];
  if (key === 'load') return [signals.load.statement];
  if (key === 'blockers') return signals.blockers.length > 0 ? signals.blockers.map((blocker) => blocker.statement) : ['Sin bloqueos abiertos'];
  return [...signals.focus, topicsText(complete ? signals.expertise : signals.expertise.slice(0, MAX_TOPICS_SHOWN))];
}

export function basisOf(signals: Signals, key: SignalKey): string[] {
  if (key === 'energy') return signals.energy.basis;
  if (key === 'load') return signals.load.basis;
  if (key === 'blockers') return signals.blockerBasis;
  return [];
}
