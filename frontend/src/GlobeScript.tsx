import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Face } from './Face';
import { Glyph } from './Glyph';

const MAX_MESSAGE_LENGTH = 600;

interface Decision {
  id: string;
  text: string;
  options: string[];
}

interface ScriptMessage {
  montu?: string;
  decision?: Decision;
}

export function GlobeScript({ name, frame }: { name: string; frame: RefObject<HTMLIFrameElement | null> }) {
  const [said, setSaid] = useState<string[]>([]);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [draft, setDraft] = useState('');
  const lines = useRef<HTMLDivElement>(null);

  const tell = (body: Record<string, string>) => frame.current?.contentWindow?.postMessage({ montu: 'guion', ...body }, window.location.origin);

  useEffect(() => {
    const hear = (event: MessageEvent) => {
      const data = event.data as ScriptMessage | null;
      if (event.origin !== window.location.origin || data?.montu !== 'guion-pide' || !data.decision) return;
      setDecision(data.decision);
    };
    window.addEventListener('message', hear);
    return () => window.removeEventListener('message', hear);
  }, []);

  useEffect(() => {
    const node = lines.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [said.length, decision]);

  const choose = (position: number) => {
    if (!decision) return;
    tell({ elige: decision.id, opcion: String(position) });
    setDecision(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setSaid((before) => [...before, text]);
    setDecision(null);
    setDraft('');
    tell({ dice: text });
  };

  return (
    <aside className="app-stage__agent rd-glass" aria-label="Tu agente">
      <div className="app-stage__head">
        <Face name={name} size="chat" state="reposo" />
        <span className="app-stage__title">Tu agente</span>
      </div>
      <div className="app-stage__lines" ref={lines} aria-live="polite">
        {said.map((text, position) => (
          <div key={position} className="app-stage__line app-stage__line--mine">
            <div className="rd-bubble">{text}</div>
          </div>
        ))}
        {decision && (
          <div className="rd-decision app-stage__decision">
            <div className="rd-decision__body">
              <p className="app-stage__text">{decision.text}</p>
              <div className="rd-actions app-options">
                {decision.options.map((label, position) => (
                  <button key={label} type="button" className={`rd-button${position === 0 ? '' : ' rd-button--quiet'}`} onClick={() => choose(position)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <form className="rd-composer" onSubmit={submit}>
        <input
          className="rd-composer__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || draft.trim() || !decision) return;
            event.preventDefault();
            choose(0);
          }}
          placeholder="Escríbele a tu agente" aria-label="Mensaje para tu agente" maxLength={MAX_MESSAGE_LENGTH} autoComplete="off" />
        <button className="rd-composer__send" type="submit" aria-label="Enviar" disabled={!draft.trim()}>
          <Glyph name="send" />
        </button>
      </form>
    </aside>
  );
}
