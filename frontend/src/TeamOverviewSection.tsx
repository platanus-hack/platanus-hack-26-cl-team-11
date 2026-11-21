import { useCallback, useState } from 'react';
import { fetchTeamOverview, type LevelSignal, type OverviewMember, type Team, type TeamOverview, type TeamValue } from './api';
import { TeamMembers } from './TeamMembers';
import { TeamWorld } from './TeamWorld';
import { usePolling } from './usePolling';
import { Vital } from './Vital';

const LEVEL_LABEL: Record<LevelSignal['level'], string> = { baja: 'Baja', media: 'Media', alta: 'Alta', sin_datos: 'Sin datos' };
const LEVEL_FILL: Record<LevelSignal['level'], number> = { baja: 33, media: 66, alta: 100, sin_datos: 0 };
const FULL_NIGHT_HOURS = 8;
const STEP_GOAL_EACH = 8000;

const hours = (value: number) => value.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const among = (value: TeamValue<unknown>) => (value.available ? `Entre ${value.contributors} personas` : `Faltan datos de ${value.needed} personas`);

function sharedOf(member: OverviewMember) {
  if (!member.shares) return 'No comparte sus datos';
  const parts = [
    member.energy && member.energy !== 'sin_datos' ? `Energía ${LEVEL_LABEL[member.energy].toLowerCase()}` : null,
    member.sleepHours !== null ? `${hours(member.sleepHours)} h de sueño` : null,
    member.workoutMinutes !== null ? `${Math.round(member.workoutMinutes)} min de deporte` : member.steps !== null ? `${Math.round(member.steps).toLocaleString('es-CL')} pasos` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Sin datos todavía';
}

interface TeamOverviewSectionProps {
  token: string;
  team: Team;
  first: boolean;
  onChange: () => Promise<void>;
}

export function TeamOverviewSection({ token, team, first, onChange }: TeamOverviewSectionProps) {
  const [overview, setOverview] = useState<TeamOverview | null>(null);

  const load = useCallback(async () => setOverview(await fetchTeamOverview(token, team.id)), [token, team.id]);
  const { error } = usePolling(load);

  const detailOf = (position: number, name: string) => {
    const member = overview?.members[position];
    return member && member.name === name ? { shared: sharedOf(member) } : {};
  };

  const top = (
    <>
      <TeamWorld token={token} team={team} />
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
      {overview && (
        <div className="rd-vitals">
          <Vital kind="energy" glyph="energy" label="Energía del equipo" text={overview.energy.available ? LEVEL_LABEL[overview.energy.value] : 'Sin datos'} note={among(overview.energy)} fill={overview.energy.available ? LEVEL_FILL[overview.energy.value] : 0} order={0} />
          {overview.sleepHours.available ? (
            <Vital kind="sleep" glyph="sleep" label="Sueño promedio" amount={overview.sleepHours.value} decimals={1} unit="h" note={among(overview.sleepHours)} fill={(overview.sleepHours.value / FULL_NIGHT_HOURS) * 100} order={1} />
          ) : (
            <Vital kind="sleep" glyph="sleep" label="Sueño promedio" text="Sin datos" note={among(overview.sleepHours)} fill={0} order={1} />
          )}
          {overview.steps.available ? (
            <Vital kind="move" glyph="move" label="Pasos del equipo" amount={overview.steps.value} note={`Sumados hoy, entre ${overview.steps.contributors} personas`} fill={(overview.steps.value / (STEP_GOAL_EACH * overview.steps.contributors)) * 100} order={2} />
          ) : (
            <Vital kind="move" glyph="move" label="Pasos del equipo" text="Sin datos" note={among(overview.steps)} fill={0} order={2} />
          )}
        </div>
      )}
    </>
  );

  const bottom = <p className="rd-note">De cada persona ves solo lo que eligió compartir en Ajustes. Los números del equipo necesitan al menos tres personas.</p>;

  return <TeamMembers token={token} team={team} first={first} top={top} bottom={bottom} detailOf={detailOf} onChange={onChange} />;
}
