import { useCallback, useState } from 'react';
import { disconnectWhatsApp, fetchWhatsApp, startWhatsAppLink, type WhatsAppLink, type WhatsAppStatus } from './api';
import { CopyButton } from './CopyButton';
import { Item } from './Item';
import { RowButton } from './RowButton';
import { SectionHead } from './SectionHead';
import { SourceLogo } from './SourceLogo';
import { useAction } from './useAction';
import { usePolling } from './usePolling';

function subtitleOf(status: WhatsAppStatus, link: WhatsAppLink | null) {
  if (status.linked) return `Conectado · termina en ${status.phoneEnding ?? ''}`;
  if (link) return `Mándale el código ${link.code} al WhatsApp de Ronda`;
  return 'Tu agente te lee y te escribe por aquí';
}

export function WhatsAppSection({ token }: { token: string }) {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [link, setLink] = useState<WhatsAppLink | null>(null);
  const { busy, error, run } = useAction();

  const load = useCallback(async () => setStatus(await fetchWhatsApp(token)), [token]);
  const { refresh } = usePolling(load);

  if (!status?.configured) return null;

  const connect = () => void run(async () => setLink(await startWhatsAppLink(token)));
  const disconnect = () =>
    void run(async () => {
      setStatus(await disconnectWhatsApp(token));
      setLink(null);
      await refresh();
    });

  const action = status.linked ? (
    <RowButton label="Desconectar" name="Desconectar WhatsApp" disabled={busy} onClick={disconnect} />
  ) : !link ? (
    <RowButton label="Conectar" name="Conectar WhatsApp" disabled={busy} onClick={connect} />
  ) : link.url ? (
    <a className="rd-button rd-button--quiet rd-button--small app-link" href={link.url} target="_blank" rel="noreferrer">
      Abrir WhatsApp
    </a>
  ) : (
    <CopyButton text={link.code} label="Copiar el código" />
  );

  return (
    <div className="app-block">
      <SectionHead title="WhatsApp" />
      <div className="rd-list">
        <Item icon={<SourceLogo id="whatsapp" />} title="Hablar con tu agente" subtitle={subtitleOf(status, link)} end={action} />
      </div>
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
