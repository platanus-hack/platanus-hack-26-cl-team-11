import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from '../src/context.js';
import { openLoginStore } from '../src/logins.js';
import { commonSlot, sameWork, weekKeyOf } from '../src/nudges/detectors.js';
import { deliverNudges, isWorkingTime, MAX_NUDGES_PER_DAY, nudgesFor, privateGroupsOf } from '../src/nudges/routine.js';
import type { EventDraft } from '../src/types.js';

const TUESDAY_NOON = new Date('2026-11-24T15:00:00.000Z');
const MONDAY_NOON = new Date('2026-11-23T15:00:00.000Z');
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const ago = (days: number, from: Date = TUESDAY_NOON) => new Date(from.getTime() - days * DAY_MS).toISOString();

const task = (identifier: string, title: string, extra: Record<string, unknown> = {}, updatedAt: string = ago(0.1)): EventDraft => ({
  source: 'linear',
  type: 'tarea',
  externalId: `${identifier}:${updatedAt}`,
  occurredAt: updatedAt,
  summary: `${identifier} ${title}`,
  raw: { identifier, title, stateType: 'started', state: 'En progreso', priority: 3, dueDate: null, updatedAt, createdAt: ago(10), ...extra },
});

const meeting = (id: string, start: string, minutes: number): EventDraft => ({
  source: 'google_calendar',
  type: 'reunion',
  externalId: id,
  occurredAt: start,
  summary: `Reunión · ${minutes} min`,
  raw: { title: 'Reunión', start, end: new Date(Date.parse(start) + minutes * 60_000).toISOString(), durationMinutes: minutes, attendees: 2, declined: false },
});

const night = (date: string, hours: number, extra: Record<string, unknown> = {}): EventDraft => ({ source: 'apple_health', type: 'salud_diaria', externalId: `noche:${date}`, occurredAt: date, summary: `sueño ${hours} h`, raw: { date, sleep_hours: hours, ...extra } });

function setup() {
  const ctx = createContext({ location: ':memory:', model: null, whatsapp: null });
  const ana = ctx.store.addPerson('Ana');
  const tomas = ctx.store.addPerson('Tomás');
  const vale = ctx.store.addPerson('Vale');
  const team = ctx.teams.createTeam('Vita');
  for (const member of [ana, tomas, vale]) ctx.teams.addMember(team.id, member.token);
  ctx.db.prepare('UPDATE team_members SET joined_at = ? WHERE team_id = ?').run('2026-10-01T12:00:00.000Z', team.id);
  const justJoined = (person: { token: string }) => ctx.db.prepare('UPDATE team_members SET joined_at = ? WHERE team_id = ? AND person_token = ?').run(ago(1), team.id, person.token);
  const logins = openLoginStore(ctx.db);
  logins.assign('ana@vita.test', ana.token, 'Ana');
  logins.assign('tomas@vita.test', tomas.token, 'Tomás');
  const save = (person: { token: string }, ...drafts: EventDraft[]) => drafts.forEach((draft) => ctx.store.saveEvent(person.token, draft));
  const found = (now: Date = TUESDAY_NOON) => nudgesFor(privateGroupsOf(ctx, now), now);
  const kindsFor = (person: { token: string }, now: Date = TUESDAY_NOON) => found(now).filter((nudge) => nudge.to === person.token).map((nudge) => nudge.kind);
  const heard = (person: { token: string }) => ctx.whatsapp.inboxOf(person.token).recent.map((message) => message.text);
  return { ctx, ana, tomas, vale, team, save, found, kindsFor, heard, justJoined };
}

test('two started tasks about the same thing tell both people, with a slot both have free, and only if both share their work', () => {
  const { ctx, ana, tomas, save, found, kindsFor } = setup();
  save(ana, task('VIT-1', 'Migrar cobros recurrentes a Toku'), meeting('a1', '2026-11-24T15:00:00.000Z', 60));
  save(tomas, task('VIT-2', 'Cobros recurrentes con Toku: migrar planes'), meeting('t1', '2026-11-24T16:00:00.000Z', 60));

  const toAna = found().find((nudge) => nudge.to === ana.token && nudge.kind === 'se_pisan');
  assert.match(toAna?.text ?? '', /^Tú y Tomás parecen estar en lo mismo: tu «Migrar cobros recurrentes a Toku» \(VIT-1\) y su «Cobros recurrentes con Toku: migrar planes» \(VIT-2\)\./);
  assert.match(toAna?.text ?? '', /Los dos tienen libre hoy a las 14:00\.$/);
  assert.deepEqual(kindsFor(tomas), ['se_pisan']);

  ctx.db.prepare("INSERT INTO policies (person_token, key, value) VALUES (?, 'expertise', 'nunca')").run(tomas.token);
  assert.deepEqual(kindsFor(ana), []);
});

test('similar titles need two shared words and half the vocabulary, and a slot needs both calendars', () => {
  assert.equal(sameWork('Migrar cobros recurrentes a Toku', 'Cobros recurrentes con Toku'), true);
  assert.equal(sameWork('Migrar cobros recurrentes a Toku', 'Landing de precios'), false);
  assert.equal(sameWork('Webhook de pagos', 'Reporte de pagos mensual'), false);
  assert.equal(commonSlot([], [], TUESDAY_NOON), null);
  assert.equal(weekKeyOf('2026-11-24'), '2026-11-23');
  assert.equal(weekKeyOf('2026-11-29'), '2026-11-23');
});

test('whoever holds the issue that blocks a teammate is told who is waiting', () => {
  const { ana, tomas, save, found } = setup();
  save(ana, task('VIT-3', 'Cobro con tarjeta', { blockedBy: [{ identifier: 'VIT-9', title: 'Llave de Toku', assigneeEmail: 'tomas@vita.test', assigneeName: 'Tomás' }] }));
  const nudges = found();
  assert.deepEqual(nudges.map((nudge) => [nudge.to, nudge.kind, nudge.ref]), [[tomas.token, 'esperan_por_ti', 'VIT-9:VIT-3']]);
  assert.equal(nudges[0]?.text, 'Ana está esperando «Llave de Toku» (VIT-9), que tienes tú, para avanzar con «Cobro con tarjeta» (VIT-3).');
});

test('a deadline in two days with little progress, a date pushed twice and a project behind its date each reach the right person', () => {
  const { ana, tomas, save, found } = setup();
  save(
    ana,
    task('VIT-4', 'Contrato de Kifit', { stateType: 'unstarted', dueDate: '2026-11-25' }),
    task('VIT-5', 'Panel de ventas', { dueDate: '2026-11-20' }, ago(9)),
    task('VIT-5', 'Panel de ventas', { dueDate: '2026-11-27' }, ago(5)),
    task('VIT-5', 'Panel de ventas', { dueDate: '2026-12-04', project: { id: 'pro-1', name: 'Ventas 2.0', progress: 0.3, startDate: '2026-11-01', targetDate: '2026-12-01', leadEmail: 'tomas@vita.test' } }, ago(0.2)),
  );
  const byKind = new Map(found().map((nudge) => [nudge.kind, nudge]));
  assert.equal(byKind.get('deadline')?.to, ana.token);
  assert.equal(byKind.get('deadline')?.text, '«Contrato de Kifit» (VIT-4) vence mañana y todavía no parte. ¿Quieres mover algo o que le pida ayuda a tu equipo?');
  assert.equal(byKind.get('fecha_movida')?.ref, 'VIT-5:2');
  assert.match(byKind.get('fecha_movida')?.text ?? '', /ya se corrió 2 veces: del 20-11 al 04-12\./);
  assert.equal(byKind.get('meta_en_riesgo')?.to, tomas.token);
  assert.equal(byKind.get('meta_en_riesgo')?.text, '«Ventas 2.0» va en 30 % y por fecha debería ir en 77 % (entrega el 01-12). Lo que veo sin cerrar: «Panel de ventas» (Ana).');
});

test('short nights with a full day reach only the person, and nights planted for a demo do not count', () => {
  const { ana, tomas, save, found } = setup();
  const fullDay = (prefix: string) => [meeting(`${prefix}1`, '2026-11-24T12:00:00.000Z', 150), meeting(`${prefix}2`, '2026-11-24T16:00:00.000Z', 150)];
  save(ana, night('2026-11-23', 5.1), night('2026-11-24', 4.8), ...fullDay('a'));
  save(tomas, night('2026-11-23', 4, { demo: 'hackaton' }), night('2026-11-24', 4, { demo: 'hackaton' }), ...fullDay('t'));
  const nudges = found().filter((nudge) => nudge.kind === 'sobrecarga');
  assert.deepEqual(nudges.map((nudge) => nudge.to), [ana.token]);
  assert.match(nudges[0]?.text ?? '', /^Llevas 2 noches durmiendo menos de 6 horas y tu carga está alta\./);
});

test('three working days full of meetings suggest a block, across a weekend', () => {
  const { ana, save, kindsFor } = setup();
  for (const day of ['2026-11-20', '2026-11-23', '2026-11-24']) save(ana, meeting(`m-${day}`, `${day}T12:00:00.000Z`, 320));
  assert.deepEqual(kindsFor(ana), ['sin_pausas']);
});

test('urgent issues without an owner are shown to someone whose started work is not urgent', () => {
  const { ana, tomas, save, found } = setup();
  const unowned: EventDraft = { source: 'linear', type: 'urgente_sin_dueno', externalId: 'u1:sin-dueno:2026-11-24', occurredAt: TUESDAY_NOON.toISOString(), summary: 'VIT-50', raw: { identifier: 'VIT-50', title: 'Caída de pagos', priority: 1 } };
  save(ana, task('VIT-6', 'Ordenar etiquetas', { priority: 4 }), unowned);
  save(tomas, task('VIT-7', 'Incidente de reservas', { priority: 1 }), unowned);
  const nudges = found().filter((nudge) => nudge.kind === 'fuera_de_prioridad');
  assert.deepEqual(nudges.map((nudge) => nudge.to), [ana.token]);
  assert.match(nudges[0]?.text ?? '', /^Hay un tema urgente sin dueño en Linear: «Caída de pagos» \(VIT-50\)\./);
});

test('on Monday each person hears what the others share, and a new member is introduced once', () => {
  const { ctx, ana, tomas, vale, save, kindsFor, heard, justJoined } = setup();
  justJoined(vale);
  save(ana, task('VIT-1', 'Migrar cobros'));
  save(tomas, task('VIT-2', 'Landing de precios'));
  assert.deepEqual(kindsFor(vale, MONDAY_NOON), ['persona_nueva', 'resumen_semanal']);
  assert.deepEqual(kindsFor(vale, TUESDAY_NOON), ['persona_nueva']);

  assert.equal(deliverNudges(ctx, MONDAY_NOON), 4);
  assert.equal(deliverNudges(ctx, MONDAY_NOON), 0);
  assert.ok(heard(vale).some((text) => text.startsWith('Así parte la semana en Vita:\n- Ana: trabaja en «Migrar cobros»\n- Tomás: trabaja en «Landing de precios»')));
  assert.ok(heard(ana).some((text) => text.includes('- Tomás: trabaja en «Landing de precios»')));
  assert.equal(heard(tomas).length, 1);
  assert.ok(heard(vale).some((text) => text.startsWith('Ya estás en Vita.')));
});

test('nothing is sent at night, on weekends, when turned off, to people outside a private team, or beyond three a day', () => {
  const { ctx, ana, save } = setup();
  const loner = ctx.store.addPerson('Sola');
  save(loner, task('VIT-8', 'Sola', { stateType: 'unstarted', dueDate: '2026-11-25' }));
  for (let index = 0; index < MAX_NUDGES_PER_DAY + 2; index += 1) save(ana, task(`VIT-2${index}`, `Entrega ${index}`, { stateType: 'unstarted', dueDate: '2026-11-25' }));

  assert.equal(isWorkingTime(new Date('2026-11-24T03:00:00.000Z')), false);
  assert.equal(isWorkingTime(new Date('2026-11-28T15:00:00.000Z')), false);
  assert.equal(deliverNudges(ctx, new Date('2026-11-24T03:00:00.000Z')), 0);
  ctx.config.nudges = false;
  assert.equal(deliverNudges(ctx, TUESDAY_NOON), 0);
  ctx.config.nudges = true;
  assert.equal(deliverNudges(ctx, TUESDAY_NOON), MAX_NUDGES_PER_DAY);
  assert.equal(ctx.whatsapp.inboxOf(loner.token).recent.length, 0);
  assert.equal(deliverNudges(ctx, new Date(TUESDAY_NOON.getTime() + HOUR_MS)), 0);
});

test('a task with no progress for days asks its owner in private before anyone else hears about it', () => {
  const { ctx, ana, save } = setup();
  save(ana, task('VIT-30', 'Integración con ClassPass', {}, ago(5)));
  deliverNudges(ctx, TUESDAY_NOON);
  const pending = ctx.whatsapp.inboxOf(ana.token).pending;
  assert.equal(pending.length, 1);
  assert.match(pending[0]?.text ?? '', /^¿Le pido ayuda a tu equipo con «Integración con ClassPass»\?/);
  assert.deepEqual(pending[0]?.options.map((option) => option.label), ['Permitir', 'No contar']);
});
