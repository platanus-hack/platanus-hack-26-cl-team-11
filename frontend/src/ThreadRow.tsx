import type { AgentThread, HelpAnswer } from './api';
import { Face } from './Face';
import { Item } from './Item';
import { ThreadPlay } from './ThreadPlay';

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
        <div className="app-thread">
          <ThreadPlay thread={thread} messages={thread.messages} />
        </div>
      )}
    </div>
  );
}
