import { decideAsk, type AgentAsk } from './api';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { RowButton } from './RowButton';
import { useAction } from './useAction';

interface AskRowProps {
  token: string;
  ask: AgentAsk;
  onChange: () => Promise<void>;
}

export function AskRow({ token, ask, onChange }: AskRowProps) {
  const { busy, error, run } = useAction();

  const decide = (allow: boolean) =>
    void run(async () => {
      await decideAsk(token, ask.topic, allow);
      await onChange();
    });

  return (
    <div>
      <Item
        icon={
          <ItemIcon>
            <Glyph name="blockers" />
          </ItemIcon>
        }
        title={`¿Pido ayuda con «${ask.topic}»?`}
        subtitle="Tu agente te pregunta antes de contarlo"
      />
      <div className="rd-item__detail">
        <div className="rd-actions">
          <RowButton label="Permitir" name={`Permitir pedir ayuda con ${ask.topic}`} disabled={busy} onClick={() => decide(true)} />
          <RowButton label="No" name={`No pedir ayuda con ${ask.topic}`} disabled={busy} onClick={() => decide(false)} />
        </div>
        {error && (
          <span className="rd-note" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
