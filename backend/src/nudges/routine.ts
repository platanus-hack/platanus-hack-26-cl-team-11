import { cardDepsFrom } from '../agents/deps.js';
import type { AppContext } from '../context.js';
import { openLoginStore } from '../logins.js';
import { MESA_TEAM_ID } from '../mesa/store.js';
import { oncePerDatabase } from '../pg/database.js';
import { withChosenVisibility } from '../policy/store.js';
import { DEFAULT_TIME_ZONE, dayKeyOf, deriveSignals } from '../signals.js';
import { groupNudges, NUDGE_KINDS, personalNudges, withoutDemo, type GroupView, type MemberView, type Nudge } from './detectors.js';
import { openNudgeStore } from './store.js';

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const FIRST_RUN_AFTER_MS = 3 * 60 * 1000;
const FIRST_HOUR = 9;
const LAST_HOUR = 19;
const SATURDAY = 6;
const SUNDAY = 0;
export const MAX_NUDGES_PER_DAY = 3;
const RECENT_PROPOSALS = 40;
const LINEAR = 'linear';

const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: DEFAULT_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' });
const loginsOf = oncePerDatabase(openLoginStore);
const nudgesOf = oncePerDatabase(openNudgeStore);

export const isWorkingTime = (now: Date): boolean => {
  const hour = Number(hourFormat.format(now));
  const weekday = new Date(`${dayKeyOf(now)}T12:00:00Z`).getUTCDay();
  return weekday !== SATURDAY && weekday !== SUNDAY && hour >= FIRST_HOUR && hour < LAST_HOUR;
};

export function privateGroupsOf(ctx: AppContext, now: Date): GroupView[] {
  const policies = cardDepsFrom(ctx).policies;
  const logins = loginsOf(ctx.db);
  const joined = ctx.db.prepare('SELECT person_token, joined_at FROM team_members WHERE team_id = ?');
  const teams = new Map(
    ctx.store
      .listPeople()
      .filter((person) => !ctx.sim.isSynthetic(person.token))
      .flatMap((person) => ctx.teams.teamsOf(person.token))
      .filter((team) => team.id !== MESA_TEAM_ID && !ctx.rooms.roomOfTeam(team.id))
      .map((team) => [team.id, team] as const),
  );
  const views = new Map<string, Omit<MemberView, 'joinedAt'>>();
  const viewOf = (member: { token: string; name: string }) => {
    const known = views.get(member.token);
    if (known) return known;
    const events = withoutDemo(ctx.store.listSignalEvents(member.token, now));
    const emails = [logins.loginOf(member.token)?.email, ctx.store.findConnection(member.token, LINEAR)?.account].flatMap((email) => (email ? [email.toLowerCase()] : []));
    const view = { token: member.token, name: member.name, emails, events, signals: withChosenVisibility(deriveSignals(events, now), policies.chosen(member.token)) };
    views.set(member.token, view);
    return view;
  };
  return [...teams.values()].map((team) => {
    const joinedAt = new Map((joined.all(team.id) as unknown as Array<{ person_token: string; joined_at: string }>).map((row) => [row.person_token, row.joined_at]));
    const members = ctx.teams
      .membersOf(team.id)
      .filter((member) => !ctx.sim.isSynthetic(member.token))
      .map((member) => ({ ...viewOf(member), joinedAt: joinedAt.get(member.token) ?? null }));
    return { id: team.id, name: team.name, members, proposals: ctx.agents.proposalsOf(team.id, RECENT_PROPOSALS) };
  });
}

export function nudgesFor(groups: GroupView[], now: Date): Nudge[] {
  const members = new Map(groups.flatMap((group) => group.members.map((member) => [member.token, member] as const)));
  const found = [...[...members.values()].flatMap((member) => personalNudges(member, now)), ...groups.flatMap((group) => groupNudges(group, now))];
  return found.sort((left, right) => NUDGE_KINDS.indexOf(left.kind) - NUDGE_KINDS.indexOf(right.kind));
}

export function deliverNudges(ctx: AppContext, now: Date = new Date()): number {
  if (ctx.config.nudges === false || !isWorkingTime(now)) return 0;
  const store = nudgesOf(ctx.db);
  const groups = privateGroupsOf(ctx, now);
  const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  let delivered = 0;
  for (const token of new Set(groups.flatMap((group) => group.members.map((member) => member.token)))) ctx.whatsapp.askPermissions(token);
  for (const nudge of nudgesFor(groups, now)) {
    if (store.countSince(nudge.to, dayStart) >= MAX_NUDGES_PER_DAY) continue;
    if (!store.record(nudge.to, nudge.kind, nudge.ref, now)) continue;
    ctx.whatsapp.notify(nudge.to, nudge.text);
    delivered += 1;
  }
  return delivered;
}

export function startNudgeRoutine(ctx: AppContext, intervalMs: number = DEFAULT_INTERVAL_MS): () => void {
  const run = () => {
    try {
      deliverNudges(ctx);
    } catch (failure) {
      console.error('La rutina de avisos falló.', failure);
    }
  };
  const first = setTimeout(run, Math.min(FIRST_RUN_AFTER_MS, intervalMs));
  first.unref();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
