import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchGlobeMode } from './api';
import { GlobeChat } from './GlobeChat';

const DEMO_PATH = '/design/grafo/universo.html?embed&v=15';

const LIVE_PARAM = 'vivo';
const STAGE_PARAM = 'escenario';
const IDEA_PARAM = 'idea';
const CHOICE_KEY = 'montu.globo';
const MODES: Array<{ mode: Mode; label: string }> = [
  { mode: 'mesa', label: 'En vivo' },
  { mode: 'demo', label: 'Ejemplo' },
];

type Mode = 'demo' | 'mesa';

function chosenMode(): Mode | null {
  try {
    const stored = window.localStorage.getItem(CHOICE_KEY);
    return stored === 'mesa' || stored === 'demo' ? stored : null;
  } catch {
    return null;
  }
}

export function GlobeTab({ token, name, active }: { token: string; name: string; active: boolean }) {
  const [opened, setOpened] = useState(active);
  const [mode, setMode] = useState<Mode>(() => chosenMode() ?? 'mesa');
  const frame = useRef<HTMLIFrameElement>(null);
  const params = new URLSearchParams(window.location.search);
  const stage = params.has(STAGE_PARAM);
  const ideas = params.getAll(IDEA_PARAM);
  const livePath = `${DEMO_PATH}&vivo=${encodeURIComponent(`/api/people/${encodeURIComponent(token)}/mesa/live`)}&limpio`;

  useEffect(() => {
    if (active) setOpened(true);
  }, [active]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has(LIVE_PARAM) || chosenMode()) return;
    fetchGlobeMode().then(
      (found) => setMode(found.mode),
      () => undefined,
    );
  }, []);

  const wakeGlobe = useCallback(() => frame.current?.contentWindow?.postMessage({ montu: 'ronda' }, window.location.origin), []);

  const choose = (next: Mode) => {
    setMode(next);
    try {
      window.localStorage.setItem(CHOICE_KEY, next);
    } catch {
      return;
    }
  };

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
        <div className="app-globe__mode">
          <div className="rd-seg" role="group" aria-label="Globo">
            {MODES.map((option) => (
              <button key={option.mode} type="button" aria-pressed={mode === option.mode} onClick={() => choose(option.mode)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {mode === 'mesa' ? (
          <div className="app-stage app-stage--inline">
            <GlobeChat token={token} name={name} stage onRound={wakeGlobe} />
            <iframe ref={frame} className="app-stage__globe" title="Globo de agentes" src={livePath} />
          </div>
        ) : (
          <iframe className="app-universe" title="Globo de agentes" src={DEMO_PATH} />
        )}
      </div>
    </div>
  );
}
