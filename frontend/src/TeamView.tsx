import type { Team } from './api';
import { BoardSection } from './BoardSection';
import { RoundSection } from './RoundSection';
import { TeamOverviewSection } from './TeamOverviewSection';

interface TeamViewProps {
  token: string;
  team: Team;
  first: boolean;
  onChange: () => Promise<void>;
}

export function TeamView({ token, team, first, onChange }: TeamViewProps) {
  return (
    <>
      <TeamOverviewSection token={token} team={team} first={first} onChange={onChange} />
      <RoundSection token={token} teamId={team.id} />
      <BoardSection token={token} teamId={team.id} />
    </>
  );
}
