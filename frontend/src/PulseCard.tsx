import { useCallback, useState } from 'react';
import { fetchPulse, type Pulse, type PulseCount, type PulseLevel, type PulseSignal } from './api';
import { countOf } from './format';
import { PulseStat } from './PulseStat';
import { usePolling } from './usePolling';

const LEVEL_LABEL: Record<PulseLevel, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

const needsMore = (needed: number) => `Todavía no se muestra: tienen que aportar al menos ${countOf(needed, 'persona', 'personas')} además de ti.`;
const contributorsText = (contributors: number) => `Entre ${countOf(contributors, 'persona', 'personas')}`;

const levelStat = (signal: PulseSignal) =>
  signal.available ? { value: LEVEL_LABEL[signal.level], note: contributorsText(signal.contributors) } : { value: null, note: needsMore(signal.needed) };

const blockersStat = (count: PulseCount) =>
  count.available
    ? { value: count.total.toLocaleString('es-CL'), unit: count.total === 1 ? 'abierto' : 'abiertos', note: contributorsText(count.contributors) }
    : { value: null, note: needsMore(count.needed) };

export function PulseCard({ token, teamId }: { token: string; teamId: string }) {
  const [pulse, setPulse] = useState<Pulse | null>(null);

  const load = useCallback(async () => setPulse((await fetchPulse(token, teamId)).pulse), [token, teamId]);
  const { error } = usePolling(load);

  return (
    <section className="rd-card rd-glass">
      <span className="rd-label">Pulso del equipo</span>
      {!pulse && !error && <p className="rd-note">Cargando…</p>}
      {pulse && (
        <div className="app-stats">
          <PulseStat label="Energía mediana" {...levelStat(pulse.energy)} />
          <PulseStat label="Carga mediana" {...levelStat(pulse.load)} />
          <PulseStat label="Bloqueos" {...blockersStat(pulse.blockersOpen)} />
        </div>
      )}
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
      <p className="rd-note">Son totales del resto del equipo, sin contarte a ti. Nunca muestra un nombre ni una respuesta individual.</p>
    </section>
  );
}
