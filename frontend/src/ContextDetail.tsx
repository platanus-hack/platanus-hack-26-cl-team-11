import { formatAgo } from './ago';
import { countOf } from './format';
import type { ContextMap, HubItem, HubSource } from './hubApi';
import { ME } from './ContextGraph';

const RECENT = 5;

interface Props {
  map: ContextMap;
  selected: string;
  now: number;
  busy: boolean;
  onSelect: (id: string) => void;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}

function ItemRows({ items, now, labelOf }: { items: HubItem[]; now: number; labelOf?: (source: string) => string }) {
  if (!items.length) return <p className="rd-note">Todavía no llega nada.</p>;
  return (
    <>
      {items.map((item) => (
        <div className="rd-row" key={item.id}>
          <div className="app-text">
            <span className="app-wrap">{item.summary}</span>
            <span className="rd-note">{[labelOf?.(item.source), formatAgo(item.occurredAt, now)].filter(Boolean).join(' · ')}</span>
          </div>
        </div>
      ))}
    </>
  );
}

function Overview({ map, now }: { map: ContextMap; now: number }) {
  const connected = map.sources.filter((source) => source.connected);
  const total = connected.reduce((sum, source) => sum + source.total, 0);
  const labelOf = (id: string) => map.sources.find((source) => source.id === id)?.label ?? id;
  const recent = connected
    .flatMap((source) => source.items)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, RECENT);

  return (
    <section className="rd-card rd-glass">
      <span className="rd-label">Tu contexto</span>
      <div className="app-stats">
        <div>
          <span className="rd-label">Fuentes</span>
          <span className="rd-stat">
            {connected.length}
            <span className="rd-stat__unit">de {map.sources.length}</span>
          </span>
        </div>
        <div>
          <span className="rd-label">Registros</span>
          <span className="rd-stat">{total.toLocaleString('es-CL')}</span>
        </div>
      </div>
      <span className="rd-label">Lo último</span>
      {connected.length ? <ItemRows items={recent} now={now} labelOf={labelOf} /> : <p className="rd-note">Conecta una fuente para empezar. Toca cualquier círculo.</p>}
    </section>
  );
}

function SourceDetail({ map, source, now, busy, onSelect, onConnect, onDisconnect }: Omit<Props, 'selected' | 'map'> & { map: ContextMap; source: HubSource }) {
  const related = map.links
    .filter((link) => link.a === source.id || link.b === source.id)
    .map((link) => ({ other: map.sources.find((item) => item.id === (link.a === source.id ? link.b : link.a)), topics: link.topics }))
    .filter((entry): entry is { other: HubSource; topics: typeof entry.topics } => Boolean(entry.other));

  return (
    <section className="rd-card rd-glass">
      <span className="rd-label">{source.category}</span>
      <h2 className="rd-title">{source.label}</h2>
      <p className="rd-note">{source.how}</p>

      {source.connected ? (
        <>
          <div className="app-stats">
            <div>
              <span className="rd-label">Registros</span>
              <span className="rd-stat">{source.total.toLocaleString('es-CL')}</span>
            </div>
            <div>
              <span className="rd-label">Último dato</span>
              <span className="app-title">{source.lastUpdate ? formatAgo(source.lastUpdate, now) : 'Sin datos'}</span>
              <span className="rd-note app-wrap">{source.account}</span>
            </div>
          </div>
          <span className="rd-label">Lo último</span>
          <ItemRows items={source.items} now={now} />
          <span className="rd-label">Conectado con</span>
          {related.length === 0 && <p className="rd-note">Todavía no comparte temas con otra fuente.</p>}
          {related.map(({ other, topics }) => (
            <button key={other.id} type="button" className="rd-row app-pick" onClick={() => onSelect(other.id)}>
              <span className="app-text">
                <span className="app-title">{other.label}</span>
                <span className="rd-note">{topics.map((topic) => topic.label).join(' · ')}</span>
              </span>
              <span className="rd-note">{countOf(topics.length, 'tema', 'temas')}</span>
            </button>
          ))}
          <div className="rd-actions">
            <button type="button" className="rd-button rd-button--quiet" disabled={busy} onClick={() => onDisconnect(source.id)}>
              Desconectar
            </button>
          </div>
        </>
      ) : (
        <div className="rd-actions">
          <button type="button" className="rd-button" disabled={busy} onClick={() => onConnect(source.id)}>
            Conectar {source.label}
          </button>
        </div>
      )}
    </section>
  );
}

export function ContextDetail(props: Props) {
  const source = props.map.sources.find((item) => item.id === props.selected);
  if (props.selected === ME || !source) return <Overview map={props.map} now={props.now} />;
  return <SourceDetail {...props} source={source} />;
}
