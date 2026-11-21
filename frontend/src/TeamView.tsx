import type { Team } from './api';
import { BoardSection } from './BoardSection';
import { PulseSection } from './PulseSection';
import { RoundSection } from './RoundSection';
import { TeamMembers } from './TeamMembers';

interface TeamViewProps {
  token: string;
  team: Team;
  first: boolean;
  onChange: () => Promise<void>;
}

export function TeamView({ token, team, first, onChange }: TeamViewProps) {
  return (
    <>
      <TeamMembers token={token} team={team} first={first} onChange={onChange} />
      <RoundSection token={token} teamId={team.id} />
      <PulseSection token={token} teamId={team.id} />
      <BoardSection token={token} teamId={team.id} />
    </>
  );
}
