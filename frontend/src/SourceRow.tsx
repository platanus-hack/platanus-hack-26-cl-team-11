import { useState, type FormEvent } from 'react';
import { connectSource, disconnectSource, syncSource, type Source } from './api';
import { formatWhen } from './format';

function statusText(source: Source) {
  if (source.connect === 'soon') return 'Próximamente';
  if (source.connection) return source.connection.account;
  if (source.sync) return `${source.sync.total} ${source.sync.total === 1 ? 'registro' : 'registros'}`;
  return source.connect === 'push' ? 'Esperando el primer envío' : 'Sin conectar';
}

export function SourceRow({ token, source, onChange }: { token: string; source: Source; onChange: () => void }) {
  const [secret, setSecret] = useState('');
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
      setMessage(failure instanceof Error ? failure.message : 'No se pudo completar.');
    } finally {
      setBusy(false);
    }
  }

  const imported = (count: number) => (count === 1 ? '1 registro nuevo.' : `${count} registros nuevos.`);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!secret.trim()) return;
    void run(async () => {
      const result = await connectSource(token, source.id, secret.trim());
      setSecret('');
      return `Conectado como ${result.account}. ${imported(result.imported)}`;
    });
  }

  const connected = Boolean(source.connection) || (source.connect === 'push' && Boolean(source.sync));
  const note = message ?? source.connection?.lastError ?? (source.sync ? `Último registro: ${formatWhen(source.sync.last)}` : null);

  return (
    <div className={`app-source${source.connect === 'soon' ? ' app-off' : ''}`}>
      <div className="rd-row">
        <div className="app-text">
          <span className="app-title">{source.label}</span>
          <span className="rd-note">{source.how}</span>
        </div>
        <span className="rd-chip rd-glass">
          {connected && <span className="rd-dot" />}
          {statusText(source)}
        </span>
      </div>

      {source.connect === 'key' && !source.connection && (
        <form className="rd-actions" onSubmit={submit}>
          <input
            className="rd-input app-grow"
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder={`Pega tu llave de ${source.label}`}
            aria-label={`Llave de ${source.label}`}
          />
          <button className="rd-button" type="submit" disabled={busy || !secret.trim()}>
            {busy ? 'Conectando…' : 'Conectar'}
          </button>
        </form>
      )}

      {source.connect === 'key' && source.connection && (
        <div className="rd-actions">
          <button className="rd-button rd-button--quiet" type="button" disabled={busy} onClick={() => void run(async () => imported((await syncSource(token, source.id)).imported))}>
            {busy ? 'Trabajando…' : 'Sincronizar'}
          </button>
          <button
            className="rd-button rd-button--quiet"
            type="button"
            disabled={busy}
            onClick={() => void run(async () => (await disconnectSource(token, source.id), 'Desconectado. Sus registros se borraron.'))}
          >
            Desconectar
          </button>
        </div>
      )}

      {note && <span className="rd-note">{note}</span>}
    </div>
  );
}
