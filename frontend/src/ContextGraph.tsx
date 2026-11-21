import { formatAgo } from './ago';
import { Face } from './Face';
import type { HubLink, HubSource } from './hubApi';
import { SourceGlyph } from './SourceGlyph';

export const ME = 'me';

const ME_FACE = 'mati';

const WIDTH = 1000;
const HEIGHT = 720;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const RADIUS = { x: 370, y: 262 };
const LINK_PULL = 0.45;
const SPOKE_BEND = 0.06;

interface Point {
  x: number;
  y: number;
}

const placeOf = (index: number, count: number): Point => {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  return { x: CENTER.x + RADIUS.x * Math.cos(angle), y: CENTER.y + RADIUS.y * Math.sin(angle) };
};

const curve = (from: Point, control: Point, to: Point) => `M${from.x.toFixed(1)} ${from.y.toFixed(1)}Q${control.x.toFixed(1)} ${control.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;

const spokeControl = (from: Point): Point => {
  const mid = { x: (from.x + CENTER.x) / 2, y: (from.y + CENTER.y) / 2 };
  return { x: mid.x - (CENTER.y - from.y) * SPOKE_BEND, y: mid.y + (CENTER.x - from.x) * SPOKE_BEND };
};

const linkControl = (a: Point, b: Point): Point => {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return { x: mid.x + (CENTER.x - mid.x) * LINK_PULL, y: mid.y + (CENTER.y - mid.y) * LINK_PULL };
};

const CHIP_AT = 0.68;

const pointOn = (a: Point, control: Point, b: Point, t: number): Point => ({
  x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * control.x + t ** 2 * b.x,
  y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * control.y + t ** 2 * b.y,
});

const percent = (point: Point) => ({ left: `${(point.x / WIDTH) * 100}%`, top: `${(point.y / HEIGHT) * 100}%` });

interface Props {
  name: string;
  sources: HubSource[];
  links: HubLink[];
  selected: string;
  incoming: ReadonlySet<string>;
  now: number;
  onSelect: (id: string) => void;
}

export function ContextGraph({ name, sources, links, selected, incoming, now, onSelect }: Props) {
  const places = new Map(sources.map((source, index) => [source.id, placeOf(index, sources.length)]));
  const touches = (link: HubLink) => link.a === selected || link.b === selected;
  const neighbours = new Set(links.filter(touches).flatMap((link) => [link.a, link.b]));
  const focusing = selected !== ME;
  const connected = sources.filter((source) => source.connected);
  const latest = connected.map((source) => source.lastUpdate).filter((when): when is string => Boolean(when)).sort().at(-1);

  const spokeClass = (id: string) => (!focusing || id === selected ? 'rd-edge rd-edge--focus' : 'rd-edge rd-edge--dim');
  const linkClass = (link: HubLink) => (!focusing ? 'rd-edge' : touches(link) ? 'rd-edge rd-edge--focus' : 'rd-edge rd-edge--dim');
  const sourceClass = (source: HubSource) => {
    if (!source.connected) return 'rd-source rd-source--off';
    if (focusing && source.id !== selected && !neighbours.has(source.id)) return 'rd-source rd-source--dim';
    return 'rd-source';
  };

  return (
    <div className="rd-graph app-map">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        {links.map((link) => {
          const a = places.get(link.a);
          const b = places.get(link.b);
          return a && b ? <path key={`${link.a}-${link.b}`} className={linkClass(link)} d={curve(a, linkControl(a, b), b)} /> : null;
        })}
        {connected.map((source) => {
          const from = places.get(source.id);
          if (!from) return null;
          const d = curve(from, spokeControl(from), CENTER);
          return (
            <g key={source.id}>
              <path className={spokeClass(source.id)} d={d} />
              {incoming.has(source.id) && <path className="rd-edge--incoming" d={d} />}
            </g>
          );
        })}
      </svg>

      {focusing &&
        links.filter(touches).map((link) => {
          const from = places.get(selected);
          const to = places.get(link.a === selected ? link.b : link.a);
          const topic = link.topics[0];
          return from && to && topic ? (
            <span key={`chip-${link.a}-${link.b}`} className="rd-chip rd-glass" style={percent(pointOn(from, linkControl(from, to), to, CHIP_AT))}>
              {topic.label}
            </span>
          ) : null;
        })}

      <button type="button" className="rd-source app-me" style={percent(CENTER)} aria-pressed={selected === ME} onClick={() => onSelect(ME)}>
        <Face name={ME_FACE} size="node" />
        <span className="rd-source__name">{name}</span>
        <span className="rd-source__when">{latest ? formatAgo(latest, now) : 'Sin fuentes'}</span>
      </button>

      {sources.map((source) => {
        const place = places.get(source.id);
        return place ? (
          <button key={source.id} type="button" className={sourceClass(source)} style={percent(place)} aria-pressed={selected === source.id} onClick={() => onSelect(source.id)}>
            <span className="rd-source__disc rd-glass">
              <SourceGlyph id={source.id} />
            </span>
            <span className="rd-source__name">{source.label}</span>
            <span className="rd-source__when">{incoming.has(source.id) ? 'Ahora' : source.lastUpdate ? formatAgo(source.lastUpdate, now) : source.connected ? 'Sin datos' : 'Sin conectar'}</span>
          </button>
        ) : null;
      })}
    </div>
  );
}
