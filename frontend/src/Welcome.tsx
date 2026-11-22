import { useCallback, useEffect, useRef, useState } from 'react';
import chatgpt from '../../design/sources/apps/chatgpt.png';
import claude from '../../design/sources/apps/claude.png';
import codex from '../../design/sources/apps/codex.png';
import { createPairing, fetchAssistants } from './roomApi';

type Step = 'cara' | 'agente';

const STEPS: Step[] = ['cara', 'agente'];
const AGENT_ICONS = [claude, codex, chatgpt];
const DONE_KEY = 'montu-bienvenida';
const WATCH_AGENT_MS = 2000;

export function welcomeSeen(token: string): boolean {
  try {
    return window.localStorage.getItem(DONE_KEY) === token;
  } catch {
    return false;
  }
}

function rememberWelcome(token: string) {
  try {
    window.localStorage.setItem(DONE_KEY, token);
  } catch {
    return;
  }
}

export function Welcome({ token, name, onDone }: { token: string; name: string; onDone: () => void }) {
  const scene = useRef<HTMLDivElement>(null);
  const mounted = useRef<ReturnType<typeof window.RondaEntrada.mount> | null>(null);
  const [step, setStep] = useState<Step>('cara');
  const [line, setLine] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const node = scene.current;
    if (!node) return;
    mounted.current = window.RondaEntrada.mount(node, { names: [name] });
    return () => {
      mounted.current?.destroy();
      mounted.current = null;
    };
  }, [name]);

  const finish = useCallback(() => {
    rememberWelcome(token);
    setLeaving(true);
    mounted.current?.leave?.();
  }, [token]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onDone, window.RondaEntrada.leaveMs() + 100);
    return () => window.clearTimeout(timer);
  }, [leaving, onDone]);

  useEffect(() => {
    if (step !== 'agente' || leaving) return;
    let alive = true;
    createPairing(token).then(
      (pairing) => {
        if (alive) setLine(`Lee ${window.location.origin}${pairing.path} y sigue las instrucciones.`);
      },
      () => undefined,
    );
    const watch = window.setInterval(() => {
      fetchAssistants(token).then(
        ({ assistants }) => {
          if (alive && assistants.length > 0) finish();
        },
        () => undefined,
      );
    }, WATCH_AGENT_MS);
    return () => {
      alive = false;
      window.clearInterval(watch);
    };
  }, [step, leaving, token, finish]);

  const copy = () => {
    if (line) void navigator.clipboard?.writeText(line).then(() => setCopied(true), () => undefined);
  };

  return (
    <div className={leaving ? 'rd-welcome rd-welcome--out' : 'rd-welcome'}>
      <div className="rd-aura" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div ref={scene} aria-hidden="true" />
      {step === 'cara' && (
        <div className="rd-welcome__step rd-welcome__step--first">
          <h1 className="rd-welcome__title">{name}</h1>
          <div className="rd-welcome__actions">
            <button className="rd-button rd-button--glass" type="button" onClick={() => setStep('agente')}>
              Seguir
            </button>
          </div>
        </div>
      )}
      {step === 'agente' && (
        <div className="rd-welcome__step">
          <div className="rd-welcome__agents" aria-hidden="true">
            {AGENT_ICONS.map((icon) => (
              <img key={icon} src={icon} alt="" />
            ))}
          </div>
          <h1 className="rd-welcome__title">Conecta tu agente</h1>
          <div className="rd-welcome__actions">
            <button className="rd-button rd-button--glass" type="button" disabled={!line} onClick={copy}>
              {copied ? 'Pégalo en tu agente' : 'Copiar el link'}
            </button>
            <button className="rd-welcome__later" type="button" onClick={finish}>
              Después
            </button>
          </div>
        </div>
      )}
      <div className="rd-welcome__dots" aria-hidden="true">
        {STEPS.map((id) => (
          <i key={id} aria-current={id === step ? 'step' : undefined} />
        ))}
      </div>
    </div>
  );
}
