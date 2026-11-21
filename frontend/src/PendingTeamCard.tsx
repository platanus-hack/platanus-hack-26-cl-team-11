import { leaveTeam, type TeamSummary } from './api';
import { useAction } from './useAction';

export function PendingTeamCard({ token, team, onChange }: { token: string; team: TeamSummary; onChange: () => Promise<void> }) {
  const { busy, error, run } = useAction();

  const withdraw = () =>
    run(async () => {
      await leaveTeam(token, team.id);
      await onChange();
    });

  return (
    <section className="rd-card rd-glass">
      <span className="rd-label">Tu equipo</span>
      <h2 className="rd-title app-wrap">{team.name}</h2>
      <p className="rd-note">Pediste entrar. Quedas dentro cuando cada integrante del equipo lo apruebe desde su página.</p>
      <div className="rd-actions">
        <button className="rd-button rd-button--quiet" type="button" disabled={busy} onClick={() => void withdraw()}>
          Retirar solicitud
        </button>
      </div>
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
