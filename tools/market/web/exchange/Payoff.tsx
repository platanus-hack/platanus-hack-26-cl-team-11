import type { Market, Kind, Spec } from './types';
import { bps, n, teamText } from './types';

const miniPaths: Record<Kind, string> = {
  binary: 'M2 21H15V5H30',
  manual: 'M9 8C9 1 24 1 24 8C24 13 16 13 16 18M16 21V24',
  call: 'M2 21H11L24 6H30',
  put: 'M2 6H8L21 21H30',
  future: 'M2 21H6L26 5H30',
  linear: 'M2 21L30 5',
  straddle: 'M2 5H5L16 21L27 5H30',
  range: 'M2 21H9V5H23V21H30',
  butterfly: 'M2 21H5L16 5L27 21H30',
  race: 'M2 21L12 13L18 16L30 5 M2 13L13 18L21 10L30 12',
};
export function KindIcon({ kind }: { kind: Kind }) {
  return (
    <svg className="ex-kind-icon" viewBox="0 0 32 26" aria-hidden="true">
      <path d={miniPaths[kind]} />
    </svg>
  );
}

function payout(m: Market & Spec, x: number): number {
  const k = m.strike ?? 0;
  const w = m.width ?? 1;
  let y: number;
  switch (m.kind) {
    case 'linear':
      y = x / 100;
      break;
    case 'straddle':
      y = (100 * Math.abs(x - k)) / w;
      break;
    case 'binary':
      y = x >= k ? 100 : 0;
      break;
    case 'range':
      y = x >= k && x <= m.upper! ? 100 : 0;
      break;
    case 'call':
      y = (100 * (x - k)) / w;
      break;
    case 'put':
      y = (100 * (k - x)) / w;
      break;
    case 'future':
      y = 50 + (50 * (x - k)) / w;
      break;
    case 'butterfly':
      y = 100 - (100 * Math.abs(x - k)) / w;
      break;
    default:
      y = 0;
  }
  return Math.max(0, Math.min(100, Math.round(y)));
}

export function Payoff({ market, spot }: { market: Market; spot?: number }) {
  if (market.kind === 'race' || market.kind === 'manual')
    return (
      <figure className="ex-figure">
        <figcaption className="rd-label">
          {market.kind === 'manual' ? 'Pago por cada contrato de Sí' : 'Pago al comprador según el rendimiento de ' + teamText(market.team)}
        </figcaption>
        <div className="ex-race">
          {(market.kind === 'manual'
            ? [['Sí', 100], ['No', 0]]
            : [['Pierde', 0], ['Empata', 50], ['Gana', 100]]
          ).map(([text, value]) => (
            <div key={text}>
              <span className="rd-note">{text}</span>
              <span className="rd-stat">
                {value}
                <small className="rd-stat__unit">fichas</small>
              </span>
            </div>
          ))}
        </div>
      </figure>
    );
  const k = market.strike ?? 5000;
  const w = market.width ?? Math.max(5, Math.round(k * 0.08));
  const end = market.upper ?? k;
  const spotBps = spot == null ? null : Math.round(spot * 10000);
  const low = market.kind === 'linear' ? 0 : Math.max(0, Math.floor(Math.min(k - w * 1.5, spotBps ?? k)));
  const high = market.kind === 'linear' ? 10000 : Math.min(10000, Math.ceil(Math.max(end + w * 1.5, spotBps ?? k)));
  const x = (v: number) => 36 + (432 * (v - low)) / (high - low);
  const y = (v: number) => 88 - v * 0.76;
  // Extra points on either side keep binary boundaries vertical.
  const values = [low, k - w, k - 0.001, k, k + w, end, end + 0.001, high]
    .filter((v) => v >= low && v <= high)
    .sort((a, b) => a - b);
  const points = values.map((v) => x(v) + ',' + y(payout(market, v))).join(' ');
  return (
    <figure className="ex-figure">
      <figcaption className="rd-label">Pago al comprador según el precio final de {teamText(market.team)}</figcaption>
      <svg className="ex-plot" viewBox="0 0 480 112" role="img" aria-label={market.description}>
        {[0, 50, 100].map((value) => (
          <g key={value}>
            <line className="ex-gridline" x1="36" x2="468" y1={y(value)} y2={y(value)} />
            <text x="26" y={y(value) + 4} textAnchor="end">
              {value}
            </text>
          </g>
        ))}
        <polyline className="ex-line" points={points} />
        {spotBps != null && (
          <g>
            <line className="ex-guide" x1={x(spotBps)} x2={x(spotBps)} y1="8" y2="88" />
            <circle className="ex-marker" cx={x(spotBps)} cy={y(payout(market, spotBps))} r="4" />
          </g>
        )}
        <text x="36" y="107">
          {bps(low)}
        </text>
        <text x="468" y="107" textAnchor="end">
          {bps(high)}
        </text>
      </svg>
      {spotBps != null && (
        <span className="rd-note">
          A un precio de {bps(spotBps)}, el comprador recibiría {n(payout(market, spotBps))} fichas por contrato.
        </span>
      )}
    </figure>
  );
}
