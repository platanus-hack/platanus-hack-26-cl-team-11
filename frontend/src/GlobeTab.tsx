import { useEffect, useState } from 'react';
import { fetchGlobeMode } from './api';
import { GlobeChat } from './GlobeChat';

const DEMO_PATH = '/design/grafo/universo.html?embed&v=10';

type Mode = 'demo' | 'mesa';

export function GlobeTab({ token, active }: { token: string; active: boolean }) {
  const [opened, setOpened] = useState(active);
  const [mode, setMode] = useState<Mode>('mesa');
  const livePath = `${DEMO_PATH}&vivo=${encodeURIComponent(`/api/people/${encodeURIComponent(token)}/mesa/live`)}`;

  useEffect(() => {
    if (active) setOpened(true);
  }, [active]);

  useEffect(() => {
    fetchGlobeMode().then(
      (found) => setMode(found.mode),
      () => undefined,
    );
  }, []);

  if (!opened) return null;

  return (
    <div className="app-block">
      <div className="app-globe">
        <iframe key={mode} className="app-universe" title="Globo de agentes" src={mode === 'mesa' ? livePath : DEMO_PATH} />
        {mode === 'mesa' && <GlobeChat token={token} />}
      </div>
    </div>
  );
}
