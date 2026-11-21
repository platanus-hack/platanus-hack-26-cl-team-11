import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { applyFaceLook } from './faceLook';
import { GlobeTab } from './GlobeTab';
import { HEALTH_RETURN_PARAM } from './HealthAddress';
import { fetchFaces, fetchOnboarding, fetchPerson, fetchSignals, type OnboardingStep, type OnboardingStepId, type PersonPage, type Signals, type Summary } from './api';
import { ONBOARDING_STEPS } from './OnboardingSection';
import { SettingsTab } from './SettingsTab';
import { AGENT } from './SourcesOrbit';
import { SourcesTab } from './SourcesTab';
import { TabBar } from './TabBar';
import { TABS, type TabId } from './tabs';
import { TeamSection } from './TeamSection';
import { TopBar } from './TopBar';
import { useHashTab } from './useHashTab';
import { savePerson } from './savedPerson';
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
  const name = page?.name;

  useEffect(() => {
    if (name) savePerson({ token, name });
  }, [token, name]);

  useEffect(() => {
    let alive = true;
    fetchFaces(token)
      .then(({ faces }) => {
        if (alive) for (const { name: person, face } of faces) applyFaceLook(person, face);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [token]);

  if (!page) {
    return (
      <div className="app-column rd-panel">
        <TopBar />
        <main className="app-tab">{error ? <h1 className="rd-title">{error}</h1> : <p className="rd-note">Cargando…</p>}</main>
      </div>
    );
  }

  const notice = new URLSearchParams(window.location.search).get('aviso');
  const reload = () => void refresh();
  const openStep = (step: OnboardingStepId) => {
    setFocusedSource(step === 'salud' ? HEALTH_SOURCE : step === 'agente' ? AGENT : null);
    select(ONBOARDING_STEPS[step].tab);
  };

  const content: Record<TabId, ReactNode> = {
    tu: <YouTab token={token} active={tab === 'tu'} name={page.name} signals={signals} summary={summary} />,
    equipo: <TeamSection token={token} />,
    globo: <GlobeTab token={token} active={tab === 'globo'} />,
    ajustes: (
      <SettingsTab
        token={token}
        name={page.name}
        login={page.login ?? null}
        firstSteps={firstSteps}
        onOpenStep={openStep}
        sources={<SourcesTab token={token} page={page} notice={notice} focusId={focusedSource} onChange={reload} />}
      />
    ),
  };

  return (
    <div className="app-column rd-panel">
      <TopBar signedIn={Boolean(page.login?.email)} />
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
      <TabBar active={tab} name={page.name} onSelect={select} />
    </div>
  );
}
