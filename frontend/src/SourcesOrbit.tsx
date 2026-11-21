import type { ReactNode } from 'react';
import { countOf } from './format';
import { Face } from './Face';

const WIDTH = 1000;
const HEIGHT = 720;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const RADIUS = { x: 372, y: 250 };
const UNIT = 0.7;
const GAP = 10;
const TILE = { half: 54, up: 38, down: 70 };
const HUB = { radius: 56, label: 54 };

interface Point {
  x: number;
  y: number;
}

const placeOf = (index: number, count: number): Point => {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  return { x: CENTER.x + RADIUS.x * Math.cos(angle), y: CENTER.y + RADIUS.y * Math.sin(angle) };
};

const spoke = (from: Point) => {
  const dx = (CENTER.x - from.x) * UNIT;
  const dy = (CENTER.y - from.y) * UNIT;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const leave = Math.min(TILE.half / Math.abs(ux || 1e-6), (uy > 0 ? TILE.down : TILE.up) / Math.abs(uy || 1e-6)) + GAP;
  const arrive = length - HUB.radius - GAP - (uy < 0 ? HUB.label * -uy : 0);
  if (arrive <= leave) return '';
  const at = (distance: number) => `${(from.x + (ux * distance) / UNIT).toFixed(1)} ${(from.y + (uy * distance) / UNIT).toFixed(1)}`;
  return `M${at(leave)}L${at(arrive)}`;
};

const percent = (point: Point) => ({ left: `${(point.x / WIDTH) * 100}%`, top: `${(point.y / HEIGHT) * 100}%` });

export const AGENT = 'agente';

export interface OrbitNode {
  id: string;
  label: string;
  status: string;
  on: boolean;
  icon: ReactNode;
}

interface SourcesOrbitProps {
  name: string;
  nodes: OrbitNode[];
  agents: number;
  selected: string | null;
  onSelect: (id: string) => void;
}

export function SourcesOrbit({ name, nodes, agents, selected, onSelect }: SourcesOrbitProps) {
  const placed = nodes.map((node, index) => ({ node, place: placeOf(index, nodes.length) }));
  const connected = nodes.filter((node) => node.on).length;

  return (
    <div className="rd-graph app-map">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        {placed.map(({ node, place }) => (
          <path key={node.id} className={node.on ? 'rd-edge rd-edge--focus' : 'rd-edge rd-edge--pending'} d={spoke(place)} />
        ))}
      </svg>

      <button type="button" className="rd-source rd-source--hub" style={percent(CENTER)} aria-pressed={selected === AGENT} onClick={() => onSelect(AGENT)}>
        <Face name={name} size="hub" state={selected === AGENT ? 'activa' : 'reposo'} />
        <span className="rd-source__name">
          Tu agente
          {agents > 0 && <span className="rd-dot" />}
        </span>
        <span className="rd-source__when">
          {agents > 0 ? `Conectado · ${connected} de ${countOf(nodes.length, 'fuente', 'fuentes')}` : 'Sin conectar'}
        </span>
      </button>

      {placed.map(({ node, place }) => (
        <button
          key={node.id}
          type="button"
          className={`rd-source${node.on ? '' : ' rd-source--idle'}`}
          style={percent(place)}
          aria-pressed={selected === node.id}
          onClick={() => onSelect(node.id)}
        >
          <span className="rd-source__app">
            {node.icon}
            {node.on && <span className="rd-dot" />}
          </span>
          <span className="rd-source__name">{node.label}</span>
          <span className="rd-source__when">{node.status}</span>
        </button>
      ))}
    </div>
  );
}
