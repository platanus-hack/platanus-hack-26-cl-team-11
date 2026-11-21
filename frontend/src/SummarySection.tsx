import type { LevelSignal, Signals, Summary, SummaryTrend } from './api';
import { Vital, type VitalTrend } from './Vital';

const LEVEL_LABEL: Record<LevelSignal['level'], string> = { baja: 'Baja', media: 'Media', alta: 'Alta', sin_datos: 'Sin datos' };
const LEVEL_FILL: Record<LevelSignal['level'], number> = { baja: 33, media: 66, alta: 100, sin_datos: 0 };
const FULL_NIGHT_HOURS = 8;
const WORKOUT_GOAL_MINUTES = 30;
const STEP_GOAL = 8000;
const UNIT_GAP = '\u00a0';

const hours = (value: number) => value.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const wholeNumber = (value: number) => Math.round(value).toLocaleString('es-CL');
const weekdayOf = (day: string) => new Intl.DateTimeFormat('es-CL', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00.000Z`));
const REFERENCE: Record<SummaryTrend['basis'], { sleep: string; steps: string }> = {
  promedio: { sleep: 'tu promedio', steps: 'tu promedio' },
  anterior: { sleep: 'la noche anterior', steps: 'ayer' },
};

function trendOf(value: number, trend: SummaryTrend | null, reference: string, amountOf: (difference: number) => string, isSame: (difference: number) => boolean): VitalTrend | undefined {
  if (!trend) return undefined;
  const difference = value - trend.baseline;
  if (isSame(difference)) return { direction: 'flat', text: `Igual que ${reference}` };
  return difference > 0 ? { direction: 'up', text: `${amountOf(difference)} más que ${reference}` } : { direction: 'down', text: `${amountOf(-difference)} menos que ${reference}` };
}

const sleepTrend = (value: number, trend: SummaryTrend | null) =>
  trendOf(value, trend, trend ? REFERENCE[trend.basis].sleep : '', (difference) => `${hours(difference)}${UNIT_GAP}h`, (difference) => Math.abs(difference) < 0.05);
const stepsTrend = (value: number, trend: SummaryTrend | null) =>
  trendOf(value, trend, trend ? REFERENCE[trend.basis].steps : '', wholeNumber, (difference) => Math.abs(difference) < 0.5);
const missingNightNote = (latest: Summary['sleep']['latest']) => (latest ? `Anoche. Tu última noche fue de ${hours(latest.hours)}${UNIT_GAP}h, el ${weekdayOf(latest.day)}.` : 'Anoche');

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
          note="Anoche"
          trend={sleepTrend(sleep.lastHours, sleep.trend)}
          fill={(sleep.lastHours / (sleep.usualHours ?? FULL_NIGHT_HOURS)) * 100}
          order={2}
        />
      ) : (
        <Vital kind="sleep" glyph="sleep" label="Sueño" text={sleep.latest ? 'Sin registro' : 'Sin datos'} note={sleep.latest ? missingNightNote(sleep.latest) : 'Conecta Apple Health'} fill={0} order={2} />
      )}
      {move.workoutMinutes !== null ? (
        <Vital kind="move" glyph="move" label="Deporte" amount={move.workoutMinutes} unit="min" note="Hoy" fill={(move.workoutMinutes / WORKOUT_GOAL_MINUTES) * 100} order={3} />
      ) : move.steps !== null ? (
        <Vital kind="move" glyph="move" label="Pasos" amount={move.steps} note="Hoy" trend={stepsTrend(move.steps, move.stepsTrend)} fill={(move.steps / STEP_GOAL) * 100} order={3} />
      ) : null}
    </div>
  );
}
