import { board, type Backend, type MessageView } from '@vercel/board';
import { local } from '@vercel/board/backend-local';
import { sha256 } from '../codes.js';
import type { AppContext } from '../context.js';
import { MESA_TEAM_ID } from '../mesa/store.js';
import { looksLikeCredential } from '../repo/validate.js';

export const threadTools = ['ronda_hilos', 'ronda_hilo', 'ronda_hilo_publicar', 'ronda_hilos_novedades'] as const;
export const entryKinds = ['hallazgo', 'pregunta', 'decision', 'cierre'] as const;
type Params = Record<string, unknown>;
type Writer = { id: string; label: string; personToken: string };
type Row = {
  id: number;
  team_id: string;
  topic: string;
  reference: string;
  op_key: string;
  root_id: number | null;
  label: string;
  person: string;
  agent: string;
  body: string;
  kind: string;
  created: string;
};
export class ThreadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}
function field(input: unknown, limit: number) {
  if (typeof input !== 'string' || !input.trim() || input.trim().length > limit || looksLikeCredential(input))
    throw new ThreadError('Revisa el texto, su largo y que no incluya credenciales.');
  return input.trim();
}
function refKey(value: string) {
  const pr = /^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+)(?:\/pull\/|#)(\d+)(?:[/?#].*)?$/i.exec(value);
  if (pr) return (pr[1] + '/' + pr[2] + '#' + pr[3]).toLowerCase();
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
}
function cursor(x: unknown) {
  if (x == null || x === '') return 0;
  const n = Number(x);
  if (!Number.isSafeInteger(n) || n < 0) throw new ThreadError('Cursor inválido.');
  return n;
}
const url = (r: Row) => '/equipo/' + r.team_id + '/hilos/' + r.topic;
const entry = (r: Row) => ({
  id: Number(r.id),
  hilo: r.topic,
  referencia: r.reference,
  titulo: r.label,
  persona: r.person,
  agente: r.agent,
  tipo: r.kind,
  texto: r.body,
  fecha: r.created,
  enlace: url(r),
});
function message(r: Row): MessageView {
  const handle = r.agent + ' de ' + r.person;
  return {
    id: String(r.id),
    re: r.root_id === null ? null : String(r.root_id),
    replyTo: null,
    channel: r.team_id,
    text: r.body,
    thread: r.topic,
    createdAt: r.created,
    editedAt: null,
    deleted: false,
    version: Number(r.id),
    revision: Number(r.id),
    by: { actor: handle, principal: handle, profile: null },
    author: { kind: 'deployment', handle, name: handle, avatar: null },
    labels: { tipo: r.kind },
    reactions: {},
    links: [],
    attachments: [],
    undelivered: {},
    noSync: false,
    origin: null,
    from: null,
    blocks: [],
  };
}

export function teamThreads(ctx: AppContext) {
  const { db } = ctx;
  db.exec(`CREATE TABLE IF NOT EXISTS montu_thread_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, team_id TEXT NOT NULL REFERENCES teams(id), topic TEXT NOT NULL,
    reference TEXT NOT NULL, op_key TEXT NOT NULL, root_id INTEGER, label TEXT NOT NULL, person TEXT NOT NULL,
    agent TEXT NOT NULL, body TEXT NOT NULL, kind TEXT NOT NULL, created TEXT NOT NULL,
    UNIQUE(team_id,topic,op_key)
  ); CREATE INDEX IF NOT EXISTS montu_thread_feed ON montu_thread_entries(team_id,id);`);
  // Only post() and reply() on the SDK handle are exposed. Their protocol writes
  // are committed to Montu's shared Postgres, including the idempotency key.
  const protocol = local({ memory: true });
  const get = (team: string, topic: string, key: string) =>
    db.prepare('SELECT * FROM montu_thread_entries WHERE team_id=? AND topic=? AND op_key=?').get(team, topic, key) as unknown as
      | Row
      | undefined;
  const allowed = (owner: string, team: string) => {
    if (team === MESA_TEAM_ID || !ctx.teams.isMember(team, owner) || ctx.rooms.roomOfTeam(team))
      throw new ThreadError('Este hilo requiere pertenecer al equipo privado.', 403);
  };
  return async (name: string, actor: Writer, args: Params) => {
    const team = field(args.equipo, 80);
    allowed(actor.personToken, team);
    if (name === 'ronda_hilos_novedades') {
      const rows = db
        .prepare('SELECT * FROM montu_thread_entries WHERE team_id=? AND id>? AND root_id IS NOT NULL ORDER BY id LIMIT 60')
        .all(team, cursor(args.desde)) as unknown as Row[];
      return { mensajes: rows.map(entry) };
    }
    if (name === 'ronda_hilos') {
      const q = String(args.buscar ?? '')
        .trim()
        .toLowerCase()
        .slice(0, 180);
      const needle = '%' + refKey(q).replace(/[!%_]/g, '!$&') + '%';
      const until = cursor(args.antes);
      const rows = db
        .prepare(
          `SELECT r.*, MAX(m.id) AS last_id FROM montu_thread_entries r JOIN montu_thread_entries m ON r.team_id=m.team_id AND r.topic=m.topic AND m.root_id IS NOT NULL
        WHERE r.team_id=? AND r.root_id IS NULL AND (LOWER(r.reference) LIKE ? ESCAPE '!' OR LOWER(r.label) LIKE ? ESCAPE '!' OR EXISTS
        (SELECT 1 FROM montu_thread_entries a WHERE a.team_id=r.team_id AND a.topic=r.topic AND LOWER(a.person) LIKE ? ESCAPE '!'))
        GROUP BY r.id HAVING (?=0 OR MAX(m.id)<?) ORDER BY MAX(m.id) DESC LIMIT 41`,
        )
        .all(team, needle, needle, needle, until, until) as unknown as (Row & { last_id: number })[];
      return { hilos: rows.slice(0, 40).map(entry), antes: rows.length > 40 ? Number(rows[39]!.last_id) : null };
    }
    const topic = args.hilo ? field(args.hilo, 64) : sha256(refKey(field(args.referencia, 200))).slice(0, 24);
    let root = get(team, topic, 'root');
    if (name === 'ronda_hilo') {
      if (!root) throw new ThreadError('Hilo no encontrado.', 404);
      const until = cursor(args.antes);
      const rows = db
        .prepare(
          'SELECT * FROM montu_thread_entries WHERE team_id=? AND topic=? AND root_id IS NOT NULL AND (?=0 OR id<?) ORDER BY id DESC LIMIT 41',
        )
        .all(team, topic, until, until) as unknown as Row[];
      return { ...entry(root), mensajes: rows.slice(0, 40).reverse().map(entry), antes: rows.length > 40 ? Number(rows[39]!.id) : null };
    }
    if (name !== 'ronda_hilo_publicar') throw new ThreadError('Operación desconocida.');
    if (!root && args.hilo) throw new ThreadError('Hilo no encontrado.', 404);
    const ref = root?.reference ?? refKey(field(args.referencia, 200));
    const title = root?.label ?? field(args.titulo ?? args.referencia, 200);
    const body = field(args.texto, 2000);
    const kind = String(args.tipo ?? 'hallazgo');
    if (!entryKinds.some((k) => k === kind)) throw new ThreadError('Tipo de actualización desconocido.');
    const key = sha256(actor.id + '|' + field(args.clave, 180));
    const person = ctx.store.findPerson(actor.personToken)!.name;
    const backend: Backend = {
      ...protocol,
      bind() {},
      settlesMentions: true,
      async post(_caller, input) {
        allowed(actor.personToken, team);
        const isReply = input.re != null;
        const op = isReply ? key : 'root';
        db.prepare(
          `INSERT INTO montu_thread_entries(team_id,topic,reference,op_key,root_id,label,person,agent,body,kind,created)
        VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(team_id,topic,op_key) DO NOTHING`,
        ).run(
          team,
          topic,
          ref,
          op,
          isReply ? Number(input.re) : null,
          title,
          person,
          actor.label,
          input.text,
          isReply ? kind : 'inicio',
          new Date().toISOString(),
        );
        const row = get(team, topic, op)!;
        if (isReply && (row.body !== input.text || row.kind !== kind))
          throw new ThreadError('La clave ya corresponde a otra actualización.', 409);
        return { message: message(row) };
      },
    };
    const handle = board({ backend }).as(actor.id);
    if (!root) {
      await handle.post(team, { text: title, id: topic });
      root = get(team, topic, 'root')!;
    }
    const previous = get(team, topic, key);
    if (previous && (previous.body !== body || previous.kind !== kind))
      throw new ThreadError('La clave ya corresponde a otra actualización.', 409);
    await handle.reply(String(root.id), { text: body, id: key });
    return entry(get(team, topic, key)!);
  };
}
