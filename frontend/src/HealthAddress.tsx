import type { SourceSync } from './api';
import { CopyButton } from './CopyButton';
import { countOf } from './format';

export function HealthAddress({ url, sync }: { url: string; sync: SourceSync | null }) {
  return (
    <>
      <span className="rd-note">Tu Atajo de iOS envía tus datos a esta dirección. Es personal: no la compartas.</span>
      <span className="rd-code">{url}</span>
      <div className="rd-actions">
        <CopyButton text={url} label="Copiar la dirección" />
      </div>
      {sync && <span className="rd-note">{countOf(sync.total, 'registro recibido', 'registros recibidos')}</span>}
    </>
  );
}
