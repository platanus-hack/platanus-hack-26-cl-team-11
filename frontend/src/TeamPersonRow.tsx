import { makeAdmin, removeMember, type OnboardingStepId, type TeamPerson } from './api';
import { Face } from './Face';
import { Item } from './Item';
import { RowButton } from './RowButton';
import { useAction } from './useAction';

const STEP_NAME: Record<OnboardingStepId, string> = {
  equipo: 'equipo',
  agente: 'agente',
  checkin: 'check-in',
  whatsapp: 'WhatsApp',
  salud: 'salud',
};

function statusOf(person: TeamPerson) {
  const role = person.admin ? 'Administra' : null;
  const setup = person.pending === null ? null : person.pending.length === 0 ? 'Todo conectado' : `Le falta: ${person.pending.map((step) => STEP_NAME[step]).join(', ')}`;
  return [role, setup].filter(Boolean).join(' · ') || undefined;
}

interface TeamPersonRowProps {
  token: string;
  teamId: string;
  person: TeamPerson;
  manage: boolean;
  open: boolean;
  onToggle: () => void;
  onChange: () => Promise<void>;
}

export function TeamPersonRow({ token, teamId, person, manage, open, onToggle, onChange }: TeamPersonRowProps) {
  const { busy, error, run } = useAction();
  const manageable = manage && !person.me;

  const act = (action: () => Promise<unknown>) =>
    void run(async () => {
      await action();
      await onChange();
    });

  return (
    <div>
      <Item
        icon={<Face name={person.name} />}
        title={person.me ? `${person.name} (tú)` : person.name}
        subtitle={statusOf(person)}
        expanded={manageable ? open : undefined}
        onToggle={manageable ? onToggle : undefined}
      />
      {manageable && open && (
        <div className="rd-item__detail">
          <div className="rd-actions">
            {!person.admin && <RowButton label="Hacer admin" name={`Hacer admin a ${person.name}`} disabled={busy} onClick={() => act(() => makeAdmin(token, teamId, person.id))} />}
            <RowButton label="Sacar del equipo" name={`Sacar a ${person.name} del equipo`} disabled={busy} onClick={() => act(() => removeMember(token, teamId, person.id))} />
          </div>
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
