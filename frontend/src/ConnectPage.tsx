import { useCallback, useState, type ReactNode } from 'react';
import { AgentTab } from './AgentTab';
import { HEALTH_RETURN_PARAM } from './HealthAddress';
import { fetchOnboarding, fetchPerson, fetchSignals, type OnboardingStep, type OnboardingStepId, type PersonPage, type Signals, type Summary } from './api';
import { ONBOARDING_STEPS } from './OnboardingSection';
import { SettingsTab } from './SettingsTab';
import { SourcesTab } from './SourcesTab';
import { TabBar } from './TabBar';
import { TABS, type TabId } from './tabs';
import { TeamSection } from './TeamSection';
import { TopBar } from './TopBar';
import { useHashTab } from './useHashTab';
import { usePolling } from './usePolling';
import { YouTab } from './YouTab';

const HEALTH_SOURCE = 'apple_health';
const RETIRED_STEP = 'checkin';

export function ConnectPage({ token }: { token: string }) {
  const [page, setPage] = useState<PersonPage | null>(null);
  const [signals, setSignals] = useState<Signals | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [firstSteps, setFirstSteps] = useState<OnboardingStep[]>([]);
  const [focusedSource, setFocusedSource] = useState<string | null>(() => (new URLSearchParams(window.location.search).has(HEALTH_RETURN_PARAM) ? HEALTH_SOURCE : null));
  const { tab, select } = useHashTab();

  const load = useCallback(async () => {
    const [person, derived, onboarding] = await Promise.all([fetchPerson(token), fetchSignals(token), fetchOnboarding(token).catch(() => null)]);
    setPage(person);
    setSignals(derived.signals);
    setSummary(derived.summary);
    setFirstSteps((onboarding?.steps ?? []).filter((step) => step.id !== RETIRED_STEP));
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
  const openStep = (step: OnboardingStepId) => {
    setFocusedSource(step === 'salud' ? HEALTH_SOURCE : null);
    select(ONBOARDING_STEPS[step].tab);
  };

  const content: Record<TabId, ReactNode> = {
    fuentes: <SourcesTab token={token} page={page} notice={notice} focusId={focusedSource} onChange={reload} />,
    tu: <YouTab token={token} name={page.name} signals={signals} summary={summary} />,
    agente: <AgentTab token={token} />,
    equipo: <TeamSection token={token} />,
    ajustes: <SettingsTab token={token} login={page.login ?? null} firstSteps={firstSteps} onOpenStep={openStep} />,
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
