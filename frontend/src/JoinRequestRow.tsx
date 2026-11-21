import { approveJoin, type JoinRequest } from './api';
import { PersonTag } from './PersonTag';
import { useAction } from './useAction';

interface JoinRequestRowProps {
  token: string;
  teamId: string;
  request: JoinRequest;
  onChange: () => Promise<void>;
}

export function JoinRequestRow({ token, teamId, request, onChange }: JoinRequestRowProps) {
  const { busy, error, run } = useAction();

  const approve = () =>
    run(async () => {
      await approveJoin(token, teamId, request.id);
      await onChange();
    });

  return (
    <div className="app-source">
      <div className="rd-row">
        <PersonTag name={request.name} />
        <span className="rd-note">
          {request.approvals} de {request.needed} aprobaron
        </span>
      </div>
      {request.approvedByMe ? (
        <span className="rd-note">Ya aprobaste. Falta el resto del equipo.</span>
      ) : (
        <div className="rd-actions">
          <button className="rd-button rd-button--quiet" type="button" disabled={busy} onClick={() => void approve()}>
            Aprobar ingreso
          </button>
        </div>
      )}
      {error && (
        <span className="rd-note" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
