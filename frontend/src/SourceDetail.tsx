import type { Source, SourceConnection } from './api';
import { countOf, formatWhen } from './format';
import { RowButton } from './RowButton';
import { lastRecordOf } from './sourceState';

interface SourceDetailProps {
  source: Source;
  connection: SourceConnection;
  busy: boolean;
  onSync: () => void;
  onDisconnect: () => void;
}

export function SourceDetail({ source, connection, busy, onSync, onDisconnect }: SourceDetailProps) {
  const lastRecord = lastRecordOf(source);

  return (
    <>
      <span className="rd-note app-wrap">Cuenta: {connection.account}</span>
      {source.sync && (
        <span className="rd-note">
          {countOf(source.sync.total, 'registro', 'registros')} · {lastRecord}
        </span>
      )}
      {connection.lastSyncedAt && <span className="rd-note">Última actualización: {formatWhen(connection.lastSyncedAt)}</span>}
      {connection.lastError && (
        <span className="rd-note app-wrap" role="alert">
          {connection.lastError}
        </span>
      )}
      <div className="rd-actions">
        <RowButton label={busy ? 'Trabajando…' : 'Actualizar'} disabled={busy} onClick={onSync} />
        <RowButton label="Desconectar" disabled={busy} onClick={onDisconnect} />
      </div>
    </>
  );
}
