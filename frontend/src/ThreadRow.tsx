import type { AgentThread, HelpAnswer } from './api';
import { Face } from './Face';
import { Item } from './Item';

const HELP_LABEL: Record<HelpAnswer, string> = {
  si: 'Puede ayudar',
  parcial: 'Puede orientar',
  no: 'No puede',
};

interface ThreadRowProps {
  thread: AgentThread;
  open: boolean;
  onToggle: () => void;
}

export function ThreadRow({ thread, open, onToggle }: ThreadRowProps) {
  const outcome = thread.help ? HELP_LABEL[thread.help] : 'Sin respuesta';
  const readable = thread.messages !== null;

  return (
    <div>
      <Item
        icon={<Face name={thread.requesterName} />}
        title={`El agente de ${thread.requesterName} le escribió al de ${thread.helperName}`}
        subtitle={`${thread.topic} · ${outcome}`}
        expanded={readable ? open : undefined}
        onToggle={readable ? onToggle : undefined}
      />
      {open && thread.messages && (
        <div className="rd-item__detail">
          {thread.messages.map((message, position) => (
            <p className="app-body" key={position}>
              <span className="rd-note">Agente de {message.fromName}</span>
              {'\n'}
              {message.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
