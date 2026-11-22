import { useCallback, useState } from 'react';
import { AgentConnect } from './AgentConnect';
import { fetchAssistants, type Assistant } from './roomApi';
import { SectionHead } from './SectionHead';
import { usePolling } from './usePolling';

export function YourAgentSection({ token }: { token: string }) {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const load = useCallback(async () => setAssistants((await fetchAssistants(token)).assistants), [token]);
  const { refresh } = usePolling(load);

  return (
    <div className="app-block">
      <SectionHead title="Tu agente" />
      <AgentConnect token={token} assistants={assistants} onChange={() => void refresh()} />
    </div>
  );
}
