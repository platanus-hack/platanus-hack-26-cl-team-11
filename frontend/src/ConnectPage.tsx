import { useCallback, useEffect, useState } from 'react';
import { fetchPerson, type PersonPage } from './api';
import { formatWhen } from './format';
import { SourceRow } from './SourceRow';

const REFRESH_MS = 5000;

export function ConnectPage({ token }: { token: string }) {
  const [page, setPage] = useState<PersonPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetchPerson(token)
        .then((result) => {
          setPage(result);
          setError(null);
        })
        .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'No se pudo cargar.')),
    [token],
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

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
          <SourceRow key={source.id} token={token} source={source} onChange={() => void load()} />
        ))}
      </section>

      <section className="rd-card rd-glass">
        <span className="rd-label">Apple Health</span>
        <p className="rd-note">Tu Atajo envía un POST con JSON a esta dirección. Es personal: no la compartas.</p>
        <span className="rd-code">{ingestUrl}</span>
      </section>

      <section className="rd-card rd-glass">
        <span className="rd-label">Últimos registros</span>
        {page.events.length === 0 && <p className="rd-note">Todavía no llega nada.</p>}
        {page.events.map((event) => (
          <div className="rd-row" key={event.id}>
            <div className="app-text">
              <span className="app-title">{event.summary}</span>
              <span className="rd-note">{formatWhen(event.occurredAt)}</span>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
