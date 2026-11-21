import { useCallback, useState } from 'react';
import { fetchAgents, startRound, type AgentsView } from './api';
import { AskRow } from './AskRow';
import { formatWhen } from './format';
import { ProposalRow } from './ProposalRow';
import { RowButton } from './RowButton';
import { SectionHead } from './SectionHead';
import { ThreadRow } from './ThreadRow';
import { useAction } from './useAction';
import { usePolling } from './usePolling';

function statusOf(view: AgentsView) {
  if (!view.configured) return 'Faltan las credenciales del modelo en el servidor.';
  if (!view.round) return 'Todavía no hay rondas. En una ronda, los agentes del equipo conversan y dejan propuestas.';
  if (view.round.status === 'en_curso') return 'Los agentes están conversando.';
  const when = `Última ronda: ${formatWhen(view.round.finishedAt ?? view.round.startedAt)}`;
  return view.round.problem ? `${when}. ${view.round.problem}` : when;
}

export function RoundSection({ token, teamId }: { token: string; teamId: string }) {
  const [view, setView] = useState<AgentsView | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const { busy, error: startError, run } = useAction();

  const load = useCallback(async () => setView(await fetchAgents(token, teamId)), [token, teamId]);
  const { error, refresh } = usePolling(load);

  const start = () =>
    void run(async () => {
      await startRound(token, teamId);
      await refresh();
    });

  const running = view?.round?.status === 'en_curso';
  const problem = startError ?? error;

  return (
    <>
      <div className="app-block">
        <SectionHead
          title="Ronda de agentes"
          end={view?.configured ? <RowButton label={running ? 'En curso…' : 'Iniciar ronda'} disabled={busy || running} onClick={start} /> : undefined}
        />
        <p className="rd-note" role="status">
          {view ? statusOf(view) : 'Cargando…'}
        </p>
        {problem && (
          <p className="rd-note" role="alert">
            {problem}
          </p>
        )}
        {view && (view.asks.length > 0 || view.proposals.length > 0) && (
          <div className="rd-list">
            {view.asks.map((ask) => (
              <AskRow key={ask.topic} token={token} ask={ask} onChange={refresh} />
            ))}
            {view.proposals.map((proposal) => (
              <ProposalRow key={proposal.id} token={token} proposal={proposal} onChange={refresh} />
            ))}
          </div>
        )}
      </div>
      {view && view.threads.length > 0 && (
        <div className="app-block">
          <SectionHead title="Conversaciones de la última ronda" />
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
