import { useEffect, useState } from 'react';
import { CopyButton } from './CopyButton';
import { createPairing, type Pairing } from './roomApi';
import { RowButton } from './RowButton';
import { useAction } from './useAction';

export function PairingLine({ token, connected, auto = false }: { token: string; connected: number; auto?: boolean }) {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const { busy, error, run } = useAction();

  const create = () => void run(async () => setPairing(await createPairing(token)));

  useEffect(() => {
    if (auto) create();
  }, [auto, connected]);
  const line = pairing ? `Lee ${window.location.origin}${pairing.path} y sigue las instrucciones.` : null;

  return (
    <>
      {pairing && line ? (
        <>
          <span className="rd-note">Pégale esta línea a tu agente. Sirve una vez y dura {pairing.minutes} minutos.</span>
          <span className="rd-code">{line}</span>
          <div className="rd-actions">
            <CopyButton text={line} label="Copiar la línea" />
            <RowButton label="Crear otra" name="Crear otra línea" disabled={busy} onClick={create} />
          </div>
        </>
      ) : (
        <>
          <span className="rd-note">Tu agente lee un link, se presenta y empieza a escribir tu repo. Antes te muestra qué va a compartir.</span>
          <div className="rd-actions">
            <RowButton label={busy ? 'Creando…' : 'Crear la línea'} disabled={busy} onClick={create} />
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
