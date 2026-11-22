import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { answerChat, fetchChat, sendChat, type ChatMessage, type ChatView } from './api';
import { Face } from './Face';
import { Glyph } from './Glyph';
import { useAction } from './useAction';
import { usePolling } from './usePolling';

const MAX_MESSAGE_LENGTH = 1000;
const REFRESH_MS = 2000;

interface GlobeChatProps {
  token: string;
  name?: string;
  stage?: boolean;
  ideas?: string[];
  onRound?: () => void;
}

const promptOf = (message: ChatMessage) => message.options[0]?.id.split(':')[0];

export function GlobeChat({ token, name = '', stage = false, ideas = [], onRound }: GlobeChatProps) {
  const [view, setView] = useState<ChatView | null>(null);
  const seenBefore = useRef<Set<string> | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [answered, setAnswered] = useState<ReadonlySet<string>>(new Set());
  const [chosen, setChosen] = useState<ReadonlyMap<string, string>>(new Map());
  const [used, setUsed] = useState<ReadonlySet<string>>(new Set());
  const { busy, error, run } = useAction();
  const answering = useAction();
  const lines = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const show = useCallback((next: ChatView) => {
    seenBefore.current ??= new Set(next.messages.map((message) => message.key));
    setView(next);
  }, []);
  const load = useCallback(async () => show(await fetchChat(token)), [token, show]);
  usePolling(load, REFRESH_MS);

  const fresh = (view?.messages ?? []).filter((message) => !seenBefore.current?.has(message.key));
  const heardAll = fresh.filter((message) => message.role === 'agente');
  const latestOfPrompt = new Map(heardAll.flatMap((message) => (promptOf(message) ? [[promptOf(message) as string, message.key] as const] : [])));
  const waits = (message: ChatMessage) => {
    const prompt = promptOf(message);
    return prompt !== undefined && !answered.has(prompt) && latestOfPrompt.get(prompt) === message.key;
  };
  const lastHeard = heardAll.at(-1);
  const shown = stage ? fresh.filter(waits) : heardAll.filter((message) => waits(message) || (message === lastHeard && message.options.length === 0));
  const count = shown.length;

  useEffect(() => {
    const node = lines.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [count, sending]);

  useEffect(() => {
    if (!stage) return;
    if (window.parent === window) input.current?.focus();
    const focusOnStage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && (event.data as { montu?: string } | null)?.montu === 'escenario') input.current?.focus();
    };
    window.addEventListener('message', focusOnStage);
    return () => window.removeEventListener('message', focusOnStage);
  }, [stage]);

  const say = (text: string) => {
    if (!text || busy) return;
    setDraft('');
    setUsed((before) => new Set([...before, text]));
    setSending(text);
    onRound?.();
    void run(async () => {
      try {
        show(await sendChat(token, text));
      } finally {
        setSending(null);
        onRound?.();
      }
    });
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    say(draft.trim());
  }

  const choose = (message: ChatMessage, option: ChatMessage['options'][number]) => {
    setAnswered((before) => new Set([...before, option.id.split(':')[0] ?? '']));
    setChosen((before) => new Map([...before, [message.key, option.label]]));
    void answering.run(async () => {
      try {
        show(await answerChat(token, option.id));
        onRound?.();
      } catch (failure) {
        setAnswered((before) => new Set([...before].filter((prompt) => prompt !== option.id.split(':')[0])));
        setChosen((before) => new Map([...before].filter(([key]) => key !== message.key)));
        throw failure;
      }
    });
  };

  const actionsOf = (message: ChatMessage) => (
    <div className="rd-actions app-options">
      {message.options.map((option, position) => (
        <button key={option.id} type="button" className={`rd-button${stage ? '' : ' rd-button--small'}${position === 0 ? '' : ' rd-button--quiet'}`} disabled={answering.busy} onClick={() => choose(message, option)}>
          {option.label}
        </button>
      ))}
    </div>
  );

  const composer = (
    <form className="rd-composer" onSubmit={submit}>
      <input
        ref={input}
        className="rd-composer__input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          const waiting = stage && event.key === 'Enter' && !draft.trim() ? shown.find(waits) : undefined;
          const first = waiting?.options[0];
          if (!waiting || !first || answering.busy) return;
          event.preventDefault();
          choose(waiting, first);
        }}
        placeholder="Escríbele a tu agente" aria-label="Mensaje para tu agente" maxLength={MAX_MESSAGE_LENGTH} autoComplete="off" />
      <button className="rd-composer__send" type="submit" aria-label="Enviar" disabled={busy || !draft.trim()}>
        <Glyph name="send" />
      </button>
    </form>
  );

  const typing = (
    <span className="rd-bubble rd-bubble--typing" aria-label="Tu agente está escribiendo">
      <i />
      <i />
      <i />
    </span>
  );

  const failure = error ?? answering.error;
  const problem = failure && (
    <p className="rd-note" role="alert">
      {failure}
    </p>
  );

  if (!stage) {
    return (
      <div className="app-globe__dock">
        {shown.map((message) => (
          <div key={message.key} className="rd-bubble">
            {message.text}
            {message.options.length > 0 && actionsOf(message)}
          </div>
        ))}
        {sending !== null && typing}
        {problem}
        {composer}
      </div>
    );
  }

  const idle = sending === null && draft === '' && !shown.some(waits);
  const unused = ideas.filter((idea) => !used.has(idea));

  return (
    <aside className="app-stage__agent rd-glass" aria-label="Tu agente">
      <div className="app-stage__head">
        <Face name={name} size="chat" state={sending !== null ? 'pensando' : 'reposo'} />
        <span className="app-stage__title">Tu agente</span>
      </div>
      <div className="app-stage__lines" ref={lines} aria-live="polite">
        {shown.map((message) => (
          <div key={message.key} className="rd-decision app-stage__decision">
            <div className="rd-decision__body">
              <p className="app-stage__text">{message.text}</p>
              {actionsOf(message)}
            </div>
          </div>
        ))}
        {sending !== null && <div className="app-stage__line">{typing}</div>}
      </div>
      {problem}
      {idle && unused.length > 0 && (
        <div className="app-stage__ideas">
          {unused.map((idea) => (
            <button
              key={idea}
              type="button"
              className="rd-thread__idea app-stage__idea"
              disabled={busy}
              onClick={() => {
                setDraft(idea);
                input.current?.focus();
              }}
            >
              {idea}
            </button>
          ))}
        </div>
      )}
      {composer}
    </aside>
  );
}
