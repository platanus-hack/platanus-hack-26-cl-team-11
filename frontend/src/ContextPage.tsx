import { useCallback, useEffect, useRef, useState } from 'react';
import { ContextDetail } from './ContextDetail';
import { ContextGraph, ME } from './ContextGraph';
import { formatAgo } from './ago';
import { messageOf } from './format';
import { connectMock, contextPath, disconnectMock, fetchContext, simulatePush, type ContextMap } from './hubApi';
import { useAction } from './useAction';
import { MontuLoading } from './MontuLoader';

const REFRESH_MS = 3000;
const SIMULATE_MS = 6000;
const INCOMING_MS = 3500;

export function ContextPage({ token }: { token: string }) {
  const [map, setMap] = useState<ContextMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(() => new URLSearchParams(window.location.search).get('fuente') ?? ME);
  const [incoming, setIncoming] = useState<ReadonlySet<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef<Map<string, string | null> | null>(null);
  const action = useAction();

  const load = useCallback(async () => {
    try {
      const next = await fetchContext(token);
      const previous = seen.current;
      const arrived = previous ? next.sources.filter((source) => source.lastUpdate && previous.has(source.id) && previous.get(source.id) !== source.lastUpdate && previous.get(source.id) !== null).map((source) => source.id) : [];
      seen.current = new Map(next.sources.map((source) => [source.id, source.lastUpdate]));
      if (arrived.length) {
        setIncoming((current) => new Set([...current, ...arrived]));
        window.setTimeout(() => setIncoming((current) => new Set([...current].filter((id) => !arrived.includes(id)))), INCOMING_MS);
      }
      setMap(next);
      setNow(Date.now());
      setError(null);
    } catch (failure) {
      setError(messageOf(failure, 'No se pudo cargar.'));
    }
  }, [token]);

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => void load(), REFRESH_MS);
    const simulate = window.setInterval(() => {
      if (document.visibilityState === 'visible') void simulatePush(token).then(load, () => undefined);
    }, SIMULATE_MS);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(simulate);
    };
  }, [load, token]);

  if (error && !map) return <h1 className="rd-hero">{error}</h1>;
  if (!map) return <MontuLoading />;

  const connect = (id: string) => action.run(async () => {
    await connectMock(token, id);
    seen.current?.set(id, null);
    setSelected(id);
    await load();
  });
  const disconnect = (id: string) => action.run(async () => {
    await disconnectMock(token, id);
    await load();
  });

  const pushUrl = `${window.location.origin}${contextPath(token)}/push`;
  const example = JSON.stringify({ source: 'claude', summary: 'Terminó el guion de la demo', topics: ['demo', 'pitch'] });

  return (
    <div className="rd-layout">
      <section className="rd-stack">
        <h1 className="rd-hero">
          Todo lo tuyo,
          <br />
          <span className="rd-gradient-text">en un solo lugar.</span>
        </h1>
        <p className="rd-note">Datos de prueba. Ninguna fuente se conecta de verdad todavía. Toca un círculo para ver qué tiene y con qué se cruza.</p>
        {(error || action.error) && (
          <p className="rd-note" role="alert">
            {error ?? action.error}
          </p>
        )}
        <ContextGraph name="Tú" sources={map.sources} links={map.links} selected={selected} incoming={incoming} now={now} onSelect={setSelected} />
      </section>

      <aside className="rd-stack">
        <ContextDetail map={map} selected={selected} now={now} busy={action.busy} onSelect={setSelected} onConnect={connect} onDisconnect={disconnect} />

        <section className="rd-card rd-glass">
          <span className="rd-label">Tus fuentes</span>
          {map.sources.map((source) => (
            <div className="rd-row" key={source.id}>
              <button type="button" className="app-text app-pick" onClick={() => setSelected(source.id)}>
                <span className="app-title">{source.label}</span>
                <span className="rd-note">{source.connected ? `Conectada · ${source.lastUpdate ? formatAgo(source.lastUpdate, now) : 'sin datos'}` : source.category}</span>
              </button>
              {!source.connected && (
                <button type="button" className="rd-button rd-button--quiet app-fit" disabled={action.busy} onClick={() => void connect(source.id)}>
                  Conectar
                </button>
              )}
            </div>
          ))}
        </section>

        <section className="rd-card rd-glass">
          <span className="rd-label">Para tus asistentes</span>
          <p className="rd-note">Claude, Codex o cualquier asistente deja aquí lo que sabe de ti con un POST. Es tu dirección personal: no la compartas.</p>
          <span className="rd-code">{pushUrl}</span>
          <span className="rd-code">{example}</span>
        </section>
      </aside>
    </div>
  );
}
