import { useState } from 'react';
import { connectSource, disconnectSource, oauthStartUrl, syncSource, type Source } from './api';
import { messageOf } from './format';
import { HealthAddress } from './HealthAddress';
import { Item } from './Item';
import { KeyForm } from './KeyForm';
import { RowButton } from './RowButton';
import { SourceDetail } from './SourceDetail';
import { SourceLogo } from './SourceLogo';
import { isConfigured, isConnected, stateOf } from './sourceState';

interface SourceRowProps {
  token: string;
  source: Source;
  ingestUrl: string;
  open: boolean;
  onToggle: () => void;
  onChange: () => void;
}

const imported = (count: number) => (count === 1 ? '1 registro nuevo.' : `${count} registros nuevos.`);

export function SourceRow({ token, source, ingestUrl, open, onToggle, onChange }: SourceRowProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<string>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
      onChange();
    } catch (failure) {
      setMessage(messageOf(failure, 'No se pudo completar.'));
    } finally {
      setBusy(false);
    }
  }

  const connect = (secret: string) =>
    void run(async () => {
      const result = await connectSource(token, source.id, secret);
      return `Conectado como ${result.account}. ${imported(result.imported)}`;
    });
  const sync = () => void run(async () => imported((await syncSource(token, source.id)).imported));
  const disconnect = () => void run(async () => (await disconnectSource(token, source.id), 'Desconectado. Sus registros se borraron.'));

  const connected = isConnected(source);
  const needsKey = source.connect === 'key' && !source.connection;
  const oauthUrl = source.connect === 'oauth' && source.provider && !source.connection && isConfigured(source) ? oauthStartUrl(token, source.provider) : null;
  const opens = Boolean(source.connection) || source.connect === 'push';

  function detail() {
    if (!open) return null;
    if (source.connection) return <SourceDetail source={source} connection={source.connection} busy={busy} onSync={sync} onDisconnect={disconnect} />;
    if (source.connect === 'push') return <HealthAddress url={ingestUrl} sync={source.sync} />;
    if (needsKey) return <KeyForm label={source.label} busy={busy} onSubmit={connect} />;
    return null;
  }

  function action() {
    if (needsKey) return <RowButton label="Conectar" name={`Conectar ${source.label}`} expanded={open} onClick={onToggle} />;
    if (oauthUrl)
      return (
        <a className="rd-button rd-button--quiet rd-button--small app-link" href={oauthUrl} aria-label={`Conectar ${source.label}`}>
          Conectar
        </a>
      );
    return undefined;
  }

  const shown = detail();

  return (
    <div>
      <Item
        icon={<SourceLogo id={source.id} />}
        title={
          <>
            {source.label}
            {connected && <span className="rd-dot" />}
          </>
        }
        subtitle={stateOf(source)}
        end={action()}
        off={source.connect === 'soon'}
        expanded={opens ? open : undefined}
        onToggle={opens ? onToggle : undefined}
      />
      {(shown || message) && (
        <div className="rd-item__detail">
          {shown}
          {message && (
            <span className="rd-note app-wrap" role="status">
              {message}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
