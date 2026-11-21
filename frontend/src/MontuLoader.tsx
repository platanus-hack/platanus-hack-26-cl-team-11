import { useEffect, useRef, useState } from 'react';
import '../../design/montu/montu.js';

interface MountedMontu {
  replay(): void;
  destroy(): void;
}

declare global {
  interface Window {
    RondaMontu: { mount(canvas: HTMLCanvasElement): MountedMontu; introMs(): number };
  }
}

type SplashStage = 'shown' | 'leaving' | 'gone';

const SEEN_KEY = 'montu-carga-vista';
const REPLAY_AFTER_MS = 20 * 60 * 1000;
const HOLD_MS = 700;
const FADE_MS = 500;

function alreadySeen() {
  try {
    return Date.now() - Number(window.localStorage.getItem(SEEN_KEY)) < REPLAY_AFTER_MS;
  } catch {
    return false;
  }
}

function rememberSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    return;
  }
}

function Aura() {
  return (
    <div className="rd-aura" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

function MontuFigure() {
  const host = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = host.current;
    if (!canvas) return;
    const mounted = window.RondaMontu.mount(canvas);
    return () => mounted.destroy();
  }, []);

  return <canvas ref={host} className="rd-loader__figure" aria-hidden="true" />;
}

export function MontuSplash() {
  const [stage, setStage] = useState<SplashStage>(() => (alreadySeen() ? 'gone' : 'shown'));

  useEffect(() => {
    if (stage === 'gone') return;
    const wait = stage === 'shown' ? window.RondaMontu.introMs() + HOLD_MS : FADE_MS;
    const timer = window.setTimeout(() => setStage(stage === 'shown' ? 'leaving' : 'gone'), wait);
    if (stage === 'leaving') rememberSeen();
    return () => window.clearTimeout(timer);
  }, [stage]);

  if (stage === 'gone') return null;
  return (
    <div className={stage === 'leaving' ? 'rd-loader rd-loader--out' : 'rd-loader'} role="status" aria-label="Cargando Montu" onClick={() => setStage('leaving')}>
      <Aura />
      <MontuFigure />
      <p className="rd-loader__name">Montu</p>
    </div>
  );
}

export function MontuStage() {
  const [run, setRun] = useState(0);
  return (
    <div className="rd-loader" role="img" aria-label="Montu se arma como un grafo" onClick={() => setRun((count) => count + 1)}>
      <Aura />
      <MontuFigure key={`figure-${run}`} />
      <p key={`name-${run}`} className="rd-loader__name">
        Montu
      </p>
    </div>
  );
}
