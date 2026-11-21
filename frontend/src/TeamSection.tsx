import { useCallback, useState } from 'react';
import { fetchTeams, type Team, type TeamSummary } from './api';
import { PendingTeamRow } from './PendingTeamRow';
import { SectionHead } from './SectionHead';
import { TeamStart } from './TeamStart';
import { TeamView } from './TeamView';
import { usePolling } from './usePolling';
import { MontuInline } from './MontuLoader';

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
      <div className="app-block">
        <SectionHead first title="Equipo" />
        <p className="rd-note" role={error ? 'alert' : undefined}>
          {error ?? <MontuInline />}
        </p>
      </div>
    );
  }

  const waiting = list.pending.length > 0;

  return (
    <>
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
      {waiting && (
        <div className="app-block">
          <SectionHead first title="Tus solicitudes" />
          <div className="rd-list">
            {list.pending.map((team) => (
              <PendingTeamRow key={team.id} token={token} team={team} onChange={refresh} />
            ))}
          </div>
          <p className="rd-note">Quedas dentro cuando cada integrante del equipo lo apruebe desde su página.</p>
        </div>
      )}
      {list.teams.length === 0 && !waiting && <TeamStart token={token} onChange={refresh} />}
      {list.teams.map((team, position) => (
        <TeamView key={team.id} token={token} team={team} first={position === 0 && !waiting} />
      ))}
    </>
  );
}
