import { pathToFileURL } from 'node:url';
import { createContext, type AppContext } from './context.js';
import { DEFAULT_TIME_ZONE, dayKeyOf } from './signals.js';
import type { EventDraft } from './types.js';

type Mood = 'bien' | 'normal' | 'cansada' | 'mal';

interface MeetingPlan {
  title: string;
  hour: number;
  minute: number;
  durationMinutes: number;
  attendees: number;
}

interface TaskPlan {
  number: number;
  title: string;
  state: string;
  stateType: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  updatedDaysAgo: number;
  createdDaysAgo: number;
  dueInDays: number | null;
}

interface PullRequestPlan {
  number: number;
  repo: string;
  title: string;
  openedDaysAgo: number;
  mergedDaysAgo: number;
}

interface CheckinPlan {
  daysAgo: number;
  mood: Mood;
  blocker: string | null;
  note: string | null;
}

interface DemoProfile {
  name: string;
  usualSleepHours: number;
  recentSleepHours: number[];
  restingHeartRate: number;
  repos: string[];
  meetingsToday: MeetingPlan[];
  tasks: TaskPlan[];
  pullRequests: PullRequestPlan[];
  checkins: CheckinPlan[];
}

const HISTORY_DAYS = 14;
const MINUTE_MS = 60_000;
const DEMO_ORGANIZATION = 'ronda-demo';
const SLEEP_JITTER_HOURS = 0.8;
const SHORT_NIGHT_GAP_HOURS = 1;
const SHORT_NIGHT_EXTRA_HEART_RATE = 5;
const COMMIT_DAY_RATE = 0.6;
const MAX_COMMITS_PER_DAY = 5;
const NOTE_DAYS_AGO = [1, 3];
const NOTE_MEETING_SLOT = 1;
const IN_PROGRESS = 'En curso';
const DONE = 'Terminada';
const TODO = 'Por hacer';
const PAYMENTS_BLOCKER = 'integración de pagos';

const DAILY: Omit<MeetingPlan, 'attendees'> = { title: 'Daily del equipo', hour: 9, minute: 30, durationMinutes: 30 };
const ROUTINE_SLOTS = [
  { hour: 9, minute: 30 },
  { hour: 11, minute: 0 },
  { hour: 15, minute: 0 },
];
const ROUTINE_TITLES = ['Revisión de avances', 'Planificación semanal', 'Sincronización con producto', 'Revisión de diseño'];
const ROUTINE_DURATIONS = [30, 45, 60];

const DEMO_PROFILES: DemoProfile[] = [
  {
    name: 'Ana',
    usualSleepHours: 7.4,
    recentSleepHours: [4.9, 4.8, 5.2],
    restingHeartRate: 60,
    repos: ['checkout-web', 'sitio-publico'],
    meetingsToday: [
      { title: 'Daily del equipo', hour: 9, minute: 0, durationMinutes: 30, attendees: 6 },
      { title: 'Planificación del sprint', hour: 10, minute: 0, durationMinutes: 60, attendees: 6 },
      { title: 'Revisión del checkout con producto', hour: 11, minute: 30, durationMinutes: 45, attendees: 4 },
      { title: 'Integración de pagos: estado y riesgos', hour: 14, minute: 0, durationMinutes: 60, attendees: 5 },
      { title: '1:1 con Carla', hour: 15, minute: 30, durationMinutes: 30, attendees: 2 },
      { title: 'Demo interna del checkout', hour: 16, minute: 30, durationMinutes: 45, attendees: 8 },
    ],
    tasks: [
      { number: 98, title: 'Página de confirmación del checkout', state: DONE, stateType: 'completed', updatedDaysAgo: 6, createdDaysAgo: 12, dueInDays: null },
      { number: 101, title: 'Integración de pagos con el banco', state: IN_PROGRESS, stateType: 'started', updatedDaysAgo: 2, createdDaysAgo: 9, dueInDays: null },
      { number: 102, title: 'Validar el formulario de tarjeta del checkout', state: IN_PROGRESS, stateType: 'started', updatedDaysAgo: 1, createdDaysAgo: 5, dueInDays: null },
    ],
    pullRequests: [{ number: 31, repo: 'checkout-web', title: 'Resumen de compra en el checkout', openedDaysAgo: 8, mergedDaysAgo: 6 }],
    checkins: [
      { daysAgo: 4, mood: 'normal', blocker: null, note: null },
      { daysAgo: 3, mood: 'normal', blocker: null, note: null },
      { daysAgo: 2, mood: 'cansada', blocker: PAYMENTS_BLOCKER, note: null },
      { daysAgo: 1, mood: 'cansada', blocker: PAYMENTS_BLOCKER, note: null },
      { daysAgo: 0, mood: 'cansada', blocker: PAYMENTS_BLOCKER, note: 'Hoy tengo el día lleno de reuniones.' },
    ],
  },
  {
    name: 'Tomás',
    usualSleepHours: 7.3,
    recentSleepHours: [8.1],
    restingHeartRate: 54,
    repos: ['pagos-api', 'webhooks'],
    meetingsToday: [{ ...DAILY, attendees: 6 }],
    tasks: [
      { number: 87, title: 'Firmar el webhook de pagos', state: DONE, stateType: 'completed', updatedDaysAgo: 26, createdDaysAgo: 34, dueInDays: null },
      { number: 110, title: 'Documentar los reintentos del webhook', state: IN_PROGRESS, stateType: 'started', updatedDaysAgo: 1, createdDaysAgo: 4, dueInDays: null },
    ],
    pullRequests: [
      { number: 42, repo: 'pagos-api', title: 'Webhook de pagos con reintentos idempotentes', openedDaysAgo: 33, mergedDaysAgo: 30 },
      { number: 57, repo: 'pagos-api', title: 'Alertas de conciliación de pagos', openedDaysAgo: 12, mergedDaysAgo: 10 },
    ],
    checkins: [
      { daysAgo: 2, mood: 'bien', blocker: null, note: null },
      { daysAgo: 1, mood: 'bien', blocker: null, note: null },
      { daysAgo: 0, mood: 'bien', blocker: null, note: null },
    ],
  },
  {
    name: 'Sofía',
    usualSleepHours: 7,
    recentSleepHours: [7],
    restingHeartRate: 58,
    repos: ['pagos-api', 'cobranza'],
    meetingsToday: [
      { ...DAILY, attendees: 6 },
      { title: 'Revisión de entregas de la semana', hour: 12, minute: 0, durationMinutes: 45, attendees: 3 },
    ],
    tasks: [
      { number: 120, title: 'Conciliación de pagos del mes', state: IN_PROGRESS, stateType: 'started', updatedDaysAgo: 0, createdDaysAgo: 6, dueInDays: 1 },
      { number: 121, title: 'Reporte de pagos rechazados', state: IN_PROGRESS, stateType: 'started', updatedDaysAgo: 1, createdDaysAgo: 5, dueInDays: 3 },
      { number: 122, title: 'Panel de cobranza para finanzas', state: IN_PROGRESS, stateType: 'started', updatedDaysAgo: 1, createdDaysAgo: 4, dueInDays: 4 },
    ],
    pullRequests: [{ number: 49, repo: 'pagos-api', title: 'Reembolsos parciales de pagos', openedDaysAgo: 11, mergedDaysAgo: 9 }],
    checkins: [
      { daysAgo: 2, mood: 'normal', blocker: null, note: null },
      { daysAgo: 1, mood: 'normal', blocker: null, note: null },
      { daysAgo: 0, mood: 'normal', blocker: null, note: 'Tengo tres entregas esta semana.' },
    ],
  },
  {
    name: 'Diego',
    usualSleepHours: 6.6,
    recentSleepHours: [6.6],
    restingHeartRate: 62,
    repos: ['app-movil'],
    meetingsToday: [
      { ...DAILY, attendees: 6 },
      { title: 'Revisión de la app móvil', hour: 11, minute: 0, durationMinutes: 45, attendees: 4 },
      { title: 'Pruebas con usuarios', hour: 15, minute: 0, durationMinutes: 45, attendees: 3 },
    ],
    tasks: [
      { number: 130, title: 'Notificaciones push en la app', state: IN_PROGRESS, stateType: 'started', updatedDaysAgo: 1, createdDaysAgo: 6, dueInDays: null },
      { number: 131, title: 'Pantalla de perfil en la app', state: IN_PROGRESS, stateType: 'started', updatedDaysAgo: 2, createdDaysAgo: 7, dueInDays: null },
    ],
    pullRequests: [{ number: 18, repo: 'app-movil', title: 'Modo sin conexión en la app', openedDaysAgo: 7, mergedDaysAgo: 5 }],
    checkins: [
      { daysAgo: 1, mood: 'normal', blocker: null, note: null },
      { daysAgo: 0, mood: 'normal', blocker: null, note: null },
    ],
  },
  {
    name: 'Carla',
    usualSleepHours: 7.6,
    recentSleepHours: [7.6],
    restingHeartRate: 57,
    repos: ['design-system', 'onboarding-web'],
    meetingsToday: [
      { ...DAILY, attendees: 6 },
      { title: 'Revisión de diseño', hour: 10, minute: 30, durationMinutes: 60, attendees: 4 },
      { title: '1:1 con Ana', hour: 15, minute: 30, durationMinutes: 30, attendees: 2 },
    ],
    tasks: [
      { number: 140, title: 'Componentes de formulario del design system', state: IN_PROGRESS, stateType: 'started', updatedDaysAgo: 1, createdDaysAgo: 5, dueInDays: null },
      { number: 141, title: 'Pantalla de bienvenida del onboarding', state: TODO, stateType: 'unstarted', updatedDaysAgo: 3, createdDaysAgo: 3, dueInDays: 10 },
    ],
    pullRequests: [{ number: 12, repo: 'design-system', title: 'Tokens de color del design system', openedDaysAgo: 6, mergedDaysAgo: 4 }],
    checkins: [
      { daysAgo: 1, mood: 'normal', blocker: null, note: null },
      { daysAgo: 0, mood: 'normal', blocker: null, note: null },
    ],
  },
];

export const DEMO_NAMES = DEMO_PROFILES.map((profile) => profile.name);
const DEMO_TEAM_NAME = 'Equipo demo';

function seededRandom(seedText: string): () => number {
  let state = 2166136261;
  for (const character of seedText) state = Math.imul(state ^ (character.codePointAt(0) ?? 0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const shiftDay = (dayKey: string, days: number) =>
  new Date(Date.UTC(Number(dayKey.slice(0, 4)), Number(dayKey.slice(5, 7)) - 1, Number(dayKey.slice(8, 10)) + days)).toISOString().slice(0, 10);

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const wallClock = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'));
  return wallClock - Math.floor(instant.getTime() / 1000) * 1000;
}

function localInstant(dayKey: string, hour: number, minute: number, timeZone: string): Date {
  const asUtc = Date.UTC(Number(dayKey.slice(0, 4)), Number(dayKey.slice(5, 7)) - 1, Number(dayKey.slice(8, 10)), hour, minute);
  return new Date(asUtc - zoneOffsetMs(new Date(asUtc), timeZone));
}

const roundToTenth = (value: number) => Math.round(value * 10) / 10;
const pick = <T>(items: T[], roll: number, fallback: T): T => items[Math.floor(roll * items.length)] ?? fallback;
const countLabel = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;

export function demoEventsFor(name: string, now: Date = new Date(), timeZone: string = DEFAULT_TIME_ZONE): EventDraft[] {
  const profile = DEMO_PROFILES.find((candidate) => candidate.name === name);
  if (!profile) return [];

  const random = seededRandom(profile.name);
  const today = dayKeyOf(now, timeZone);
  const dayAgo = (daysAgo: number) => shiftDay(today, -daysAgo);
  const pastMoment = (daysAgo: number, hour: number, minute: number) => {
    const planned = localInstant(dayAgo(daysAgo), hour, minute, timeZone);
    return (planned.getTime() > now.getTime() ? now : planned).toISOString();
  };
  const teammate = DEMO_PROFILES[(DEMO_PROFILES.indexOf(profile) + 1) % DEMO_PROFILES.length]?.name ?? profile.name;
  const drafts: EventDraft[] = [];

  const meetingDraft = (day: string, slot: number, plan: MeetingPlan): EventDraft => {
    const start = localInstant(day, plan.hour, plan.minute, timeZone);
    const end = new Date(start.getTime() + plan.durationMinutes * MINUTE_MS);
    const id = `demo-reunion-${day}-${slot}`;
    return {
      source: 'google_calendar',
      type: 'reunion',
      externalId: id,
      occurredAt: start.toISOString(),
      summary: `${plan.title} · ${plan.durationMinutes} min · ${countLabel(plan.attendees, 'asistente', 'asistentes')}`,
      raw: {
        id,
        title: plan.title,
        start: start.toISOString(),
        end: end.toISOString(),
        durationMinutes: plan.durationMinutes,
        attendees: plan.attendees,
        declined: false,
        synthetic: true,
      },
    };
  };

  for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo -= 1) {
    const day = dayAgo(daysAgo);
    const sleepRoll = random();
    const heartRoll = random();
    const stepsRoll = random();
    const thirdMeetingRoll = random();
    const commitRoll = random();
    const repoRoll = random();
    const commitSizeRoll = random();

    const sleepHours = profile.recentSleepHours[daysAgo] ?? roundToTenth(profile.usualSleepHours + (sleepRoll - 0.5) * SLEEP_JITTER_HOURS);
    const shortNight = sleepHours < profile.usualSleepHours - SHORT_NIGHT_GAP_HOURS;
    const restingHeartRate = profile.restingHeartRate + Math.round((heartRoll - 0.5) * 4) + (shortNight ? SHORT_NIGHT_EXTRA_HEART_RATE : 0);
    const steps = 5000 + Math.round(stepsRoll * 6000);
    drafts.push({
      source: 'apple_health',
      type: 'salud_diaria',
      externalId: `demo-salud-${day}`,
      occurredAt: day,
      summary: `sueño ${sleepHours.toFixed(1)} h · pulso en reposo ${restingHeartRate} lpm · ${steps} pasos`,
      raw: { date: day, sleep_hours: sleepHours, resting_hr: restingHeartRate, steps, synthetic: true },
    });

    const routineMeetings: MeetingPlan[] = ROUTINE_SLOTS.slice(0, thirdMeetingRoll < 0.5 ? 2 : 3).map((slot, index) => {
      const titleRoll = random();
      const durationRoll = random();
      const attendeesRoll = random();
      return index === 0
        ? { ...DAILY, attendees: 6 }
        : {
            title: pick(ROUTINE_TITLES, titleRoll, 'Revisión de avances'),
            hour: slot.hour,
            minute: slot.minute,
            durationMinutes: pick(ROUTINE_DURATIONS, durationRoll, 30),
            attendees: 2 + Math.floor(attendeesRoll * 4),
          };
    });
    const meetings = daysAgo === 0 ? profile.meetingsToday : routineMeetings;
    meetings.forEach((plan, slot) => drafts.push(meetingDraft(day, slot, plan)));

    const notedMeeting = NOTE_DAYS_AGO.includes(daysAgo) ? meetings[NOTE_MEETING_SLOT] : undefined;
    if (notedMeeting) {
      const start = localInstant(day, notedMeeting.hour, notedMeeting.minute, timeZone);
      const id = `demo-nota-${day}`;
      drafts.push({
        source: 'granola',
        type: 'nota_de_reunion',
        externalId: id,
        occurredAt: start.toISOString(),
        summary: `${notedMeeting.title} · 2 asistentes`,
        raw: {
          id,
          title: notedMeeting.title,
          web_url: `https://notas.example/${id}`,
          attendees: [
            { name: profile.name, email: `${profile.name.toLowerCase()}@ronda.example` },
            { name: teammate, email: `${teammate.toLowerCase()}@ronda.example` },
          ],
          summary_text: 'Nota sintética para la demo: se revisaron los avances de la semana y los próximos pasos.',
          calendar_event: {
            scheduled_start_time: start.toISOString(),
            scheduled_end_time: new Date(start.getTime() + notedMeeting.durationMinutes * MINUTE_MS).toISOString(),
          },
          synthetic: true,
        },
      });
    }

    if (commitRoll < COMMIT_DAY_RATE) {
      const repo = `${DEMO_ORGANIZATION}/${pick(profile.repos, repoRoll, 'ronda')}`;
      const commits = 1 + Math.floor(commitSizeRoll * MAX_COMMITS_PER_DAY);
      drafts.push({
        source: 'github',
        type: 'commit',
        externalId: `demo-commit-${day}`,
        occurredAt: pastMoment(daysAgo, 17, 40),
        summary: `${countLabel(commits, 'commit', 'commits')} en ${repo}`,
        raw: { repo, commits, synthetic: true },
      });
    }
  }

  for (const pull of profile.pullRequests) {
    const repo = `${DEMO_ORGANIZATION}/${pull.repo}`;
    const url = `https://git.example/${repo}/pull/${pull.number}`;
    const stages = [
      { action: 'opened', label: 'PR abierto', occurredAt: pastMoment(pull.openedDaysAgo, 10, 20) },
      { action: 'closed', label: 'PR mergeado', occurredAt: pastMoment(pull.mergedDaysAgo, 16, 5) },
    ];
    for (const stage of stages) {
      drafts.push({
        source: 'github',
        type: 'pull_request',
        externalId: `demo-pr-${pull.repo}-${pull.number}-${stage.action}`,
        occurredAt: stage.occurredAt,
        summary: `${stage.label} en ${repo}: ${pull.title}`,
        raw: { repo, action: stage.action, title: pull.title, url, synthetic: true },
      });
    }
  }

  for (const task of profile.tasks) {
    const identifier = `RON-${task.number}`;
    const updatedAt = pastMoment(task.updatedDaysAgo, 16, 30);
    drafts.push({
      source: 'linear',
      type: 'tarea',
      externalId: `demo-tarea-${identifier}-${dayAgo(task.updatedDaysAgo)}`,
      occurredAt: updatedAt,
      summary: `${identifier} ${task.title} · ${task.state}`,
      raw: {
        identifier,
        title: task.title,
        url: `https://tareas.example/${DEMO_ORGANIZATION}/${identifier}`,
        state: task.state,
        stateType: task.stateType,
        priority: 2,
        dueDate: task.dueInDays === null ? null : shiftDay(today, task.dueInDays),
        createdAt: pastMoment(task.createdDaysAgo, 10, 0),
        updatedAt,
        synthetic: true,
      },
    });
  }

  for (const checkin of profile.checkins) {
    drafts.push({
      source: 'checkin',
      type: 'checkin',
      externalId: `demo-checkin-${dayAgo(checkin.daysAgo)}`,
      occurredAt: pastMoment(checkin.daysAgo, 8, 40),
      summary: `Check-in: ${checkin.mood}${checkin.blocker ? ` · bloqueo en ${checkin.blocker}` : ''}`,
      raw: { mood: checkin.mood, blocker: checkin.blocker, note: checkin.note, synthetic: true },
    });
  }

  return drafts.sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
}

export function seedDemoEvents(ctx: AppContext, token: string, name: string, now: Date = new Date()): number {
  return demoEventsFor(name, now).filter((draft) => ctx.store.saveEvent(token, draft) !== null).length;
}

export function seedDemo(ctx: AppContext, now: Date = new Date()): Array<{ name: string; token: string }> {
  return DEMO_NAMES.map((name) => {
    const person = ctx.store.addPerson(name);
    seedDemoEvents(ctx, person.token, person.name, now);
    return { name: person.name, token: person.token };
  });
}

function runAsScript(tokens: string[]): void {
  const ctx = createContext();
  if (tokens.length === 0) {
    const team = ctx.teams.createTeam(DEMO_TEAM_NAME);
    for (const person of seedDemo(ctx)) {
      ctx.teams.addMember(team.id, person.token);
      console.log(`${person.name}: /conectar/${person.token}`);
    }
    console.log(`Las cinco personas quedaron en el equipo «${team.name}».`);
    return;
  }
  for (const token of tokens) {
    const person = ctx.store.findPerson(token);
    if (!person || !DEMO_NAMES.includes(person.name)) {
      console.error(`Sin persona de la demo para el link ${token}.`);
      continue;
    }
    const added = seedDemoEvents(ctx, person.token, person.name);
    console.log(`${person.name}: /conectar/${person.token} · ${countLabel(added, 'evento nuevo', 'eventos nuevos')}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runAsScript(process.argv.slice(2));
