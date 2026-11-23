import type { Proposal } from '../agents/store.js';
import { UNOWNED_URGENT_TYPE, type TaskBlocker, type TaskProject } from '../connectors/linear.js';
import { CLOSED_STATES, DAY_MS, DEFAULT_TIME_ZONE, MINUTE_MS, STARTED_STATE, dayKeyOf, daysBetween, instantOf, isFrom, nightsUntil, numberOf, rawOf, textOf, type Signals } from '../signals.js';
import type { StoredEvent } from '../types.js';

export const NUDGE_KINDS = [
  'esperan_por_ti',
  'deadline',
  'se_pisan',
  'sobrecarga',
  'meta_en_riesgo',
  'fecha_movida',
  'fuera_de_prioridad',
  'sin_pausas',
  'reconocimiento',
  'persona_nueva',
  'resumen_semanal',
] as const;
export type NudgeKind = (typeof NUDGE_KINDS)[number];

export interface Nudge {
  to: string;
  kind: NudgeKind;
  ref: string;
  text: string;
}

export interface MemberView {
  token: string;
  name: string;
  emails: string[];
  events: StoredEvent[];
  signals: Signals;
  joinedAt: string | null;
}

export interface GroupView {
  id: string;
  name: string;
  members: MemberView[];
  proposals: Proposal[];
}

const SHORT_NIGHT_HOURS = 6;
const SHORT_NIGHTS_WINDOW_DAYS = 3;
const MIN_SHORT_NIGHTS = 2;
const FULL_DAY_MEETING_MINUTES = 300;
const FULL_DAYS_IN_A_ROW = 3;
const LATE_HOUR = 22;
const EARLY_HOUR = 6;
const LATE_DAYS = 3;
const LATE_WINDOW_DAYS = 7;
const DEADLINE_DAYS = 2;
const QUIET_TASK_DAYS = 2;
const MIN_DATE_MOVES = 2;
const MIN_SHARED_WORDS = 2;
const MIN_OVERLAP = 0.5;
const MIN_WORD_LENGTH = 4;
const SLOT_MINUTES = 30;
const SLOT_SEARCH_HOURS = 48;
const WORKDAY_START_HOUR = 9;
const WORKDAY_END_HOUR = 18;
const PROGRESS_GAP = 0.25;
const PROJECT_HORIZON_DAYS = 30;
const URGENT_PRIORITIES = [1, 2];
const NEW_MEMBER_DAYS = 7;
const THANKS_AFTER_DAYS = 2;
const THANKS_UNTIL_DAYS = 9;
const MAX_LISTED = 3;
const MONDAY = 1;
const SATURDAY = 6;
const SUNDAY = 0;
const PAUSE_LINK = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Bloque%20sin%20reuniones';
const WORD_BOUNDARY = /[^\p{L}\p{N}]+/u;
const COMMON_WORDS = new Set(['para', 'como', 'desde', 'hasta', 'entre', 'sobre', 'esta', 'este', 'with', 'from', 'into', 'that', 'this', 'nueva', 'nuevo', 'agregar', 'crear', 'revisar', 'arreglar', 'actualizar']);

const names = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });
const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: DEFAULT_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' });
const clockFormat = new Intl.DateTimeFormat('es-CL', { timeZone: DEFAULT_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const localHourOf = (instant: number) => Number(hourFormat.format(new Date(instant)));
const weekdayOf = (dayKey: string) => new Date(`${dayKey}T12:00:00Z`).getUTCDay();
const isWeekend = (dayKey: string) => [SATURDAY, SUNDAY].includes(weekdayOf(dayKey));
const dayBefore = (dayKey: string, days: number) => new Date(Date.parse(`${dayKey}T12:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);
const shortDay = (dayKey: string) => `${dayKey.slice(8, 10)}-${dayKey.slice(5, 7)}`;
const percent = (share: number) => `${Math.round(Math.min(1, Math.max(0, share)) * 100)} %`;
const times = (count: number) => (count === 1 ? 'una vez' : `${count} veces`);
const isOpen = (stateType: string | null) => !CLOSED_STATES.includes(stateType ?? '');

export const weekKeyOf = (today: string): string => dayBefore(today, (weekdayOf(today) + 6) % 7);
export const isMonday = (today: string): boolean => weekdayOf(today) === MONDAY;
export const withoutDemo = (events: StoredEvent[]): StoredEvent[] => events.filter((event) => rawOf(event).demo === undefined);

export interface TaskSnapshot {
  identifier: string;
  title: string;
  stateType: string | null;
  priority: number;
  dueDay: string | null;
  updatedAt: number;
  project: TaskProject | null;
  blockedBy: TaskBlocker[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const projectOf = (value: unknown): TaskProject | null => {
  if (!isRecord(value)) return null;
  const id = textOf(value.id);
  const name = textOf(value.name);
  if (!id || !name) return null;
  return { id, name, progress: numberOf(value.progress) ?? 0, startDate: textOf(value.startDate), targetDate: textOf(value.targetDate), leadEmail: textOf(value.leadEmail) };
};

const blockersOf = (value: unknown): TaskBlocker[] =>
  (Array.isArray(value) ? value : []).flatMap((entry): TaskBlocker[] => {
    if (!isRecord(entry)) return [];
    const identifier = textOf(entry.identifier);
    const title = textOf(entry.title);
    return identifier && title ? [{ identifier, title, assigneeEmail: textOf(entry.assigneeEmail), assigneeName: textOf(entry.assigneeName) }] : [];
  });

export function taskHistoryOf(events: StoredEvent[]): Map<string, TaskSnapshot[]> {
  const history = new Map<string, TaskSnapshot[]>();
  for (const event of events) {
    if (!isFrom(event, 'linear', 'tarea')) continue;
    const raw = rawOf(event);
    const identifier = textOf(raw.identifier);
    const updatedAt = instantOf(raw.updatedAt) ?? instantOf(event.occurredAt);
    if (!identifier || updatedAt === null) continue;
    const snapshots = history.get(identifier) ?? [];
    snapshots.push({
      identifier,
      title: textOf(raw.title) ?? identifier,
      stateType: textOf(raw.stateType),
      priority: numberOf(raw.priority) ?? 0,
      dueDay: textOf(raw.dueDate)?.slice(0, 10) ?? null,
      updatedAt,
      project: projectOf(raw.project),
      blockedBy: blockersOf(raw.blockedBy),
    });
    history.set(identifier, snapshots);
  }
  for (const snapshots of history.values()) snapshots.sort((left, right) => left.updatedAt - right.updatedAt);
  return history;
}

export const latestTasksOf = (events: StoredEvent[]): TaskSnapshot[] => [...taskHistoryOf(events).values()].flatMap((snapshots) => snapshots.at(-1) ?? []);

interface Block {
  start: number;
  end: number;
}

const meetingsOf = (events: StoredEvent[]): Block[] =>
  events.flatMap((event): Block[] => {
    if (!isFrom(event, 'google_calendar', 'reunion') || rawOf(event).declined === true) return [];
    const raw = rawOf(event);
    const start = instantOf(raw.start) ?? instantOf(event.occurredAt);
    const minutes = numberOf(raw.durationMinutes);
    return start === null || minutes === null ? [] : [{ start, end: start + minutes * MINUTE_MS }];
  });

const meetingMinutesOn = (meetings: Block[], dayKey: string) => meetings.filter((block) => dayKeyOf(new Date(block.start)) === dayKey).reduce((total, block) => total + (block.end - block.start) / MINUTE_MS, 0);

function overloadOf(member: MemberView, today: string): Nudge[] {
  const short = nightsUntil(member.events, today, DEFAULT_TIME_ZONE).filter((night) => daysBetween(night.day, today) < SHORT_NIGHTS_WINDOW_DAYS && night.hours < SHORT_NIGHT_HOURS);
  if (short.length < MIN_SHORT_NIGHTS || member.signals.load.level !== 'alta') return [];
  return [
    {
      to: member.token,
      kind: 'sobrecarga',
      ref: weekKeyOf(today),
      text: `Llevas ${short.length} noches durmiendo menos de ${SHORT_NIGHT_HOURS} horas y tu carga está alta. Antes de seguir igual, dime qué puedo ayudarte a mover o si le pido ayuda a tu equipo con algo. Esto no sale de tu agente.`,
    },
  ];
}

function noBreaksOf(member: MemberView, today: string, now: Date): Nudge[] {
  const meetings = meetingsOf(member.events);
  const workdays: string[] = [];
  for (let back = 0; workdays.length < FULL_DAYS_IN_A_ROW && back < FULL_DAYS_IN_A_ROW + 4; back += 1) {
    const day = dayBefore(today, back);
    if (!isWeekend(day)) workdays.push(day);
  }
  const fullDays = workdays.every((day) => meetingMinutesOn(meetings, day) >= FULL_DAY_MEETING_MINUTES);
  const lateDays = new Set(
    member.events.flatMap((event) => {
      const at = event.source === 'github' && event.type === 'commit' ? instantOf(event.occurredAt) : null;
      if (at === null || now.getTime() - at > LATE_WINDOW_DAYS * DAY_MS) return [];
      const hour = localHourOf(at);
      return hour >= LATE_HOUR || hour < EARLY_HOUR ? [dayKeyOf(new Date(at))] : [];
    }),
  );
  const reason = fullDays ? `Llevas ${FULL_DAYS_IN_A_ROW} días hábiles con más de ${FULL_DAY_MEETING_MINUTES / 60} horas de reuniones` : lateDays.size >= LATE_DAYS ? `Hiciste commits de noche ${lateDays.size} días esta semana` : null;
  if (!reason) return [];
  return [{ to: member.token, kind: 'sin_pausas', ref: weekKeyOf(today), text: `${reason}. Bloquea un rato sin reuniones antes de que se llene: ${PAUSE_LINK}\nEsto no sale de tu agente.` }];
}

function deadlinesOf(member: MemberView, today: string, now: Date): Nudge[] {
  return latestTasksOf(member.events).flatMap((task): Nudge[] => {
    if (!task.dueDay || !isOpen(task.stateType)) return [];
    const left = daysBetween(today, task.dueDay);
    if (left < 0 || left > DEADLINE_DAYS) return [];
    const quietDays = Math.floor((now.getTime() - task.updatedAt) / DAY_MS);
    const progress = task.stateType !== STARTED_STATE ? 'todavía no parte' : quietDays >= QUIET_TASK_DAYS ? `no se mueve hace ${quietDays} días` : null;
    if (!progress) return [];
    const when = left === 0 ? 'hoy' : left === 1 ? 'mañana' : `en ${left} días`;
    const loaded = member.signals.load.level === 'alta' ? ' Además tu carga está alta.' : '';
    return [{ to: member.token, kind: 'deadline', ref: `${task.identifier}:${task.dueDay}`, text: `«${task.title}» (${task.identifier}) vence ${when} y ${progress}.${loaded} ¿Quieres mover algo o que le pida ayuda a tu equipo?` }];
  });
}

function movedDatesOf(member: MemberView): Nudge[] {
  return [...taskHistoryOf(member.events).values()].flatMap((snapshots): Nudge[] => {
    const latest = snapshots.at(-1);
    if (!latest || !isOpen(latest.stateType)) return [];
    const dates = snapshots.flatMap((snapshot) => snapshot.dueDay ?? []).filter((day, index, all) => index === 0 || day !== all[index - 1]);
    const moves = dates.filter((day, index) => index > 0 && day > (dates[index - 1] ?? day)).length;
    const first = dates[0];
    const last = dates.at(-1);
    if (moves < MIN_DATE_MOVES || !first || !last) return [];
    return [
      {
        to: member.token,
        kind: 'fecha_movida',
        ref: `${latest.identifier}:${moves}`,
        text: `La fecha de «${latest.title}» (${latest.identifier}) ya se corrió ${times(moves)}: del ${shortDay(first)} al ${shortDay(last)}. Te lo digo a ti antes que a nadie: ¿prefieres renegociarla ahora con quien la espera?`,
      },
    ];
  });
}

function offPriorityOf(member: MemberView, today: string): Nudge[] {
  const started = latestTasksOf(member.events).filter((task) => task.stateType === STARTED_STATE);
  if (started.length === 0 || started.some((task) => URGENT_PRIORITIES.includes(task.priority))) return [];
  const unowned = new Map<string, string>();
  for (const event of member.events) {
    if (!isFrom(event, 'linear', UNOWNED_URGENT_TYPE) || dayKeyOf(new Date(event.occurredAt)) !== today) continue;
    const identifier = textOf(rawOf(event).identifier);
    const title = textOf(rawOf(event).title);
    if (identifier && title) unowned.set(identifier, title);
  }
  if (unowned.size === 0) return [];
  const listed = [...unowned.entries()].slice(0, MAX_LISTED).map(([identifier, title]) => `«${title}» (${identifier})`);
  const mine = started[0]?.title ?? '';
  return [
    {
      to: member.token,
      kind: 'fuera_de_prioridad',
      ref: weekKeyOf(today),
      text: `Hay ${unowned.size === 1 ? 'un tema urgente sin dueño' : `${unowned.size} temas urgentes sin dueño`} en Linear: ${names.format(listed)}. Lo que tienes en curso no está marcado como urgente («${mine}»). ¿Fue a propósito, o tomas alguno?`,
    },
  ];
}

export function personalNudges(member: MemberView, now: Date): Nudge[] {
  const today = dayKeyOf(now);
  return [...overloadOf(member, today), ...noBreaksOf(member, today, now), ...deadlinesOf(member, today, now), ...movedDatesOf(member), ...offPriorityOf(member, today)];
}

const wordsOf = (title: string): Set<string> => new Set(title.toLocaleLowerCase('es').split(WORD_BOUNDARY).filter((word) => word.length >= MIN_WORD_LENGTH && !COMMON_WORDS.has(word) && numberOf(word) === null));

export function sameWork(left: string, right: string): boolean {
  const leftWords = wordsOf(left);
  const rightWords = wordsOf(right);
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  const all = new Set([...leftWords, ...rightWords]).size;
  return shared >= MIN_SHARED_WORDS && shared / all >= MIN_OVERLAP;
}

export function commonSlot(left: StoredEvent[], right: StoredEvent[], now: Date): string | null {
  const leftBusy = meetingsOf(left);
  const rightBusy = meetingsOf(right);
  if (leftBusy.length === 0 || rightBusy.length === 0) return null;
  const busy = [...leftBusy, ...rightBusy];
  const step = SLOT_MINUTES * MINUTE_MS;
  const first = Math.ceil((now.getTime() + step) / step) * step;
  const today = dayKeyOf(now);
  for (let start = first; start < first + SLOT_SEARCH_HOURS * 60 * MINUTE_MS; start += step) {
    const day = dayKeyOf(new Date(start));
    const hour = localHourOf(start);
    if (isWeekend(day) || hour < WORKDAY_START_HOUR || hour >= WORKDAY_END_HOUR) continue;
    if (busy.some((block) => block.start < start + step && block.end > start)) continue;
    const label = day === today ? 'hoy' : daysBetween(today, day) === 1 ? 'mañana' : `el ${shortDay(day)}`;
    return `${label} a las ${clockFormat.format(new Date(start))}`;
  }
  return null;
}

const sharesWork = (member: MemberView) => member.signals.visibility.expertise === 'siempre';
const sharesLoad = (member: MemberView) => member.signals.visibility.load === 'siempre';

function overlapsOf(group: GroupView, now: Date): Nudge[] {
  const nudges: Nudge[] = [];
  const started = new Map(group.members.map((member) => [member.token, latestTasksOf(member.events).filter((task) => task.stateType === STARTED_STATE)]));
  group.members.forEach((left, index) => {
    for (const right of group.members.slice(index + 1)) {
      if (!sharesWork(left) || !sharesWork(right)) continue;
      for (const mine of started.get(left.token) ?? []) {
        const theirs = (started.get(right.token) ?? []).find((task) => task.identifier !== mine.identifier && sameWork(mine.title, task.title));
        if (!theirs) continue;
        const slot = sharesLoad(left) && sharesLoad(right) ? commonSlot(left.events, right.events, now) : null;
        const when = slot ? ` Los dos tienen libre ${slot}.` : '';
        const ref = [mine.identifier, theirs.identifier].sort().join(':');
        nudges.push({ to: left.token, kind: 'se_pisan', ref, text: `Tú y ${right.name} parecen estar en lo mismo: tu «${mine.title}» (${mine.identifier}) y su «${theirs.title}» (${theirs.identifier}). Hablen 15 minutos antes de seguir.${when}` });
        nudges.push({ to: right.token, kind: 'se_pisan', ref, text: `Tú y ${left.name} parecen estar en lo mismo: tu «${theirs.title}» (${theirs.identifier}) y su «${mine.title}» (${mine.identifier}). Hablen 15 minutos antes de seguir.${when}` });
        break;
      }
    }
  });
  return nudges;
}

function waitingOf(group: GroupView): Nudge[] {
  const byEmail = new Map(group.members.flatMap((member) => member.emails.map((email) => [email.toLowerCase(), member] as const)));
  return group.members.flatMap((waiting) =>
    latestTasksOf(waiting.events)
      .filter((task) => isOpen(task.stateType))
      .flatMap((task) =>
        task.blockedBy.flatMap((blocker): Nudge[] => {
          const owner = blocker.assigneeEmail ? byEmail.get(blocker.assigneeEmail) : undefined;
          if (!owner || owner.token === waiting.token) return [];
          return [
            {
              to: owner.token,
              kind: 'esperan_por_ti',
              ref: `${blocker.identifier}:${task.identifier}`,
              text: `${waiting.name} está esperando «${blocker.title}» (${blocker.identifier}), que tienes tú, para avanzar con «${task.title}» (${task.identifier}).`,
            },
          ];
        }),
      ),
  );
}

function projectsAtRiskOf(group: GroupView, today: string): Nudge[] {
  const byEmail = new Map(group.members.flatMap((member) => member.emails.map((email) => [email.toLowerCase(), member] as const)));
  const projects = new Map<string, { project: TaskProject; open: string[] }>();
  for (const member of group.members) {
    for (const task of latestTasksOf(member.events)) {
      if (!task.project) continue;
      const known = projects.get(task.project.id) ?? { project: task.project, open: [] };
      if (isOpen(task.stateType)) known.open.push(`«${task.title}» (${member.name})`);
      projects.set(task.project.id, known);
    }
  }
  return [...projects.values()].flatMap(({ project, open }): Nudge[] => {
    const lead = project.leadEmail ? byEmail.get(project.leadEmail) : undefined;
    if (!lead || !project.startDate || !project.targetDate || project.progress >= 1) return [];
    const total = daysBetween(project.startDate, project.targetDate);
    const left = daysBetween(today, project.targetDate);
    if (total <= 0 || left > PROJECT_HORIZON_DAYS) return [];
    const expected = Math.min(1, Math.max(0, daysBetween(project.startDate, today) / total));
    if (left >= 0 && expected - project.progress < PROGRESS_GAP) return [];
    const pace = left < 0 ? `tenía entrega el ${shortDay(project.targetDate)}` : `por fecha debería ir en ${percent(expected)} (entrega el ${shortDay(project.targetDate)})`;
    const pending = open.length > 0 ? ` Lo que veo sin cerrar: ${names.format(open.slice(0, MAX_LISTED))}.` : '';
    return [{ to: lead.token, kind: 'meta_en_riesgo', ref: `${project.id}:${weekKeyOf(today)}`, text: `«${project.name}» va en ${percent(project.progress)} y ${pace}.${pending}` }];
  });
}

const publicLineOf = (member: MemberView): string | null => {
  if (!sharesWork(member)) return null;
  const focus = member.signals.focus.slice(0, 2).map((line) => line.charAt(0).toLocaleLowerCase('es') + line.slice(1));
  return focus.length > 0 ? `${member.name}: ${focus.join('; ')}` : null;
};

function welcomesOf(group: GroupView, now: Date): Nudge[] {
  return group.members.flatMap((member): Nudge[] => {
    const joined = member.joinedAt ? Date.parse(member.joinedAt) : Number.NaN;
    if (!Number.isFinite(joined) || now.getTime() - joined > NEW_MEMBER_DAYS * DAY_MS) return [];
    const lines = group.members.filter((other) => other.token !== member.token).flatMap((other) => publicLineOf(other) ?? []);
    if (lines.length === 0) return [];
    return [{ to: member.token, kind: 'persona_nueva', ref: group.id, text: `Ya estás en ${group.name}. Para ubicarte, esto es lo que cada uno comparte hoy:\n${lines.map((line) => `- ${line}`).join('\n')}\nSi algo se cruza con lo tuyo, escríbele directo.` }];
  });
}

function thanksOf(group: GroupView, now: Date): Nudge[] {
  return group.proposals.flatMap((proposal): Nudge[] => {
    const age = (now.getTime() - Date.parse(proposal.createdAt)) / DAY_MS;
    const requester = proposal.parties.find((party) => party.role === 'pide');
    const helpers = proposal.parties.filter((party) => party.role === 'ayuda').map((party) => party.name);
    if (proposal.status !== 'acordada' || !(age >= THANKS_AFTER_DAYS && age <= THANKS_UNTIL_DAYS) || !requester || helpers.length === 0) return [];
    return [{ to: requester.token, kind: 'reconocimiento', ref: proposal.id, text: `Hace unos días ${names.format(helpers)} ${helpers.length === 1 ? 'te ayudó' : 'te ayudaron'} con «${proposal.topic}». Si te sirvió, díselo: esa ayuda no queda anotada en ningún otro lado.` }];
  });
}

function weeklyOf(group: GroupView, today: string): Nudge[] {
  if (!isMonday(today)) return [];
  return group.members.flatMap((member): Nudge[] => {
    const others = group.members.filter((other) => other.token !== member.token);
    const lines = others.flatMap((other) => publicLineOf(other) ?? []);
    if (lines.length === 0) return [];
    const mine = new Set(member.signals.expertise.map((topic) => topic.toLocaleLowerCase('es')));
    const close = others.flatMap((other) => {
      const shared = sharesWork(other) ? other.signals.expertise.filter((topic) => mine.has(topic.toLocaleLowerCase('es'))) : [];
      return shared.length > 0 ? [`${other.name} (${shared.slice(0, 2).join(', ')})`] : [];
    });
    const near = close.length > 0 ? `\nTe toca de cerca: ${names.format(close)}.` : '';
    return [{ to: member.token, kind: 'resumen_semanal', ref: weekKeyOf(today), text: `Así parte la semana en ${group.name}:\n${lines.map((line) => `- ${line}`).join('\n')}${near}` }];
  });
}

export function groupNudges(group: GroupView, now: Date): Nudge[] {
  const today = dayKeyOf(now);
  return [...waitingOf(group), ...overlapsOf(group, now), ...projectsAtRiskOf(group, today), ...thanksOf(group, now), ...welcomesOf(group, now), ...weeklyOf(group, today)];
}
