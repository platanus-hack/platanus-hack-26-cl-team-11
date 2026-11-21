import { useState } from 'react';
import type { PersonPage } from './api';
import { EventRow } from './EventRow';
import { countOf } from './format';
import { SectionHead } from './SectionHead';
import { SourceRow } from './SourceRow';
import { isConnected } from './sourceState';

interface SourcesTabProps {
  token: string;
  page: PersonPage;
  notice: string | null;
  onChange: () => void;
}

export function SourcesTab({ token, page, notice, onChange }: SourcesTabProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const ingestUrl = `${page.publicBaseUrl ?? window.location.origin}${page.healthIngestPath}`;
  const active = page.sources.filter(isConnected).length;
  const labels = new Map(page.sources.map((source) => [source.id, source.label]));

  return (
    <>
      <div className="app-block">
        <SectionHead first title="Fuentes" status={active > 0 ? countOf(active, 'activa', 'activas') : undefined} live />
        <p className="rd-note">Lo que conectes queda en tu memoria privada. Tú decides qué sale de ahí.</p>
        {notice && (
          <p className="rd-note" role="status">
            {notice}
          </p>
        )}
        <div className="rd-list">
          {page.sources.map((source) => (
            <SourceRow
              key={source.id}
              token={token}
              source={source}
              ingestUrl={ingestUrl}
              open={openId === source.id}
              onToggle={() => setOpenId((current) => (current === source.id ? null : source.id))}
              onChange={onChange}
            />
          ))}
        </div>
      </div>

      <div className="app-block">
        <SectionHead title="Últimos registros" />
        {page.events.length === 0 && <p className="rd-note">Todavía no llega nada.</p>}
        <div className="rd-list">
          {page.events.map((event) => (
            <EventRow key={event.id} event={event} sourceLabel={labels.get(event.source)} />
          ))}
        </div>
      </div>
    </>
  );
}
