import { useCallback, useState } from 'react';
import { fetchPulse, type Pulse, type PulseCount, type PulseLevel, type PulseSignal } from './api';
import { countOf } from './format';
import { PulseStat } from './PulseStat';
import { SectionHead } from './SectionHead';
import { usePolling } from './usePolling';

const LEVEL_LABEL: Record<PulseLevel, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

const needsMore = (needed: number) => `Con al menos ${countOf(needed, 'persona', 'personas')} además de ti`;
const contributorsText = (contributors: number) => `Entre ${countOf(contributors, 'persona', 'personas')}`;

const levelStat = (signal: PulseSignal) =>
  signal.available ? { value: LEVEL_LABEL[signal.level], note: contributorsText(signal.contributors) } : { value: null, note: needsMore(signal.needed) };

const blockersStat = (count: PulseCount) =>
  count.available ? { value: count.total.toLocaleString('es-CL'), note: contributorsText(count.contributors) } : { value: null, note: needsMore(count.needed) };

export function PulseSection({ token, teamId }: { token: string; teamId: string }) {
  const [pulse, setPulse] = useState<Pulse | null>(null);

  const load = useCallback(async () => setPulse((await fetchPulse(token, teamId)).pulse), [token, teamId]);
  const { error } = usePolling(load);

  return (
    <div className="app-block">
      <SectionHead title="Pulso" />
      {!pulse && !error && <p className="rd-note">Cargando…</p>}
      {pulse && (
        <div className="rd-list">
          <PulseStat glyph="energy" label="Energía mediana" {...levelStat(pulse.energy)} />
          <PulseStat glyph="load" label="Carga mediana" {...levelStat(pulse.load)} />
          <PulseStat glyph="blockers" label="Bloqueos abiertos" {...blockersStat(pulse.blockersOpen)} />
        </div>
      )}
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
      <p className="rd-note">Son totales del resto del equipo, sin contarte a ti. Nunca muestra un nombre ni una respuesta individual.</p>
    </div>
  );
}
