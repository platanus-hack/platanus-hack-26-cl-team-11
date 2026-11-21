import { useCallback, useState } from 'react';
import { formatAgo } from './ago';
import { AssistantLogo } from './AssistantLogo';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { PairingLine } from './PairingLine';
import { PasteBack } from './PasteBack';
import { RepoFileRow } from './RepoFileRow';
import { fetchAssistants, fetchRepo, removeAssistant, type Assistant, type RepoEntry } from './roomApi';
import { RowButton } from './RowButton';
import { SectionHead } from './SectionHead';
import { useAction } from './useAction';
import { usePolling } from './usePolling';

type Way = 'link' | 'chat';

export function AgentTab({ token }: { token: string }) {
  const [assistants, setAssistants] = useState<Assistant[] | null>(null);
  const [files, setFiles] = useState<RepoEntry[] | null>(null);
  const [way, setWay] = useState<Way | null>('link');
  const [openPath, setOpenPath] = useState<string | null>(null);
  const { busy, error: removeError, run } = useAction();

  const load = useCallback(async () => {
    const [connected, repo] = await Promise.all([fetchAssistants(token), fetchRepo(token)]);
    setAssistants(connected.assistants);
    setFiles(repo.files);
  }, [token]);
  const { error, refresh } = usePolling(load);
  const reload = () => void refresh();

  const toggleWay = (next: Way) => setWay((current) => (current === next ? null : next));
  const remove = (assistant: Assistant) =>
    void run(async () => {
      await removeAssistant(token, assistant.id);
      await refresh();
    });

  return (
    <>
      <div className="app-block">
        <SectionHead first title="Tu agente" />
        {(error ?? removeError) && (
          <p className="rd-note" role="alert">
            {error ?? removeError}
          </p>
        )}
        {assistants?.length === 0 && <p className="rd-note">Conecta el agente que ya usas. Le cuenta a Montu en qué trabajas y qué necesitas, y tú decides qué se comparte.</p>}
        {assistants && assistants.length > 0 && (
          <div className="rd-list">
            {assistants.map((assistant) => (
              <Item
                key={assistant.id}
                icon={<AssistantLogo kind={assistant.kind} />}
                title={
                  <>
                    {assistant.label}
                    <span className="rd-dot" />
                  </>
                }
                subtitle={assistant.lastSeenAt ? `Activo ${formatAgo(assistant.lastSeenAt, Date.now()).toLowerCase()}` : 'Conectado'}
                end={<RowButton label="Quitar" name={`Quitar ${assistant.label}`} disabled={busy} onClick={() => remove(assistant)} />}
              />
            ))}
          </div>
        )}
      </div>

      <div className="app-block">
        <SectionHead title="Conectar un agente" />
        <div className="rd-list">
          <div>
            <Item
              icon={
                <ItemIcon>
                  <Glyph name="link" />
                </ItemIcon>
              }
              title="Pégale una línea"
              subtitle="Claude Code, Codex, OpenClaw y los que pueden abrir un link"
              expanded={way === 'link'}
              onToggle={() => toggleWay('link')}
            />
            {way === 'link' && (
              <div className="rd-item__detail">
                <PairingLine token={token} connected={assistants?.length ?? 0} />
              </div>
            )}
          </div>
          <div>
            <Item
              icon={
                <ItemIcon>
                  <Glyph name="chat" />
                </ItemIcon>
              }
              title="Es una app de chat"
              subtitle="ChatGPT, Grok o Claude: copias una pregunta y pegas la respuesta"
              expanded={way === 'chat'}
              onToggle={() => toggleWay('chat')}
            />
            {way === 'chat' && (
              <div className="rd-item__detail">
                <PasteBack token={token} onSaved={reload} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="app-block">
        <SectionHead title="Tu repo" />
        {files?.length === 0 && <p className="rd-note">Todavía no hay nada. Aparece cuando tu agente escribe.</p>}
        {files && files.length > 0 && (
          <div className="rd-list">
            {files.map((entry) => (
              <RepoFileRow
                key={entry.path}
                token={token}
                entry={entry}
                open={openPath === entry.path}
                onToggle={() => setOpenPath((current) => (current === entry.path ? null : entry.path))}
                onChange={reload}
              />
            ))}
          </div>
        )}
        <p className="rd-note">Tu agente usa solo lo que está en «Se comparte». Lo que está en «Te pregunta antes» espera a que tú lo cambies, y lo «Privado» no sale de tu repo ni llega a un modelo.</p>
      </div>
    </>
  );
}
