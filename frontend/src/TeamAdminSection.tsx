import { useCallback, useState } from 'react';
import { fetchTeams, type Team } from './api';
import { TeamMembers } from './TeamMembers';
import { usePolling } from './usePolling';

export function TeamAdminSection({ token }: { token: string }) {
  const [teams, setTeams] = useState<Team[]>([]);

  const load = useCallback(async () => setTeams((await fetchTeams(token)).teams), [token]);
  const { refresh } = usePolling(load);

  return (
    <>
      {teams.map((team) => (
        <TeamMembers key={team.id} token={token} team={team} first={false} onChange={refresh} />
      ))}
    </>
  );
}
