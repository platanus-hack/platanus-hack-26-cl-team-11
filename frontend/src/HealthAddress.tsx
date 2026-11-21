import { useEffect, useState } from 'react';
import type { Delivery, HealthShortcut, SourceSync } from './api';
import { CopyButton } from './CopyButton';
import { countOf, formatWhen } from './format';

const OWN_SHORTCUT_NOTE = 'Tu Atajo de iOS envía tus datos a esta dirección. Es personal: no la compartas.';
const SHARED_SHORTCUT_NOTE = 'Si armas tu propio Atajo, envía a esta dirección. Es personal: no la compartas.';
const SENT_AT_KEY = 'ronda.salud.enviado';
const WAIT_MS = 120_000;
const CHECK_EVERY_MS = 2000;
const CLOCK_SLACK_MS = 5000;
export const HEALTH_RETURN_PARAM = 'salud';

const returnUrl = () => `${window.location.origin}${window.location.pathname}?${HEALTH_RETURN_PARAM}=1#fuentes`;

const runUrlOf = (shortcutName: string, ingestUrl: string) => {
  const back = encodeURIComponent(returnUrl());
  return `shortcuts://x-callback-url/run-shortcut?name=${encodeURIComponent(shortcutName)}&input=text&text=${encodeURIComponent(ingestUrl)}&x-success=${back}&x-cancel=${back}&x-error=${back}`;
};

function readSentAt(): number | null {
  try {
    const stored = Number(window.localStorage.getItem(SENT_AT_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

function rememberSentAt(instant: number) {
  try {
    window.localStorage.setItem(SENT_AT_KEY, String(instant));
  } catch {
    return;
  }
}

interface HealthAddressProps {
  url: string;
  sync: SourceSync | null;
  delivery: Delivery | null;
  shortcut: HealthShortcut | null;
  onCheck: () => void;
}

export function HealthAddress({ url, sync, delivery, shortcut, onCheck }: HealthAddressProps) {
  const [sentAt, setSentAt] = useState<number | null>(readSentAt);
  const [now, setNow] = useState(() => Date.now());

  const arrived = sentAt !== null && delivery !== null && Date.parse(delivery.at) >= sentAt - CLOCK_SLACK_MS;
  const waiting = sentAt !== null && !arrived && now - sentAt < WAIT_MS;
  const gaveUp = sentAt !== null && !arrived && !waiting;

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      onCheck();
    }, CHECK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [waiting, onCheck]);

  function sent() {
    const instant = Date.now();
    rememberSentAt(instant);
    setSentAt(instant);
    setNow(instant);
  }

  return (
    <>
      {shortcut && (
        <>
          <span className="rd-note">En tu iPhone, agrega el Atajo una sola vez. Después toca «Enviar datos» y llegan tu sueño, tus pasos y tu energía activa de los últimos días.</span>
          <span className="rd-note">La primera vez, iOS pregunta si el Atajo puede leer Salud y enviar esos datos a Ronda. Elige «Permitir siempre». El número que muestra es cuántos registros van.</span>
          <div className="rd-actions">
            <a className="rd-button rd-button--quiet rd-button--small app-link" href={shortcut.url} target="_blank" rel="noreferrer">
              Agregar Atajo
            </a>
            <a className="rd-button rd-button--quiet rd-button--small app-link" href={runUrlOf(shortcut.name, url)} onClick={sent}>
              Enviar datos
            </a>
          </div>
        </>
      )}
      {waiting && (
        <span className="rd-note" role="status">
          Esperando tus datos… El Atajo puede tardar hasta un minuto en leer Salud.
        </span>
      )}
      {gaveUp && (
        <span className="rd-note" role="alert">
          No llegó ningún envío. Abre el Atajo, revisa si mostró un error y toca «Enviar datos» otra vez.
        </span>
      )}
      {delivery && !waiting && (
        <span className="rd-note app-wrap" role={delivery.ok ? 'status' : 'alert'}>
          {formatWhen(delivery.at)} · {delivery.message}
        </span>
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
