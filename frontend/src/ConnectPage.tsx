import { useCallback, useState, type ReactNode } from 'react';
import { AgentTab } from './AgentTab';
import { fetchPerson, fetchSignals, type PersonPage, type Signals } from './api';
import { SettingsTab } from './SettingsTab';
import { SourcesTab } from './SourcesTab';
import { TabBar } from './TabBar';
import { TABS, type TabId } from './tabs';
import { TeamSection } from './TeamSection';
import { TopBar } from './TopBar';
import { useHashTab } from './useHashTab';
import { usePolling } from './usePolling';
import { YouTab } from './YouTab';

export function ConnectPage({ token }: { token: string }) {
  const [page, setPage] = useState<PersonPage | null>(null);
  const [signals, setSignals] = useState<Signals | null>(null);
  const { tab, select } = useHashTab();

  const load = useCallback(async () => {
    const [person, derived] = await Promise.all([fetchPerson(token), fetchSignals(token)]);
    setPage(person);
    setSignals(derived.signals);
  }, [token]);
  const { error, refresh } = usePolling(load);

  if (!page) {
    return (
      <div className="app-column rd-panel">
        <TopBar token={token} />
        <main className="app-tab">{error ? <h1 className="rd-title">{error}</h1> : <p className="rd-note">Cargando…</p>}</main>
      </div>
    );
  }

  const notice = new URLSearchParams(window.location.search).get('aviso');
  const reload = () => void refresh();

  const content: Record<TabId, ReactNode> = {
    fuentes: <SourcesTab token={token} page={page} notice={notice} onChange={reload} />,
    tu: <YouTab token={token} name={page.name} signals={signals} sources={page.sources} onSaved={reload} />,
    agente: <AgentTab token={token} />,
    equipo: <TeamSection token={token} />,
    ajustes: <SettingsTab token={token} />,
  };

  return (
    <div className="app-column rd-panel">
      <TopBar token={token} />
      <main>
        {error && (
          <p className="rd-note app-alert" role="alert">
            {error}
          </p>
        )}
        {TABS.map(({ id, name }) => (
          <section key={id} className="app-tab" aria-label={name} hidden={tab !== id}>
            {content[id]}
          </section>
        ))}
      </main>
      <TabBar active={tab} onSelect={select} />
    </div>
  );
}
