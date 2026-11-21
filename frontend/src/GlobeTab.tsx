import { useCallback, useEffect, useRef, useState } from 'react';
import { MesaSection } from './MesaSection';

const DEMO_PATH = '/design/grafo/universo.html?embed&v=2';
const ROUND_SIGNAL = { montu: 'ronda' };

type Mode = 'demo' | 'mesa';

const MODES: ReadonlyArray<{ id: Mode; label: string; note: string }> = [
  { id: 'mesa', label: 'Mesa en vivo', note: 'La mesa pública, con sus personas y sus rondas reales.' },
  { id: 'demo', label: 'Demo', note: 'Una demo con datos de prueba.' },
];

export function GlobeTab({ token, active }: { token: string; active: boolean }) {
  const [opened, setOpened] = useState(active);
  const [mode, setMode] = useState<Mode>('demo');
  const frame = useRef<HTMLIFrameElement>(null);
  const livePath = `${DEMO_PATH}&vivo=${encodeURIComponent(`/api/people/${encodeURIComponent(token)}/mesa/live`)}`;

  useEffect(() => {
    if (active) setOpened(true);
  }, [active]);

  const showRound = useCallback((startedHere: boolean) => {
    setMode('mesa');
    frame.current?.contentWindow?.postMessage(ROUND_SIGNAL, window.location.origin);
    if (startedHere) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <>
      <div className="app-block">
        {opened && <iframe key={mode} ref={frame} className="app-universe" title="Globo de agentes conversando" src={mode === 'mesa' ? livePath : DEMO_PATH} />}
        <div className="app-globe-foot">
          <p className="rd-note">{MODES.find((option) => option.id === mode)?.note}</p>
          <div className="rd-seg" role="group" aria-label="Qué muestra el globo">
            {MODES.map((option) => (
              <button key={option.id} type="button" aria-pressed={mode === option.id} onClick={() => setMode(option.id)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {opened && <MesaSection token={token} onRound={showRound} />}
    </>
  );
}
