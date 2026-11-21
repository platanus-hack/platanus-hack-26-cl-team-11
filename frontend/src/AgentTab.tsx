import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { answerChat, fetchChat, sendChat, type ChatView } from './api';
import { Face } from './Face';
import { Glyph } from './Glyph';
import { RowButton } from './RowButton';
import { useAction } from './useAction';
import { usePolling } from './usePolling';
import { WhatsAppSection } from './WhatsAppSection';

const MAX_MESSAGE_LENGTH = 1000;
const IDEAS = ['¿Cómo viene mi día?', 'Tengo un bloqueo y necesito ayuda', '¿Quién de mi equipo sabe de pagos?'];

function statusOf(view: ChatView | null, writing: boolean) {
  if (writing) return 'Escribiendo';
  if (view && !view.configured) return 'Todavía no puede responder: al servidor le falta el modelo';
  return view?.whatsapp.linked ? 'Escríbele aquí o por WhatsApp' : 'Escríbele aquí';
}

export function AgentTab({ token, name, active }: { token: string; name: string; active: boolean }) {
  const [view, setView] = useState<ChatView | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const lines = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => setView(await fetchChat(token)), [token]);
  const { error: loadError } = usePolling(load);

  const count = view?.messages.length ?? 0;
  useEffect(() => {
    const node = lines.current;
    if (node && active) node.scrollTop = node.scrollHeight;
  }, [active, count, pending]);

  const say = (text: string) => {
    if (!text || busy) return;
    setDraft('');
    setPending(text);
    void run(async () => {
      try {
        setView(await sendChat(token, text));
      } finally {
        setPending(null);
      }
    });
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    say(draft.trim());
  }

  const empty = view?.messages.length === 0 && !pending;

  return (
    <div className="app-block">
      <div className="rd-thread rd-thread--chat rd-glass">
        <div className="rd-thread__head">
          <span className="rd-thread__faces">
            <Face name={name} size="chat" state={pending ? 'pensando' : 'reposo'} />
          </span>
          <span className="rd-thread__title">
            <span className="rd-thread__topic">Tu agente</span>
            <span className="rd-label">{statusOf(view, pending !== null)}</span>
          </span>
        </div>
        <div className="rd-thread__lines" ref={lines} aria-live="polite">
          {empty && <p className="rd-thread__hint">Te conoce por tus fuentes. Cuéntale cómo vienes o pregúntale algo a tu equipo.</p>}
          {view?.messages.map((message) => (
            <div key={message.key} className={`rd-thread__line${message.role === 'persona' ? ' rd-thread__line--mine' : ''}`}>
              <div className="rd-bubble">
                {message.text}
                {message.options.length > 0 && (
                  <div className="rd-actions app-options">
                    {message.options.map((option) => (
                      <RowButton key={option.id} label={option.label} disabled={busy} onClick={() => void run(async () => setView(await answerChat(token, option.id)))} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {pending && (
            <>
              <div className="rd-thread__line rd-thread__line--mine">
                <div className="rd-bubble">{pending}</div>
              </div>
              <div className="rd-thread__line">
                <span className="rd-bubble rd-bubble--typing" aria-label="Tu agente está escribiendo">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </>
          )}
        </div>
        {empty && (
          <div className="rd-thread__ideas">
            {IDEAS.map((idea) => (
              <button key={idea} type="button" className="rd-thread__idea" disabled={busy} onClick={() => say(idea)}>
                {idea}
              </button>
            ))}
          </div>
        )}
        <form className="rd-composer" onSubmit={submit}>
          <input className="rd-composer__input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escríbele a tu agente" aria-label="Mensaje para tu agente" maxLength={MAX_MESSAGE_LENGTH} autoComplete="off" />
          <button className="rd-composer__send" type="submit" aria-label="Enviar" disabled={busy || !draft.trim()}>
            <Glyph name="send" />
          </button>
        </form>
      </div>
      {(error ?? loadError) && (
        <p className="rd-note" role="alert">
          {error ?? loadError}
        </p>
      )}
      <WhatsAppSection token={token} />
    </div>
  );
}
