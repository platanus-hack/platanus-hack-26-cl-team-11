import { formatAgo } from './ago';
import { AssistantLogo } from './AssistantLogo';
import { ConnectorLine } from './ConnectorLine';
import { TeamContextLine } from './TeamContextLine';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { PairingLine } from './PairingLine';
import { useAction } from './useAction';
import { RowButton } from './RowButton';
import { removeAssistant, type Assistant } from './roomApi';

interface AgentConnectProps {
  token: string;
  assistants: Assistant[];
  onChange: () => void;
}

export function AgentConnect({ token, assistants, onChange }: AgentConnectProps) {
  const revoke = useAction();
  const disconnect = (assistant: Assistant) => {
    if (window.confirm('¿Desconectar ' + assistant.label + ' y retirar sus traspasos del equipo?')) {
      void revoke.run(async () => { await removeAssistant(token, assistant.id); onChange(); });
    }
  };
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
          end={<RowButton label="Desconectar" name={'Desconectar ' + assistant.label} disabled={revoke.busy} onClick={() => disconnect(assistant)} />}
          subtitle={assistant.lastSeenAt ? `Activo ${formatAgo(assistant.lastSeenAt, Date.now()).toLowerCase()}` : 'Conectado'}
        />
      ))}
      {revoke.error && <span className="rd-note" role="alert">{revoke.error}</span>}
      <div>
        <Item
          icon={
            <ItemIcon>
              <Glyph name="agent" />
            </ItemIcon>
          }
          title={assistants.length ? 'Conectar otro agente' : 'Conecta tu agente'}
          subtitle="Claude, Codex, ChatGPT o Instinct"
        />
        <div className="rd-item__detail">
          <TeamContextLine key={token} token={token} />
          <PairingLine token={token} connected={assistants.length} auto />
          <ConnectorLine token={token} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}
