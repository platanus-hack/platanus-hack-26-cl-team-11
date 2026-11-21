import { useCallback, useEffect, useState } from 'react';
import type { PersonPage } from './api';
import { AgentConnect } from './AgentConnect';
import { Glyph } from './Glyph';
import { MoreSourcesPicker } from './MoreSourcesPicker';
import { readWanted, saveWanted } from './moreSources';
import { fetchAssistants, type Assistant } from './roomApi';
import { SectionHead } from './SectionHead';
import { SOURCE_APP_ICONS } from './sourceAppIcons';
import { SourceGlyph } from './SourceGlyph';
import { SourceRow } from './SourceRow';
import { AGENT, SourcesOrbit, type OrbitNode } from './SourcesOrbit';
import { isConnected } from './sourceState';
import { usePolling } from './usePolling';

const ADD = 'agregar';

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
  const [wanted, setWanted] = useState<string[]>(() => readWanted(token));

  const load = useCallback(async () => setAssistants((await fetchAssistants(token)).assistants), [token]);
  const { refresh } = usePolling(load);

  useEffect(() => {
    if (focusId) setOpenId(focusId);
  }, [focusId]);

  const ingestUrl = `${page.publicBaseUrl ?? window.location.origin}${page.healthIngestPath}`;
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));
  const toggleWanted = (id: string) => {
    const next = wanted.includes(id) ? wanted.filter((item) => item !== id) : [...wanted, id];
    setWanted(next);
    saveWanted(token, next);
  };

  const open = page.sources.find((source) => source.id === openId);

  const nodes: OrbitNode[] = page.sources.map((source) => {
    const icon = SOURCE_APP_ICONS[source.id];
    const on = isConnected(source);
    return { id: source.id, label: source.label, on, status: source.connect === 'soon' ? 'Próximamente' : on ? 'Conectada' : 'Sin conectar', icon: icon ? <img src={icon} alt="" /> : <SourceGlyph id={source.id} /> };
  });

  return (
    <div className="app-block">
      <SectionHead title="Fuentes" />
      {notice && (
        <p className="rd-note" role="status">
          {notice}
        </p>
      )}
      <SourcesOrbit name={page.name} nodes={nodes} agents={assistants.length} selected={openId} onSelect={toggle} />
      {openId === AGENT && <AgentConnect token={token} assistants={assistants} onChange={() => void refresh()} />}
      {open && (
        <div className="rd-list">
          <SourceRow key={open.id} token={token} source={open} ingestUrl={ingestUrl} healthShortcut={page.healthShortcut} open solo onToggle={() => setOpenId(null)} onChange={onChange} />
        </div>
      )}
      {openId === null && <p className="rd-note">Toca tu agente o una fuente para conectarla.</p>}
      <button type="button" className="rd-button rd-button--quiet rd-button--small app-more" aria-expanded={openId === ADD} onClick={() => toggle(ADD)}>
        <Glyph name="plus" />
        Otra integración
      </button>
      {openId === ADD && <MoreSourcesPicker wanted={wanted} onToggle={toggleWanted} />}
    </div>
  );
}
