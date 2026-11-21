import { useCallback, useState } from 'react';
import { fetchMesa, type MesaView } from './api';
import { AskRow } from './AskRow';
import { ProposalRow } from './ProposalRow';
import { SectionHead } from './SectionHead';
import { usePolling } from './usePolling';

const REFRESH_MS = 5000;

export function MesaSection({ token }: { token: string }) {
  const [view, setView] = useState<MesaView | null>(null);
  const load = useCallback(async () => setView(await fetchMesa(token)), [token]);
  const { refresh } = usePolling(load, REFRESH_MS);

  if (!view || (view.asks.length === 0 && view.proposals.length === 0)) return null;

  return (
    <div className="app-block">
      <SectionHead title="Para ti" />
      <div className="rd-list">
        {view.asks.map((ask) => (
          <AskRow key={ask.topic} token={token} ask={ask} onChange={refresh} />
        ))}
        {view.proposals.map((proposal) => (
          <ProposalRow key={proposal.id} token={token} proposal={proposal} onChange={refresh} />
        ))}
      </div>
    </div>
  );
}
