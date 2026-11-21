import { Face } from './Face';
import { Item } from './Item';
import type { HelpAnswer, RoomPerson, RoomThread } from './roomApi';

const HELP_LABEL: Record<HelpAnswer, string> = { si: 'Puede ayudar', parcial: 'Puede orientar', no: 'No puede' };
const UNKNOWN_NAME = 'Alguien';

interface RoomThreadRowProps {
  thread: RoomThread;
  people: Map<string, RoomPerson>;
  open: boolean;
  onToggle: () => void;
}

export function RoomThreadRow({ thread, people, open, onToggle }: RoomThreadRowProps) {
  const nameOf = (id: string) => people.get(id)?.name ?? UNKNOWN_NAME;
  const readable = Boolean(thread.messages?.length);

  return (
    <div>
      <Item
        icon={<Face name={nameOf(thread.from)} />}
        title={`${nameOf(thread.from)} → ${nameOf(thread.to)}`}
        subtitle={`${thread.topic} · ${thread.help ? HELP_LABEL[thread.help] : 'Conversando'}`}
        expanded={readable ? open : undefined}
        onToggle={readable ? onToggle : undefined}
      />
      {open && readable && (
        <div className="rd-item__detail">
          {thread.messages?.map((message, position) => (
            <p key={position} className="app-body">
              <span className="app-title">Agente de {nameOf(message.from)}: </span>
              {message.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
