import type { CSSProperties } from 'react';
import { Glyph, type GlyphName } from './Glyph';
import { useCountUp } from './useCountUp';

export type VitalKind = 'energy' | 'load' | 'sleep' | 'move';
export type TrendDirection = 'up' | 'down' | 'flat';

export interface VitalTrend {
  direction: TrendDirection;
  text: string;
}

const ARROW: Record<TrendDirection, string> = { up: 'M6 10V2M2.5 5.5 6 2l3.5 3.5', down: 'M6 2v8M2.5 6.5 6 10l3.5-3.5', flat: 'M2 6h8' };

interface VitalProps {
  kind: VitalKind;
  glyph: GlyphName;
  label: string;
  note: string;
  fill: number;
  order: number;
  text?: string;
  amount?: number;
  decimals?: number;
  unit?: string;
  trend?: VitalTrend;
}

export function Vital({ kind, glyph, label, note, fill, order, text, amount = 0, decimals = 0, unit, trend }: VitalProps) {
  const counted = useCountUp(amount);
  const style = { '--fill': Math.round(Math.min(100, Math.max(0, fill))), '--i': order } as CSSProperties;

  return (
    <div className={`rd-vital rd-vital--${kind} rd-glass`} style={style}>
      <div className="rd-vital__text">
        <span className="rd-label">{label}</span>
        <span className="rd-stat">
          {text ?? counted.toLocaleString('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
          {unit && <span className="rd-stat__unit">{unit}</span>}
        </span>
        <span className="rd-note">{note}</span>
        {trend && (
          <span className="rd-note rd-vital__trend">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d={ARROW[trend.direction]} />
            </svg>
            {trend.text}
          </span>
        )}
      </div>
      <div className="rd-vital__ring" aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <circle className="rd-vital__track" cx="32" cy="32" r="28" />
          <circle className="rd-vital__arc" cx="32" cy="32" r="28" pathLength={100} />
        </svg>
        <span className="rd-vital__glyph">
          <Glyph name={glyph} />
        </span>
      </div>
    </div>
  );
}
