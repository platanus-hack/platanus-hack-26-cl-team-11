import { useState } from 'react';
import { formatAgo } from './ago';
import { AssistantLogo } from './AssistantLogo';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { PairingLine } from './PairingLine';
import { PasteBack } from './PasteBack';
import type { Assistant } from './roomApi';

interface AgentConnectProps {
  token: string;
  assistants: Assistant[];
  onChange: () => void;
}

export function AgentConnect({ token, assistants, onChange }: AgentConnectProps) {
  const [chat, setChat] = useState(false);

  return (
    <div className="rd-list">
      {assistants.map((assistant) => (
        <Item
          key={assistant.id}
          icon={<AssistantLogo kind={assistant.kind} />}
          title={
            <>
              {assistant.label}
              <span className="rd-dot" />
            </>
          }
          subtitle={assistant.lastSeenAt ? `Activo ${formatAgo(assistant.lastSeenAt, Date.now()).toLowerCase()}` : 'Conectado'}
        />
      ))}
      <div>
        <Item
          icon={
            <ItemIcon>
              <Glyph name="agent" />
            </ItemIcon>
          }
          title={assistants.length ? 'Conectar otro agente' : 'Conecta tu agente'}
          subtitle="Claude, Codex, Instinct o el que uses. Solo lee y escribe en Ronda"
        />
        <div className="rd-item__detail">
          <PairingLine token={token} connected={assistants.length} auto />
        </div>
      </div>
      <div>
        <Item
          icon={
            <ItemIcon>
              <Glyph name="chat" />
            </ItemIcon>
          }
          title="Tu agente no puede abrir un link"
          subtitle="Copias una pregunta y pegas su respuesta"
          expanded={chat}
          onToggle={() => setChat((current) => !current)}
        />
        {chat && (
          <div className="rd-item__detail">
            <PasteBack token={token} onSaved={onChange} />
          </div>
        )}
      </div>
    </div>
  );
}
