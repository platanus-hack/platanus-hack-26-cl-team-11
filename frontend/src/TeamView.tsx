import type { Team } from './api';
import { RoundSection } from './RoundSection';
import { TeamOverviewSection } from './TeamOverviewSection';

interface TeamViewProps {
  token: string;
  team: Team;
  first: boolean;
}

export function TeamView({ token, team, first }: TeamViewProps) {
  return (
    <>
      <TeamOverviewSection token={token} team={team} first={first} />
      <RoundSection token={token} teamId={team.id} />
    </>
  );
}
