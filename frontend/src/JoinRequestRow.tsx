import { approveJoin, type JoinRequest } from './api';
import { Face } from './Face';
import { Item } from './Item';
import { RowButton } from './RowButton';
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
    void run(async () => {
      await approveJoin(token, teamId, request.id);
      await onChange();
    });

  const progress = `${request.approvals} de ${request.needed} aprobaron`;

  return (
    <div>
      <Item
        icon={<Face name={request.name} />}
        title={request.name}
        subtitle={request.approvedByMe ? `Ya aprobaste · ${progress}` : `Quiere entrar · ${progress}`}
        end={request.approvedByMe ? undefined : <RowButton label="Aprobar" name={`Aprobar el ingreso de ${request.name}`} disabled={busy} onClick={approve} />}
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
