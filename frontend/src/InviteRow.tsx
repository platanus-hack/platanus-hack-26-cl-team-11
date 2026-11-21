import { createInvite, revokeInvite, type Team } from './api';
import { CopyButton } from './CopyButton';
import { formatWhen } from './format';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { RowButton } from './RowButton';
import { useAction } from './useAction';

export function InviteRow({ token, team, onChange }: { token: string; team: Team; onChange: () => Promise<void> }) {
  const { busy, error, run } = useAction();
  const invite = team.invites[0];
  const link = invite ? `${window.location.origin}${invite.path}` : null;

  const act = (action: () => Promise<unknown>) =>
    void run(async () => {
      await action();
      await onChange();
    });

  return (
    <div>
      <Item
        icon={
          <ItemIcon>
            <Glyph name="link" />
          </ItemIcon>
        }
        title="Link de invitación"
        subtitle={link ?? 'Quien lo abre entra directo al equipo'}
        end={link ? <CopyButton text={link} label="Copiar el link de invitación" /> : <RowButton label="Crear" name="Crear un link de invitación" disabled={busy} onClick={() => act(() => createInvite(token, team.id))} />}
      />
      {(invite || error) && (
        <div className="rd-item__detail">
          {invite && (
            <div className="rd-actions">
              <span className="rd-note">Vence el {formatWhen(invite.expiresAt)}</span>
              <RowButton label="Anular" name="Anular el link de invitación" disabled={busy} onClick={() => act(() => revokeInvite(token, team.id, invite.code))} />
            </div>
          )}
          {error && (
            <span className="rd-note" role="alert">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
