import type { LevelSignal, Signals, Summary } from './api';
import { Vital } from './Vital';

const LEVEL_LABEL: Record<LevelSignal['level'], string> = { baja: 'Baja', media: 'Media', alta: 'Alta', sin_datos: 'Sin datos' };
const LEVEL_FILL: Record<LevelSignal['level'], number> = { baja: 33, media: 66, alta: 100, sin_datos: 0 };
const FULL_NIGHT_HOURS = 8;
const WORKOUT_GOAL_MINUTES = 30;
const STEP_GOAL = 8000;

const hours = (value: number) => value.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const periodOf = (signal: LevelSignal) => (signal.level === 'sin_datos' ? 'Conecta una fuente' : signal.statement.endsWith('semana') ? 'Esta semana' : 'Hoy');

export function SummarySection({ signals, summary }: { signals: Signals; summary: Summary }) {
  const { sleep, move, meetings } = summary;
  const loadNote = meetings.length > 0 ? `${meetings.length === 1 ? '1 reunión' : `${meetings.length} reuniones`} hoy` : periodOf(signals.load);

  return (
    <div className="rd-vitals">
      <Vital kind="energy" glyph="energy" label="Energía" text={LEVEL_LABEL[signals.energy.level]} note={periodOf(signals.energy)} fill={LEVEL_FILL[signals.energy.level]} order={0} />
      <Vital kind="load" glyph="load" label="Carga" text={LEVEL_LABEL[signals.load.level]} note={loadNote} fill={LEVEL_FILL[signals.load.level]} order={1} />
      {sleep.lastHours !== null ? (
        <Vital
          kind="sleep"
          glyph="sleep"
          label="Sueño"
          amount={sleep.lastHours}
          decimals={1}
          unit="h"
          note={sleep.usualHours !== null ? `Lo tuyo son ${hours(sleep.usualHours)} h` : 'Anoche'}
          fill={(sleep.lastHours / (sleep.usualHours ?? FULL_NIGHT_HOURS)) * 100}
          order={2}
        />
      ) : (
        <Vital kind="sleep" glyph="sleep" label="Sueño" text="Sin datos" note="Conecta Apple Health" fill={0} order={2} />
      )}
      {move.workoutMinutes !== null ? (
        <Vital kind="move" glyph="move" label="Deporte" amount={move.workoutMinutes} unit="min" note="Hoy" fill={(move.workoutMinutes / WORKOUT_GOAL_MINUTES) * 100} order={3} />
      ) : move.steps !== null ? (
        <Vital kind="move" glyph="move" label="Pasos" amount={move.steps} note="Hoy" fill={(move.steps / STEP_GOAL) * 100} order={3} />
      ) : null}
    </div>
  );
}
