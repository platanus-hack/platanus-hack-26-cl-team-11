import { leaveTeam, type TeamSummary } from './api';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { RowButton } from './RowButton';
import { useAction } from './useAction';

export function PendingTeamRow({ token, team, onChange }: { token: string; team: TeamSummary; onChange: () => Promise<void> }) {
  const { busy, error, run } = useAction();

  const withdraw = () =>
    void run(async () => {
      await leaveTeam(token, team.id);
      await onChange();
    });

  return (
    <div>
      <Item
        icon={
          <ItemIcon>
            <Glyph name="team" />
          </ItemIcon>
        }
        title={team.name}
        subtitle="Esperando al equipo"
        end={<RowButton label="Retirar" name={`Retirar tu solicitud a ${team.name}`} disabled={busy} onClick={withdraw} />}
      />
      {error && (
        <div className="rd-item__detail">
          <span className="rd-note" role="alert">
            {error}
          </span>
        </div>
      )}
    </div>
  );
}
