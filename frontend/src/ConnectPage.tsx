import { useEffect, useState } from 'react';
import { fetchPerson, type PersonPage, type Source } from './api';

const REFRESH_MS = 5000;

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function sourceStatus(source: Source) {
  if (source.sync) return `${source.sync.total} ${source.sync.total === 1 ? 'registro' : 'registros'} · ${formatWhen(source.sync.last)}`;
  return source.available ? 'Esperando el primer envío' : 'Próximamente';
}

export function ConnectPage({ token }: { token: string }) {
  const [page, setPage] = useState<PersonPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetchPerson(token)
        .then((result) => {
          if (!active) return;
          setPage(result);
          setError(null);
        })
        .catch((failure: unknown) => {
          if (active) setError(failure instanceof Error ? failure.message : 'No se pudo cargar.');
        });
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token]);

  if (error && !page) return <h1 className="rd-hero">{error}</h1>;
  if (!page) return <p className="rd-note">Cargando…</p>;

  const ingestUrl = `${page.publicBaseUrl ?? window.location.origin}${page.healthIngestPath}`;

  return (
    <>
      <h1 className="rd-hero">
        Hola, <span className="rd-gradient-text">{page.name}.</span>
      </h1>
      <p className="rd-note">Lo que conectes queda en tu memoria privada. Tú decides qué sale de ahí.</p>

      <section className="rd-card rd-glass">
        <span className="rd-label">Tus fuentes</span>
        {page.sources.map((source) => (
          <div className={`app-row${source.available ? '' : ' app-off'}`} key={source.id}>
            <div className="app-row__text">
              <span className="app-row__title">{source.label}</span>
              <span className="rd-note">{source.how}</span>
            </div>
            <span className="rd-chip rd-glass">
              {source.sync && <span className="rd-dot" />}
              {sourceStatus(source)}
            </span>
          </div>
        ))}
      </section>

      <section className="rd-card rd-glass">
        <span className="rd-label">Apple Health</span>
        <p className="rd-note">Tu Atajo envía un POST con JSON a esta dirección. Es personal: no la compartas.</p>
        <span className="app-code">{ingestUrl}</span>
      </section>

      <section className="rd-card rd-glass">
        <span className="rd-label">Últimos registros</span>
        {page.events.length === 0 && <p className="rd-note">Todavía no llega nada.</p>}
        {page.events.map((event) => (
          <div className="app-row" key={event.id}>
            <div className="app-row__text">
              <span className="app-row__title">{event.summary}</span>
              <span className="rd-note">{formatWhen(event.receivedAt)}</span>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
