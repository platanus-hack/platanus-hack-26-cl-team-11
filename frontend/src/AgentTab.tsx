import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { answerChat, fetchChat, sendChat, type ChatView } from './api';
import { RowButton } from './RowButton';
import { Item } from './Item';
import { SectionHead } from './SectionHead';
import { SourceLogo } from './SourceLogo';
import { useAction } from './useAction';
import { usePolling } from './usePolling';

const MAX_MESSAGE_LENGTH = 1000;

function mirrorText(view: ChatView) {
  if (view.whatsapp.linked) return `Es el mismo agente de tu WhatsApp que termina en ${view.whatsapp.phoneEnding ?? ''}`;
  if (view.whatsapp.configured) return 'Es el mismo agente que por WhatsApp. Conéctalo en Ajustes';
  return 'Es el mismo agente que te va a hablar por WhatsApp';
}

export function AgentTab({ token, active }: { token: string; active: boolean }) {
  const [view, setView] = useState<ChatView | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => setView(await fetchChat(token)), [token]);
  const { error: loadError } = usePolling(load);

  const count = view?.messages.length ?? 0;
  const settled = useRef<number | null>(null);
  useEffect(() => {
    if (!view) return;
    const grew = settled.current !== null && (count > settled.current || pending !== null);
    settled.current = count;
    if (active && grew) end.current?.scrollIntoView({ block: 'nearest' });
  }, [active, view, count, pending]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
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
  }

  return (
    <div className="app-block">
      <SectionHead title="Tu agente" />
      {view && (
        <div className="rd-list">
          <Item icon={<SourceLogo id="whatsapp" />} title="Escríbele aquí o por WhatsApp" subtitle={mirrorText(view)} />
        </div>
      )}
      {view && !view.configured && <p className="rd-note">Al servidor le falta el modelo: tu agente todavía no puede responder.</p>}
      <div className="rd-chat app-chat" aria-live="polite">
        {view?.messages.length === 0 && !pending && <p className="rd-note">Cuéntale cómo viene tu día o pregúntale algo a tu equipo.</p>}
        {view?.messages.map((message) => (
          <div key={message.key} className={`rd-bubble${message.role === 'persona' ? ' rd-bubble--mine' : ''}`}>
            {message.text}
            {message.options.length > 0 && (
              <div className="rd-actions app-options">
                {message.options.map((option) => (
                  <RowButton key={option.id} label={option.label} disabled={busy} onClick={() => void run(async () => setView(await answerChat(token, option.id)))} />
                ))}
              </div>
            )}
          </div>
        ))}
        {pending && (
          <>
            <p className="rd-bubble rd-bubble--mine">{pending}</p>
            <span className="rd-bubble rd-bubble--typing" aria-label="Tu agente está escribiendo">
              <i />
              <i />
              <i />
            </span>
          </>
        )}
        <div ref={end} />
      </div>
      <form className="rd-actions" onSubmit={submit}>
        <input className="rd-input app-grow" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escríbele a tu agente" aria-label="Mensaje para tu agente" maxLength={MAX_MESSAGE_LENGTH} autoComplete="off" />
        <button className="rd-button" type="submit" disabled={busy || !draft.trim()}>
          Enviar
        </button>
      </form>
      {(error ?? loadError) && (
        <p className="rd-note" role="alert">
          {error ?? loadError}
        </p>
      )}
    </div>
  );
}
