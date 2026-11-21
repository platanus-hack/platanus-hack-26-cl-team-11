import { useEffect, useState } from 'react';
import type { AgentMessage, AgentThread, HelpAnswer } from './api';
import { Face } from './Face';
import { StreamText } from './StreamText';

const HELP_LABEL: Record<HelpAnswer, string> = { si: 'Puede ayudar', parcial: 'Puede orientar', no: 'No puede' };
const THINK_MS = 700;

export function ThreadPlay({ thread, messages }: { thread: AgentThread; messages: AgentMessage[] }) {
  const [shown, setShown] = useState(0);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    setShown(0);
    setWriting(false);
  }, [thread.id]);

  useEffect(() => {
    if (writing || shown >= messages.length) return;
    const timer = window.setTimeout(() => setWriting(true), THINK_MS);
    return () => window.clearTimeout(timer);
  }, [writing, shown, messages.length]);

  const advance = () => {
    setWriting(false);
    setShown((current) => current + 1);
  };

  const finished = shown >= messages.length;
  const next = messages[shown];
  const mineOf = (message: AgentMessage) => message.fromName === thread.requesterName;
  const lineClass = (message: AgentMessage) => `rd-thread__line${mineOf(message) ? ' rd-thread__line--mine' : ''}`;

  return (
    <div className="rd-thread rd-glass">
      <div className="rd-thread__head">
        <span className="rd-thread__faces">
          <Face name={thread.requesterName} size="chat" state={finished ? 'reposo' : 'pensando'} />
          <Face name={thread.helperName} size="chat" state={finished ? 'reposo' : 'pensando'} />
        </span>
        <span className="rd-thread__title">
          <span className="rd-label">
            El agente de {thread.requesterName} y el de {thread.helperName}
          </span>
          <span className="rd-thread__topic">{thread.topic}</span>
        </span>
        <span className="rd-chip rd-chip--status rd-glass">
          {finished && thread.help === 'si' && <span className="rd-dot" />}
          {finished ? (thread.help ? HELP_LABEL[thread.help] : 'Sin respuesta') : 'Conversando'}
        </span>
      </div>
      <div className="rd-thread__lines" aria-live="polite">
        {messages.slice(0, shown).map((message, position) => (
          <div className={lineClass(message)} key={position}>
            <span className="rd-thread__author">Agente de {message.fromName}</span>
            <p className="rd-bubble">
              <StreamText text={message.text} play={false} />
            </p>
          </div>
        ))}
        {next && (
          <div className={lineClass(next)} key={`next-${shown}`}>
            <span className="rd-thread__author">Agente de {next.fromName}</span>
            {writing ? (
              <p className="rd-bubble">
                <StreamText text={next.text} play onDone={advance} />
              </p>
            ) : (
              <span className="rd-bubble rd-bubble--typing" aria-label="Escribiendo">
                <i />
                <i />
                <i />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
