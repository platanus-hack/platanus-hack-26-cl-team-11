import { useCallback, useState } from 'react';
import { RepoFileRow } from './RepoFileRow';
import { fetchRepo, type RepoEntry } from './roomApi';
import { SectionHead } from './SectionHead';
import { usePolling } from './usePolling';

export function RepoSection({ token }: { token: string }) {
  const [files, setFiles] = useState<RepoEntry[] | null>(null);
  const [openPath, setOpenPath] = useState<string | null>(null);

  const load = useCallback(async () => setFiles((await fetchRepo(token)).files), [token]);
  const { refresh } = usePolling(load);

  if (!files || files.length === 0) return null;

  return (
    <div className="app-block">
      <SectionHead title="Lo que escribió tu agente" />
      <div className="rd-list">
        {files.map((entry) => (
          <RepoFileRow key={entry.path} token={token} entry={entry} open={openPath === entry.path} onToggle={() => setOpenPath((current) => (current === entry.path ? null : entry.path))} onChange={() => void refresh()} />
        ))}
      </div>
      <p className="rd-note">Tu agente usa solo lo que está en «Se comparte». Lo que está en «Te pregunta antes» espera a que tú lo cambies, y lo «Privado» no sale de aquí ni llega a un modelo.</p>
    </div>
  );
}
