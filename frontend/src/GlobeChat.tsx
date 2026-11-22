import { useCallback, useRef, useState, type FormEvent } from 'react';
import { answerChat, fetchChat, sendChat, type ChatView } from './api';
import { Glyph } from './Glyph';
import { useAction } from './useAction';
import { usePolling } from './usePolling';

const MAX_MESSAGE_LENGTH = 1000;
const REFRESH_MS = 2000;

export function GlobeChat({ token }: { token: string }) {
  const [view, setView] = useState<ChatView | null>(null);
  const seenBefore = useRef<Set<string> | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [answered, setAnswered] = useState<ReadonlySet<string>>(new Set());
  const { busy, error, run } = useAction();

  const show = useCallback((next: ChatView) => {
    seenBefore.current ??= new Set(next.messages.map((message) => message.key));
    setView(next);
  }, []);
  const load = useCallback(async () => show(await fetchChat(token)), [token, show]);
  usePolling(load, REFRESH_MS);

  const fresh = (view?.messages ?? []).filter((message) => message.role === 'agente' && !seenBefore.current?.has(message.key));
  const promptOf = (message: ChatView['messages'][number]) => message.options[0]?.id.split(':')[0];
  const latestOfPrompt = new Map(fresh.flatMap((message) => (promptOf(message) ? [[promptOf(message) as string, message.key] as const] : [])));
  const waits = (message: ChatView['messages'][number]) => {
    const prompt = promptOf(message);
    return prompt !== undefined && !answered.has(prompt) && latestOfPrompt.get(prompt) === message.key;
  };
  const heard = fresh.filter((message, position) => waits(message) || (position === fresh.length - 1 && message.options.length === 0));

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    setSending(true);
    void run(async () => {
      try {
        show(await sendChat(token, text));
      } finally {
        setSending(false);
      }
    });
  }

  return (
    <div className="app-globe__dock">
      {heard.map((message) => (
        <div key={message.key} className="rd-bubble">
          {message.text}
          {message.options.length > 0 && (
            <div className="rd-actions app-options">
              {message.options.map((option, position) => (
                <button
                  key={option.id}
                  type="button"
                  className={`rd-button rd-button--small${position === 0 ? '' : ' rd-button--quiet'}`}
                  disabled={busy}
                  onClick={() => {
                    setAnswered((before) => new Set([...before, option.id.split(':')[0] ?? '']));
                    void run(async () => show(await answerChat(token, option.id)));
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {sending && (
        <span className="rd-bubble rd-bubble--typing" aria-label="Tu agente está escribiendo">
          <i />
          <i />
          <i />
        </span>
      )}
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
      <form className="rd-composer" onSubmit={submit}>
        <input className="rd-composer__input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escríbele a tu agente" aria-label="Mensaje para tu agente" maxLength={MAX_MESSAGE_LENGTH} autoComplete="off" />
        <button className="rd-composer__send" type="submit" aria-label="Enviar" disabled={busy || !draft.trim()}>
          <Glyph name="send" />
        </button>
      </form>
    </div>
  );
}
