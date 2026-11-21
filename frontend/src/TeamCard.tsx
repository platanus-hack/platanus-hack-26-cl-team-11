import type { Team } from './api';
import { countOf } from './format';
import { JoinRequestRow } from './JoinRequestRow';
import { PersonTag } from './PersonTag';

export function TeamCard({ token, team, onChange }: { token: string; team: Team; onChange: () => Promise<void> }) {
  return (
    <section className="rd-card rd-glass">
      <span className="rd-label">Tu equipo</span>
      <h2 className="rd-title app-wrap">{team.name}</h2>
      <span className="rd-note">{countOf(team.members.length, 'persona', 'personas')}</span>
      <div className="app-people">
        {team.members.map((name, position) => (
          <PersonTag key={position} name={name} />
        ))}
      </div>
      {team.requests.length > 0 && <span className="rd-label">Quieren entrar</span>}
      {team.requests.map((request) => (
        <JoinRequestRow key={request.id} token={token} teamId={team.id} request={request} onChange={onChange} />
      ))}
      <span className="rd-label">Código para entrar</span>
      <span className="rd-code">{team.joinCode}</span>
      <p className="rd-note">Compártelo solo con quienes son parte del equipo. Cada ingreso lo aprueba todo el equipo.</p>
    </section>
  );
}
