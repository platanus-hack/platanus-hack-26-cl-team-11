import type { Team } from './api';
import { CopyButton } from './CopyButton';
import { Face } from './Face';
import { countOf } from './format';
import { Glyph } from './Glyph';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { JoinRequestRow } from './JoinRequestRow';
import { SectionHead } from './SectionHead';

interface TeamMembersProps {
  token: string;
  team: Team;
  first: boolean;
  onChange: () => Promise<void>;
}

export function TeamMembers({ token, team, first, onChange }: TeamMembersProps) {
  return (
    <div className="app-block">
      <SectionHead first={first} title={team.name} status={countOf(team.members.length, 'persona', 'personas')} />
      <div className="rd-list">
        {team.members.map((name, position) => (
          <Item key={position} icon={<Face name={name} />} title={name} />
        ))}
        {team.requests.map((request) => (
          <JoinRequestRow key={request.id} token={token} teamId={team.id} request={request} onChange={onChange} />
        ))}
        <Item
          icon={
            <ItemIcon>
              <Glyph name="key" />
            </ItemIcon>
          }
          title="Código para entrar"
          subtitle={team.joinCode}
          end={<CopyButton text={team.joinCode} label="Copiar el código" />}
        />
      </div>
      <p className="rd-note">Comparte el código solo con quienes son parte del equipo. Cada ingreso lo aprueba todo el equipo.</p>
    </div>
  );
}
