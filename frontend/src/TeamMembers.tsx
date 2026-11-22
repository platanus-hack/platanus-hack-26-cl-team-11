import { useState } from 'react';
import type { Team } from './api';
import { CopyButton } from './CopyButton';
import { Glyph } from './Glyph';
import { InviteRow } from './InviteRow';
import { Item } from './Item';
import { ItemIcon } from './ItemIcon';
import { JoinRequestRow } from './JoinRequestRow';
import { SectionHead } from './SectionHead';
import { TeamPersonRow } from './TeamPersonRow';

interface TeamMembersProps {
  token: string;
  team: Team;
  first: boolean;
  onChange: () => Promise<void>;
}

export function TeamMembers({ token, team, first, onChange }: TeamMembersProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="app-block">
      <SectionHead first={first} title={team.name} />
      <div className="rd-list">
        {team.people.map((person) => (
          <TeamPersonRow
            key={person.id}
            token={token}
            teamId={team.id}
            person={person}
            manage={team.admin}
            open={openId === person.id}
            onToggle={() => setOpenId((current) => (current === person.id ? null : person.id))}
            onChange={onChange}
          />
        ))}
        {team.admin && <InviteRow token={token} team={team} onChange={onChange} />}
        {team.requests.map((request) => (
          <JoinRequestRow key={request.id} token={token} teamId={team.id} request={request} onChange={onChange} />
        ))}
        {team.roomCode ? (
          <Item
            icon={
              <ItemIcon>
                <Glyph name="map" />
              </ItemIcon>
            }
            title="Pantalla de la sala"
            subtitle="El QR para entrar y quiénes están"
            href={`/sala/${encodeURIComponent(team.roomCode)}`}
          />
        ) : (
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
        )}
      </div>
      {team.roomCode && <p className="rd-note">Es una sala abierta: entra quien escanea su QR.</p>}
    </div>
  );
}
