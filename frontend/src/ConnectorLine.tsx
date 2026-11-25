import { useState } from 'react';
import { CopyButton } from './CopyButton';
import { ASSISTANT_NAME, createConnector, type AssistantKind, type Connector } from './roomApi';
import { RowButton } from './RowButton';
import { useAction } from './useAction';

export function ConnectorLine({ token, onChange }: { token: string; onChange: () => void }) {
  const [kind, setKind] = useState<AssistantKind>('claude');
  const [connector, setConnector] = useState<Connector | null>(null);
  const { busy, error, run } = useAction();

  const create = () =>
    void run(async () => {
      setConnector(await createConnector(token, kind));
      onChange();
    });

  return (
    <>
      {connector ? (
        <>
          <span className="rd-note">En tu agente, agrega un conector con esta dirección y esta cabecera. Se muestran una sola vez.</span>
          <span className="rd-code">{connector.url}</span>
          <span className="rd-code">{connector.header}</span>
          <div className="rd-actions">
            <CopyButton text={connector.url} label="Copiar la dirección" />
            <CopyButton text={connector.header} label="Copiar la cabecera" />
          </div>
          <span className="rd-note">Si tu agente solo acepta una dirección, usa esta. Cuídala como una clave.</span>
          <span className="rd-code">{connector.keyUrl}</span>
          <div className="rd-actions">
            <CopyButton text={connector.keyUrl} label="Copiar la dirección con clave" />
          </div>
        </>
      ) : (
        <>
          <span className="rd-note">Crea un conector personal para la cuenta de tu agente.</span>
          <div className="rd-actions">
            <select className="rd-input" aria-label="Tipo de agente" value={kind} onChange={(event) => setKind(event.target.value as AssistantKind)}>
              {Object.entries(ASSISTANT_NAME).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <RowButton label={busy ? 'Creando…' : 'Crear conector'} disabled={busy} onClick={create} />
          </div>
        </>
      )}
      {error && (
        <span className="rd-note" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
