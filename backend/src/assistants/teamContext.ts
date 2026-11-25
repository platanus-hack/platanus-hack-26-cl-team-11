import { activityOf } from '../admin/activity.js';
import { agendaOf } from '../agents/cards.js';
import { currentDigest } from '../agents/digest.js';
import { cardDepsFrom } from '../agents/deps.js';
import type { AppContext } from '../context.js';
import { MESA_TEAM_ID } from '../mesa/store.js';
import { withoutDemo } from '../nudges/detectors.js';
import { looksLikeCredential } from '../repo/validate.js';
import { deriveSignals } from '../signals.js';
import { isVisibleTo, viewProposal } from '../routes/agents.js';

export const MAX_HANDOFF = 2000;
export interface Writer {
  id: string;
  label: string;
}

export function memberWork(ctx: AppContext, person: { token: string; name: string }, now: Date, includeOwn = false) {
  const policy = cardDepsFrom(ctx).policies.get(person.token);
  const events = withoutDemo(ctx.store.listSignalEvents(person.token, now));
  const sharesWork = includeOwn || policy.expertise === 'siempre';
  const signals = sharesWork ? deriveSignals(events, now) : null;
  const digest = sharesWork ? currentDigest(ctx, person.token) : undefined;
  return {
    nombre: person.name,
    trabajo: [...new Set([...(signals?.focus ?? []), ...(digest?.workingOn ?? [])])],
    temas: [...new Set([...(signals?.expertise ?? []), ...(digest?.expertise ?? [])])],
    agenda: includeOwn || policy.load === 'siempre' ? agendaOf(events, now) : [],
  };
}

export function teamContext(ctx: AppContext) {
  const { db, teams, rooms, store } = ctx;
  const activity = activityOf(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_handoffs (
      team_id TEXT NOT NULL REFERENCES teams (id),
      author_token TEXT NOT NULL REFERENCES people (token),
      writer_id TEXT NOT NULL,
      writer_label TEXT NOT NULL,
      body TEXT NOT NULL,
      revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (team_id, author_token, writer_id),
      FOREIGN KEY (team_id, author_token) REFERENCES team_members (team_id, person_token) ON DELETE CASCADE
    );
  `);
  const privateTeams = (owner: string) => teams.teamsOf(owner).filter((team) => team.id !== MESA_TEAM_ID && !rooms.roomOfTeam(team.id));
  const notes = db.prepare(`SELECT h.author_token, h.writer_id, h.writer_label, h.body, h.updated_at, h.revision
    FROM team_handoffs h JOIN team_members m ON m.team_id = h.team_id AND m.person_token = h.author_token
    WHERE h.team_id = ? AND (h.writer_id = 'web' OR EXISTS (
      SELECT 1 FROM assistants a WHERE a.id = h.writer_id AND a.person_token = h.author_token AND a.revoked_at IS NULL
    )) ORDER BY h.updated_at DESC, h.writer_id`);

  const read = (owner: string, writer: Writer) => {
    const now = new Date();
    const person = store.findPerson(owner);
    const sync = store.syncBySource(owner);
    const snapshot = {
      consultado: now.toISOString(),
      persona: person?.name,
      equipos: privateTeams(owner).map((team) => {
        const members = teams.membersOf(team.id).filter((member) => !ctx.sim.isSynthetic(member.token));
        const names = new Map(members.map((member) => [member.token, member.name]));
        const rows = notes.all(team.id);
        return {
          id: team.id,
          nombre: team.name,
          hilos: `/equipo/${team.id}/hilos`,
          miRevision: Number(rows.find((row) => row.author_token === owner && row.writer_id === writer.id)?.revision ?? 0),
          personas: members.map((member) => memberWork(ctx, member, now, member.token === owner)),
          traspasos: rows.filter((row) => names.has(String(row.author_token)) && row.body).map((row) => ({
            autor: names.get(String(row.author_token)), mio: row.author_token === owner && row.writer_id === writer.id, agente: row.writer_label, texto: row.body, actualizado: row.updated_at,
          })),
          propuestas: ctx.agents.proposalsOf(team.id, 20).filter((proposal) => isVisibleTo(proposal, owner)).map((proposal) => viewProposal(proposal, owner)),
        };
      }),
      misFuentes: ['linear', 'google_calendar'].map((id) => ({ id, conectada: Boolean(store.findConnection(owner, id)), ultimaCarga: sync[id]?.last ?? null })),
      miContexto: ctx.repo.shared(owner).filter((file) => ['README.md', 'ahora.md', 'sabe.md'].includes(file.path))
        .map(({ path, content, updatedAt }) => ({ path, content, updatedAt })),
      miBandeja: ctx.whatsapp.inboxOf(owner),
    };
    activity(owner, 'read');
    return snapshot;
  };

  const publish = (owner: string, writer: Writer, args: Record<string, unknown>) => {
    const team = privateTeams(owner).find(({ id }) => id === args.equipo);
    if (!team) return { error: 'Elige uno de tus equipos privados en ronda_contexto.', status: 403 } as const;
    const { revision, texto } = args;
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 || typeof texto !== 'string' ||
        texto.length > MAX_HANDOFF || looksLikeCredential(texto)) {
      return { error: 'Revisa miRevision y el texto del traspaso (hasta 2000 caracteres, sin credenciales).', status: 422 } as const;
    }
    const body = texto.trim();
    const key = [team.id, owner, writer.id];
    const previous = db.prepare('SELECT body, revision FROM team_handoffs WHERE team_id = ? AND author_token = ? AND writer_id = ?').get(...key);
    if (previous?.body === body || (!previous && !body)) return { revision: Number(previous?.revision ?? 0) };
    const at = new Date().toISOString();
    db.exec('BEGIN');
    try {
      const changed = revision === 0
        ? db.prepare('INSERT INTO team_handoffs (team_id, author_token, writer_id, writer_label, body, revision, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?) ON CONFLICT DO NOTHING').run(...key, writer.label, body, at)
        : db.prepare('UPDATE team_handoffs SET body = ?, revision = revision + 1, updated_at = ? WHERE team_id = ? AND author_token = ? AND writer_id = ? AND revision = ?').run(body, at, ...key, revision);
      if (!changed.changes) {
        db.exec('ROLLBACK');
        return { error: 'El traspaso cambió. Lee el contexto y combina los cambios antes de guardar.', status: 409 } as const;
      }
      activity(owner, 'publish');
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return { revision: revision + 1 };
  };
  return { read, publish };
}
