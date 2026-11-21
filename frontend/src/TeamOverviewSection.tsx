import { useCallback, useState, type CSSProperties } from 'react';
import { fetchTeamOverview, type LevelSignal, type OverviewMember, type Team, type TeamOverview, type TeamValue } from './api';
import { Face } from './Face';
import { SectionHead } from './SectionHead';
import { TeamWorld } from './TeamWorld';
import { usePolling } from './usePolling';
import { Vital } from './Vital';

const LEVEL_LABEL: Record<LevelSignal['level'], string> = { baja: 'Baja', media: 'Media', alta: 'Alta', sin_datos: 'Sin datos' };
const LEVEL_FILL: Record<LevelSignal['level'], number> = { baja: 33, media: 66, alta: 100, sin_datos: 0 };
const FULL_NIGHT_HOURS = 8;
const STEP_GOAL_EACH = 8000;
const PRIVATE = 'Privado';
const NO_DATA = 'Sin datos';

const hours = (value: number) => `${value.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
const among = (value: TeamValue<unknown>) => (value.available ? `Entre ${value.contributors} personas` : `Faltan datos de ${value.needed} personas`);
const levelOf = (level: LevelSignal['level'] | null) => (level === null ? PRIVATE : LEVEL_LABEL[level]);

function doingOf(member: OverviewMember) {
  if (member.working) return `Trabaja en «${member.working}»`;
  if (member.topics.length > 0) return `Anda en ${member.topics.join(', ')}`;
  return null;
}

function Stat({ tint, label, value }: { tint: string; label: string; value: string }) {
  return (
    <span className={`rd-persona__stat rd-tint--${tint}`}>
      <span className="rd-persona__label">{label}</span>
      <span className={`rd-persona__value${value === PRIVATE || value === NO_DATA ? ' rd-persona__value--off' : ''}`}>{value}</span>
    </span>
  );
}

function PersonCard({ member, order }: { member: OverviewMember; order: number }) {
  const hidden = member.shares ? NO_DATA : PRIVATE;
  const moved = member.workoutMinutes !== null ? `${Math.round(member.workoutMinutes)} min` : member.steps !== null ? Math.round(member.steps).toLocaleString('es-CL') : hidden;

  return (
    <div className="rd-persona rd-glass" style={{ '--i': order } as CSSProperties}>
      <div className="rd-persona__head">
        <Face name={member.name} />
        <span className="rd-persona__who">
          <span className="rd-persona__name">{member.me ? `${member.name} · tú` : member.name}</span>
          {doingOf(member) && <span className="rd-persona__doing">{doingOf(member)}</span>}
        </span>
      </div>
      <div className="rd-persona__stats">
        <Stat tint="energy" label="Energía" value={levelOf(member.energy)} />
        <Stat tint="load" label="Carga" value={levelOf(member.load)} />
        <Stat tint="sleep" label="Sueño" value={member.sleepHours !== null ? hours(member.sleepHours) : hidden} />
        <Stat tint="move" label={member.workoutMinutes !== null ? 'Deporte' : 'Pasos'} value={moved} />
      </div>
    </div>
  );
}

export function TeamOverviewSection({ token, team, first }: { token: string; team: Team; first: boolean }) {
  const [overview, setOverview] = useState<TeamOverview | null>(null);

  const load = useCallback(async () => setOverview(await fetchTeamOverview(token, team.id)), [token, team.id]);
  const { error } = usePolling(load);

  return (
    <div className="app-block">
      <SectionHead first={first} title={team.name} />
      <TeamWorld token={token} team={team} />
      {error && (
        <p className="rd-note" role="alert">
          {error}
        </p>
      )}
      {overview && (
        <>
          <div className="rd-vitals">
            <Vital kind="energy" glyph="energy" label="Energía del equipo" text={overview.energy.available ? LEVEL_LABEL[overview.energy.value] : NO_DATA} note={among(overview.energy)} fill={overview.energy.available ? LEVEL_FILL[overview.energy.value] : 0} order={0} />
            {overview.sleepHours.available ? (
              <Vital kind="sleep" glyph="sleep" label="Sueño promedio" amount={overview.sleepHours.value} decimals={1} unit="h" note={among(overview.sleepHours)} fill={(overview.sleepHours.value / FULL_NIGHT_HOURS) * 100} order={1} />
            ) : (
              <Vital kind="sleep" glyph="sleep" label="Sueño promedio" text={NO_DATA} note={among(overview.sleepHours)} fill={0} order={1} />
            )}
            {overview.steps.available ? (
              <Vital kind="move" glyph="move" label="Pasos del equipo" amount={overview.steps.value} note={`Sumados hoy, entre ${overview.steps.contributors} personas`} fill={(overview.steps.value / (STEP_GOAL_EACH * overview.steps.contributors)) * 100} order={2} />
            ) : (
              <Vital kind="move" glyph="move" label="Pasos del equipo" text={NO_DATA} note={among(overview.steps)} fill={0} order={2} />
            )}
          </div>
          <div className="rd-people">
            {overview.members.map((member, position) => (
              <PersonCard key={position} member={member} order={position} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
