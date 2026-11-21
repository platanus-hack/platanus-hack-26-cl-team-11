import { useCallback, useState } from 'react';
import { fetchPerson, fetchSignals, type PersonPage, type Signals } from './api';
import { CheckinCard } from './CheckinCard';
import { formatWhen } from './format';
import { SignalsCard } from './SignalsCard';
import { SourceRow } from './SourceRow';
import { TeamSection } from './TeamSection';
import { usePolling } from './usePolling';

export function ConnectPage({ token }: { token: string }) {
  const [page, setPage] = useState<PersonPage | null>(null);
  const [signals, setSignals] = useState<Signals | null>(null);

  const load = useCallback(async () => {
    const [person, derived] = await Promise.all([fetchPerson(token), fetchSignals(token)]);
    setPage(person);
    setSignals(derived.signals);
  }, [token]);
  const { error, refresh } = usePolling(load);

  if (error && !page) return <h1 className="rd-hero">{error}</h1>;
  if (!page) return <p className="rd-note">Cargando…</p>;

  const notice = new URLSearchParams(window.location.search).get('aviso');
  const ingestUrl = `${page.publicBaseUrl ?? window.location.origin}${page.healthIngestPath}`;

  return (
    <>
      <h1 className="rd-hero">
        Hola, <span className="rd-gradient-text">{page.name}.</span>
      </h1>
      <p className="rd-note">Lo que conectes queda en tu memoria privada. Tú decides qué sale de ahí.</p>
      {notice && <p className="rd-note">{notice}</p>}
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}

      <section className="rd-card rd-glass">
        <span className="rd-label">Tus fuentes</span>
        {page.sources.map((source) => (
          <SourceRow key={source.id} token={token} source={source} onChange={() => void refresh()} />
        ))}
      </section>

      {signals && <SignalsCard token={token} signals={signals} />}

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

      <CheckinCard token={token} onSaved={() => void refresh()} />
      <TeamSection token={token} />
    </>
  );
}
