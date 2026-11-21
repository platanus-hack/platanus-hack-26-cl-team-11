import type { HealthShortcut, SourceSync } from './api';
import { CopyButton } from './CopyButton';
import { countOf } from './format';

const OWN_SHORTCUT_NOTE = 'Tu Atajo de iOS envía tus datos a esta dirección. Es personal: no la compartas.';
const SHARED_SHORTCUT_NOTE = 'Si armas tu propio Atajo, envía a esta dirección. Es personal: no la compartas.';

const runUrlOf = (shortcutName: string, ingestUrl: string) => `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}&input=text&text=${encodeURIComponent(ingestUrl)}`;

export function HealthAddress({ url, sync, shortcut }: { url: string; sync: SourceSync | null; shortcut: HealthShortcut | null }) {
  return (
    <>
      {shortcut && (
        <>
          <span className="rd-note">En tu iPhone, agrega el Atajo una sola vez. Después toca «Enviar datos» y llegan tu sueño, tus pasos y tu pulso de los últimos días.</span>
          <div className="rd-actions">
            <a className="rd-button rd-button--quiet rd-button--small app-link" href={shortcut.url} target="_blank" rel="noreferrer">
              Agregar Atajo
            </a>
            <a className="rd-button rd-button--quiet rd-button--small app-link" href={runUrlOf(shortcut.name, url)}>
              Enviar datos
            </a>
          </div>
        </>
      )}
      <span className="rd-note">{shortcut ? SHARED_SHORTCUT_NOTE : OWN_SHORTCUT_NOTE}</span>
      <span className="rd-code">{url}</span>
      <div className="rd-actions">
        <CopyButton text={url} label="Copiar la dirección" />
      </div>
      {sync && <span className="rd-note">{countOf(sync.total, 'registro recibido', 'registros recibidos')}</span>}
    </>
  );
}
