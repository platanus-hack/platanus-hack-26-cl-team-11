import { useCallback, useEffect, useState } from 'react';
import type { PersonPage } from './api';
import { AgentConnect } from './AgentConnect';
import { fetchAssistants, type Assistant } from './roomApi';
import { SectionHead } from './SectionHead';
import { SourceRow } from './SourceRow';
import { AGENT, SourcesOrbit } from './SourcesOrbit';
import { usePolling } from './usePolling';

interface SourcesTabProps {
  token: string;
  page: PersonPage;
  notice: string | null;
  focusId?: string | null;
  onChange: () => void;
}

export function SourcesTab({ token, page, notice, focusId = null, onChange }: SourcesTabProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [assistants, setAssistants] = useState<Assistant[]>([]);

  const load = useCallback(async () => setAssistants((await fetchAssistants(token)).assistants), [token]);
  const { refresh } = usePolling(load);

  useEffect(() => {
    if (focusId) setOpenId(focusId);
  }, [focusId]);

  const ingestUrl = `${page.publicBaseUrl ?? window.location.origin}${page.healthIngestPath}`;
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));
  const open = page.sources.find((source) => source.id === openId);

  return (
    <div className="app-block">
      <SectionHead first title="Fuentes" />
      {notice && (
        <p className="rd-note" role="status">
          {notice}
        </p>
      )}
      <SourcesOrbit name={page.name} sources={page.sources} agents={assistants.length} selected={openId} onSelect={toggle} />
      {openId === AGENT && <AgentConnect token={token} assistants={assistants} onChange={() => void refresh()} />}
      {open && (
        <div className="rd-list">
          <SourceRow key={open.id} token={token} source={open} ingestUrl={ingestUrl} healthShortcut={page.healthShortcut} open solo onToggle={() => setOpenId(null)} onChange={onChange} />
        </div>
      )}
      {!open && openId !== AGENT && <p className="rd-note">Toca tu agente o una fuente para conectarla.</p>}
    </div>
  );
}
