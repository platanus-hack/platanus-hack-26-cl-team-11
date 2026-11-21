import type { Team } from './api';

export function TeamWorld({ token, team }: { token: string; team: Team }) {
  const state = `/api/people/${encodeURIComponent(token)}/teams/${encodeURIComponent(team.id)}/world`;
  return <iframe className="app-world" title={`Los agentes de ${team.name} conversando`} src={`/design/grafo/sala.html?v=2&estado=${encodeURIComponent(state)}`} loading="lazy" />;
}
