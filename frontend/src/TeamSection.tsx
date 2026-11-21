import { useCallback, useState } from 'react';
import { fetchTeams, type Team, type TeamSummary } from './api';
import { PendingTeamCard } from './PendingTeamCard';
import { TeamStart } from './TeamStart';
import { TeamView } from './TeamView';
import { usePolling } from './usePolling';

interface TeamList {
  teams: Team[];
  pending: TeamSummary[];
}

export function TeamSection({ token }: { token: string }) {
  const [list, setList] = useState<TeamList | null>(null);

  const load = useCallback(async () => setList(await fetchTeams(token)), [token]);
  const { error, refresh } = usePolling(load);

  if (!list) {
    return (
      <section className="rd-card rd-glass">
        <span className="rd-label">Tu equipo</span>
        <p className="rd-note" role={error ? 'alert' : undefined}>
          {error ?? 'Cargando…'}
        </p>
      </section>
    );
  }

  return (
    <>
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
      {list.pending.map((team) => (
        <PendingTeamCard key={team.id} token={token} team={team} onChange={refresh} />
      ))}
      {list.teams.length === 0 && list.pending.length === 0 && <TeamStart token={token} onChange={refresh} />}
      {list.teams.map((team) => (
        <TeamView key={team.id} token={token} team={team} onChange={refresh} />
      ))}
    </>
  );
}
