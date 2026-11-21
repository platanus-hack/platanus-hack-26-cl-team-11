import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import '../../design/luz/luz.js';
import '../../design/faces/caras.js';
import '../../design/montu/montu.js';
import '../../design/montu/entrada.js';

interface MountedMontu {
  replay(): void;
  destroy(): void;
}

declare global {
  interface Window {
    RondaMontu: { mount(canvas: HTMLCanvasElement): MountedMontu; introMs(): number };
    RondaEntrada: { mount(host: HTMLElement, options?: { still?: boolean }): MountedMontu; introMs(): number };
  }
}

type SplashStage = 'shown' | 'leaving' | 'gone';

const SEEN_KEY = 'montu-carga-vista';
const REPLAY_AFTER_MS = 20 * 60 * 1000;
const HOLD_MS = 700;
const FADE_MS = 500;
const SHORTEST_VISIT_MS = 900;

let pagesLoading = 0;
const watchers = new Set<() => void>();

function changeLoading(by: number) {
  pagesLoading += by;
  for (const notify of watchers) notify();
}

function watchLoading(notify: () => void) {
  watchers.add(notify);
  return () => {
    watchers.delete(notify);
  };
}

const isLoading = () => pagesLoading > 0;

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

function MontuCanvas({ className }: { className: string }) {
  const host = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = host.current;
    if (!canvas) return;
    const mounted = window.RondaMontu.mount(canvas);
    return () => mounted.destroy();
  }, []);

  return <canvas ref={host} className={className} aria-hidden="true" />;
}

function MontuEntrance({ run }: { run: number }) {
  const host = useRef<HTMLDivElement>(null);
  const mounted = useRef<MountedMontu | null>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    mounted.current = window.RondaEntrada.mount(node);
    return () => {
      mounted.current?.destroy();
      mounted.current = null;
    };
  }, []);

  useEffect(() => {
    if (run > 0) mounted.current?.replay();
  }, [run]);

  return <div ref={host} aria-hidden="true" />;
}

export function MontuLoading() {
  useEffect(() => {
    changeLoading(1);
    return () => changeLoading(-1);
  }, []);
  return null;
}

export function MontuInline() {
  return (
    <span className="app-loading" role="status" aria-label="Cargando">
      <MontuCanvas className="app-loading__figure" />
    </span>
  );
}

export function MontuSplash() {
  const loading = useSyncExternalStore(watchLoading, isLoading);
  const [stage, setStage] = useState<SplashStage>('shown');
  const visit = useRef({ since: Date.now(), atLeast: alreadySeen() ? SHORTEST_VISIT_MS : window.RondaEntrada.introMs() + HOLD_MS });

  useEffect(() => {
    if (stage === 'gone' || (stage === 'shown' && loading)) return;
    const wait = stage === 'shown' ? Math.max(0, visit.current.since + visit.current.atLeast - Date.now()) : FADE_MS;
    const timer = window.setTimeout(() => setStage(stage === 'shown' ? 'leaving' : 'gone'), wait);
    if (stage === 'leaving') rememberSeen();
    return () => window.clearTimeout(timer);
  }, [stage, loading]);

  if (stage === 'gone') return null;
  return (
    <div className={stage === 'leaving' ? 'rd-loader rd-loader--entrada rd-loader--out' : 'rd-loader rd-loader--entrada'} role="status" aria-label="Cargando Montu" onClick={() => (loading ? undefined : setStage('leaving'))}>
      <Aura />
      <MontuEntrance run={0} />
      <p className="rd-loader__name">Montu</p>
    </div>
  );
}

export function MontuStage() {
  const [run, setRun] = useState(0);
  return (
    <div className="rd-loader rd-loader--entrada" role="img" aria-label="El equipo de Montu te mira" onClick={() => setRun((count) => count + 1)}>
      <Aura />
      <MontuEntrance run={run} />
      <p key={`name-${run}`} className="rd-loader__name">
        Montu
      </p>
    </div>
  );
}
