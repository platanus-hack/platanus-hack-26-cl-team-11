import { useCallback, useState } from 'react';
import { fetchAgents, type AgentsView } from './api';
import { AskRow } from './AskRow';
import { ProposalRow } from './ProposalRow';
import { SectionHead } from './SectionHead';
import { ThreadRow } from './ThreadRow';
import { usePolling } from './usePolling';

export function RoundSection({ token, teamId }: { token: string; teamId: string }) {
  const [view, setView] = useState<AgentsView | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);

  const load = useCallback(async () => setView(await fetchAgents(token, teamId)), [token, teamId]);
  const { error, refresh } = usePolling(load);

  const problem = error;

  const pending = view ? view.asks.length + view.proposals.length : 0;

  return (
    <>
      {view && pending > 0 && (
        <div className="app-block">
          <SectionHead title="Te toca decidir" />
          {problem && (
            <p className="rd-note" role="alert">
              {problem}
            </p>
          )}
          <div className="rd-list">
            {view.asks.map((ask) => (
              <AskRow key={ask.topic} token={token} ask={ask} onChange={refresh} />
            ))}
            {view.proposals.map((proposal) => (
              <ProposalRow key={proposal.id} token={token} proposal={proposal} onChange={refresh} />
            ))}
          </div>
        </div>
      )}
      {view && view.threads.length > 0 && (
        <div className="app-block">
          <SectionHead title="Lo que conversaron sus agentes" />
          <div className="rd-list">
            {view.threads.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                open={openThread === thread.id}
                onToggle={() => setOpenThread((current) => (current === thread.id ? null : thread.id))}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
