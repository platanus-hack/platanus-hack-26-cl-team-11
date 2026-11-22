import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import '../../design/luz/luz.js';
import '../../design/faces/caras.js';
import '../../design/montu/montu.js';
import '../../design/montu/entrada.js';
import googleLogo from '../../design/logo/google-g.svg';
import { GOOGLE_LOGIN_PATH } from './api';

interface MountedMontu {
  replay(): void;
  destroy(): void;
  leave?(): void;
}

declare global {
  interface Window {
    RondaMontu: { mount(canvas: HTMLCanvasElement): MountedMontu; introMs(): number };
    RondaEntrada: { mount(host: HTMLElement, options?: { still?: boolean }): MountedMontu; introMs(): number; leaveMs(): number };
  }
}

type SplashStage = 'shown' | 'leaving' | 'gone';

const SEEN_KEY = 'montu-carga-vista';
const REPLAY_AFTER_MS = 20 * 60 * 1000;
const HOLD_MS = 700;
const PAGE_ENTER_MS = 1100;
const SHORTEST_VISIT_MS = 400;

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

let signInScreens = 0;

function changeSignIn(by: number) {
  signInScreens += by;
  for (const notify of watchers) notify();
}

const isSigningIn = () => signInScreens > 0;

const NOTICE_PARAM = 'aviso';
const SIGN_IN_NOTE = 'Tu página se abre solo con tu cuenta.';

export function useSignInScreen() {
  useEffect(() => {
    changeSignIn(1);
    return () => changeSignIn(-1);
  }, []);
}

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

function MontuEntrance({ run, leaving = false }: { run: number; leaving?: boolean }) {
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

  useEffect(() => {
    if (leaving) mounted.current?.leave?.();
  }, [leaving]);

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
  const signingIn = useSyncExternalStore(watchLoading, isSigningIn);
  const [stage, setStage] = useState<SplashStage>('shown');
  const [entrance, setEntrance] = useState(0);
  const visit = useRef({ since: Date.now(), atLeast: alreadySeen() ? SHORTEST_VISIT_MS : window.RondaEntrada.introMs() + HOLD_MS });

  useEffect(() => {
    if (signingIn || stage === 'gone' || (stage === 'shown' && loading)) return;
    const wait = stage === 'shown' ? Math.max(0, visit.current.since + visit.current.atLeast - Date.now()) : window.RondaEntrada.leaveMs() + 100;
    const timer = window.setTimeout(() => setStage(stage === 'shown' ? 'leaving' : 'gone'), wait);
    if (stage === 'leaving') {
      rememberSeen();
      document.documentElement.dataset.montuEntrada = '';
    }
    return () => window.clearTimeout(timer);
  }, [stage, loading, signingIn]);

  useEffect(() => {
    if (!signingIn || stage === 'shown') return;
    setStage('shown');
    setEntrance((count) => count + 1);
  }, [signingIn, stage]);

  useEffect(() => {
    if (stage !== 'gone') return;
    const timer = window.setTimeout(() => delete document.documentElement.dataset.montuEntrada, PAGE_ENTER_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  if (stage === 'gone' && !signingIn) return null;
  const leaving = stage === 'leaving' && !signingIn;
  const notice = signingIn ? new URLSearchParams(window.location.search).get(NOTICE_PARAM) : null;
  return (
    <div
      className={leaving ? 'rd-loader rd-loader--entrada rd-loader--out' : 'rd-loader rd-loader--entrada'}
      role={signingIn ? undefined : 'status'}
      aria-label={signingIn ? undefined : 'Cargando Montu'}
      onClick={() => (loading || signingIn ? undefined : setStage('leaving'))}
    >
      <Aura />
      <MontuEntrance key={entrance} run={0} leaving={leaving} />
      <p className="rd-loader__name">Montu</p>
      {signingIn && (
        <div className="rd-loader__actions">
          <a className="rd-button" href={GOOGLE_LOGIN_PATH}>
            <img src={googleLogo} alt="" />
            Continuar con Google
          </a>
          <p className="rd-note">{notice ?? SIGN_IN_NOTE}</p>
        </div>
      )}
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
