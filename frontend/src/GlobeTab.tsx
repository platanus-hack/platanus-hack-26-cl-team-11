import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchGlobeMode } from './api';
import { GlobeChat } from './GlobeChat';

const DEMO_PATH = '/design/grafo/universo.html?embed&v=12';

const LIVE_PARAM = 'vivo';
const STAGE_PARAM = 'escenario';
const IDEA_PARAM = 'idea';

type Mode = 'demo' | 'mesa';

export function GlobeTab({ token, name, active }: { token: string; name: string; active: boolean }) {
  const [opened, setOpened] = useState(active);
  const [mode, setMode] = useState<Mode>('mesa');
  const frame = useRef<HTMLIFrameElement>(null);
  const params = new URLSearchParams(window.location.search);
  const stage = params.has(STAGE_PARAM);
  const ideas = params.getAll(IDEA_PARAM);
  const livePath = `${DEMO_PATH}&vivo=${encodeURIComponent(`/api/people/${encodeURIComponent(token)}/mesa/live`)}${stage ? '&limpio' : ''}`;

  useEffect(() => {
    if (active) setOpened(true);
  }, [active]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has(LIVE_PARAM)) return;
    fetchGlobeMode().then(
      (found) => setMode(found.mode),
      () => undefined,
    );
  }, []);

  const wakeGlobe = useCallback(() => frame.current?.contentWindow?.postMessage({ montu: 'ronda' }, window.location.origin), []);

  if (!opened) return null;

  if (stage) {
    return (
      <div className="app-stage">
        <GlobeChat token={token} name={name} stage ideas={ideas} onRound={wakeGlobe} />
        <iframe ref={frame} className="app-stage__globe" title="Globo de agentes" src={livePath} />
      </div>
    );
  }

  return (
    <div className="app-block">
      <div className="app-globe">
        <iframe ref={frame} key={mode} className="app-universe" title="Globo de agentes" src={mode === 'mesa' ? livePath : DEMO_PATH} />
        {mode === 'mesa' && <GlobeChat token={token} onRound={wakeGlobe} />}
      </div>
    </div>
  );
}
