import type { Team } from './api';
import { BoardCard } from './BoardCard';
import { PulseCard } from './PulseCard';
import { TeamCard } from './TeamCard';

export function TeamView({ token, team, onChange }: { token: string; team: Team; onChange: () => Promise<void> }) {
  return (
    <>
      <TeamCard token={token} team={team} onChange={onChange} />
      <PulseCard token={token} teamId={team.id} />
      <BoardCard token={token} teamId={team.id} />
    </>
  );
}
