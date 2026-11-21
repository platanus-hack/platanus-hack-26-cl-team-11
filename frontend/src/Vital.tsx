import type { CSSProperties } from 'react';
import { Glyph, type GlyphName } from './Glyph';
import { useCountUp } from './useCountUp';

export type VitalKind = 'energy' | 'load' | 'sleep' | 'move';

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
}

export function Vital({ kind, glyph, label, note, fill, order, text, amount = 0, decimals = 0, unit }: VitalProps) {
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
