import { Hono } from 'hono';
import { CONNECTORS } from '../connectors/registry.js';
import { findHubSource } from '../hub/catalog.js';
import { memberWork } from '../assistants/teamContext.js';
import { sha256, publicIdOf } from '../codes.js';
import type { AppContext } from '../context.js';
import { openLoginStore } from '../logins.js';
import { MESA_TEAM_ID } from '../mesa/store.js';
import { rateLimit } from '../rateLimit.js';
import { sessionTokenOf } from '../session.js';
import { asObject } from './shared.js';

const empty = { type: 'object', properties: {}, additionalProperties: false };
const tools = [
  { name: 'montu_admin_uso', description: 'Actividad operativa por persona. Contadores de contexto de los últimos 30 días UTC desde que comenzó la medición, conexiones y cambios históricos del repo.' , inputSchema: empty },
  { name: 'montu_admin_contextos', description: 'Directorio de contextos compartidos en tus equipos privados, con los traspasos actuales y los archivos disponibles por persona.', inputSchema: empty },
  { name: 'montu_admin_archivo', description: 'Lee un archivo compartido del directorio con su fecha y autor.', inputSchema: { type: 'object', properties: { equipo: { type: 'string' }, persona: { type: 'string' }, ruta: { type: 'string' } }, required: ['equipo', 'persona', 'ruta'], additionalProperties: false } },
].map((tool) => ({ ...tool, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } }));

const CLIENTS = ['claude-code', 'codex'] as const;
const DIGEST = /^[0-9a-f]{64}$/;

export function adminMcpRoutes(ctx: AppContext) {
  const { db, teams, rooms, repo } = ctx;
  const logins = openLoginStore(db);
  const operator = (owner: string) => Boolean(ctx.config.oauth.google && ctx.config.mesaOperators?.includes(logins.loginOf(owner)?.email.toLowerCase() ?? ''));
  const api = new Hono();
  db.exec(`CREATE TABLE IF NOT EXISTS montu_admin_grants (
    token_hash TEXT PRIMARY KEY, assistant_id TEXT NOT NULL UNIQUE REFERENCES assistants (id), created_at TEXT NOT NULL
  );`);
  api.post('/operator/bind', rateLimit(20), async (c) => {
    const owner = sessionTokenOf(c, ctx.vault);
    if (!owner) return c.json({ error: 'Entra con Google a Montu.' }, 401);
    if (!operator(owner)) return c.json({ error: 'La cuenta requiere acceso de operador de Montu.' }, 403);
    if (!c.req.header('content-type')?.startsWith('application/json') || c.req.header('sec-fetch-site') === 'cross-site') return c.json({ error: 'Vincula desde Montu.' }, 403);
    const body = asObject(await c.req.text());
    if (body.email !== logins.loginOf(owner)?.email.toLowerCase()) return c.json({ error: 'Entra con la cuenta indicada por tu instalador.' }, 403);
    const { personal, admin } = body;
    if (!Array.isArray(personal) || !Array.isArray(admin) || personal.length !== 2 || admin.length !== 2 ||
        ![...personal, ...admin].every((v) => typeof v === 'string' && DIGEST.test(v)) || new Set([...personal, ...admin]).size !== 4) {
      return c.json({ error: 'El enlace de vinculación no está completo.' }, 400);
    }
    db.exec('BEGIN');
    try {
      for (const [i, client] of CLIENTS.entries()) {
        const assistant = ctx.assistants.bindLocal(owner, client, personal[i]);
        if (!assistant) {
          db.exec('ROLLBACK');
          return c.json({ error: 'Revisa los agentes conectados. La clave puede estar revocada o puedes haber llegado al límite.' }, 409);
        }
        db.prepare('INSERT INTO montu_admin_grants (token_hash, assistant_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(admin[i], assistant.id, new Date().toISOString());
        if (!db.prepare('SELECT assistant_id FROM montu_admin_grants WHERE token_hash = ? AND assistant_id = ?').get(admin[i], assistant.id)) {
          db.exec('ROLLBACK');
          return c.json({ error: 'Esta instalación ya tiene otra vinculación.' }, 409);
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return c.json({ ok: true });
  });

  const myTeams = (owner: string) => teams.teamsOf(owner).filter((team) => team.id !== MESA_TEAM_ID && !rooms.roomOfTeam(team.id));
  const members = (teamId: string) => teams.membersOf(teamId).filter((p) => !ctx.sim.isSynthetic(p.token));
  const notes = db.prepare(`SELECT h.author_token, h.writer_id, h.writer_label, h.body, h.updated_at FROM team_handoffs h
    JOIN team_members m ON h.team_id = m.team_id AND h.author_token = m.person_token
    WHERE h.team_id = ? AND h.body <> '' AND (h.writer_id = 'web' OR EXISTS (
      SELECT 1 FROM assistants a WHERE a.id = h.writer_id AND a.person_token = h.author_token AND a.revoked_at IS NULL))
    ORDER BY h.updated_at DESC`);
  const usage = () => {
    const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const rows = db.prepare(`SELECT p.token, p.name,
      (SELECT COUNT(*) FROM assistants a WHERE a.person_token = p.token AND a.revoked_at IS NULL) AS connected,
      (SELECT MAX(last_seen_at) FROM assistants a WHERE a.person_token = p.token) AS last_connection,
      (SELECT COUNT(*) FROM repo_commits r WHERE r.person_token = p.token) AS commits,
      COALESCE(SUM(u.reads), 0) AS reads, COALESCE(SUM(u.publications), 0) AS publications, MAX(u.last_at) AS last_activity
      FROM people p LEFT JOIN montu_context_activity u ON p.token = u.person_token AND u.day >= ?
      WHERE NOT EXISTS (SELECT 1 FROM sim_people s WHERE s.person_token = p.token)
      GROUP BY p.token, p.name ORDER BY p.name, p.token`).all(since);
    return { desdeUTC: since, medicion: 'Lecturas y cambios efectivos del traspaso registrados desde el despliegue. Los commits y la última conexión incluyen el historial previo.', personas: rows.map((p) => ({
      persona: publicIdOf(String(p.token)), nombre: p.name, registrosDeAsistenteActivos: Number(p.connected), ultimaConexionOAlta: p.last_connection,
      commitsHistoricos: Number(p.commits), lecturas: Number(p.reads), cambiosTraspaso: Number(p.publications), ultimaActividadContexto: p.last_activity,
    })) };
  };
  const call = (owner: string, name: unknown, args: Record<string, unknown>) => {
    if (name === 'montu_admin_uso') return usage();
    const visibleTeams = myTeams(owner);
    if (name === 'montu_admin_contextos') return { equipos: visibleTeams.map((team) => {
      const handoffs = notes.all(team.id);
      return { id: team.id, nombre: team.name, personas: members(team.id).map((p) => ({
        id: publicIdOf(p.token), ...memberWork(ctx, p, new Date()),
        archivos: repo.shared(p.token).map(({ path, updatedAt }) => ({ ruta: path, actualizado: updatedAt })),
        traspasos: handoffs.filter((h) => h.author_token === p.token).map((h) => ({ agente: h.writer_label, texto: h.body, actualizado: h.updated_at })),
      })) };
    }) };
    if (name === 'montu_admin_archivo') {
      const team = visibleTeams.find((t) => t.id === args.equipo);
      const p = team && members(team.id).find((m) => publicIdOf(m.token) === args.persona);
      const file = p && typeof args.ruta === 'string' ? repo.read(p.token, args.ruta) : undefined;
      if (file?.share === 'siempre') return { equipo: team!.name, persona: p!.name, ruta: file.path, texto: file.content, actualizado: file.updatedAt };
    }
    return null;
  };

  const agentQuery = `SELECT a.person_token, a.id, a.kind, a.label, a.created_at, a.last_seen_at,
    g.assistant_id IS NOT NULL AS has_grant FROM assistants a LEFT JOIN montu_admin_grants g ON g.assistant_id = a.id
    WHERE a.revoked_at IS NULL`;
  const toAgent = (a: Record<string, unknown>) => ({
    id: a.id, tipo: a.kind, nombre: a.label, creado: a.created_at, ultimaConexion: a.last_seen_at, admin: Boolean(a.has_grant),
  });
  const sources = (token: string) => {
    const connections = db.prepare('SELECT source, connected_at, last_synced_at, last_error IS NOT NULL AS failed FROM connections WHERE person_token = ?').all(token);
    const sync = ctx.store.syncBySource(token);
    const fuentes = CONNECTORS.map((source) => {
      const saved = connections.find((r) => r.source === source.id);
      const imported = sync[source.id];
      return { id: source.id, nombre: source.label, estado: saved?.failed ? 'Revisar sincronización' : saved ? 'Conectado' : imported ? 'Con registros' : 'Sin conectar',
        desde: saved?.connected_at ?? null, ultimaCarga: saved?.last_synced_at ?? imported?.last ?? null, registros: imported?.total ?? 0 };
    });
    const hub = db.prepare(`SELECT c.source, c.connected_at, MAX(i.received_at) AS last_import, COUNT(i.id) AS total
      FROM hub_connections c LEFT JOIN hub_items i ON i.person_token = c.person_token AND i.source = c.source
      WHERE c.person_token = ? GROUP BY c.source, c.connected_at ORDER BY c.source`).all(token);
    for (const row of hub) {
      const id = String(row.source);
      fuentes.push({ id: 'hub-' + id, nombre: findHubSource(id)?.label ?? id, estado: 'Registrado en el hub',
        desde: String(row.connected_at), ultimaCarga: row.last_import == null ? null : String(row.last_import), registros: Number(row.total) });
    }
    return fuentes;
  };

  api.use('/operator/directory/*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    const owner = sessionTokenOf(c, ctx.vault);
    if (!owner) return c.json({ error: 'Entra con tu cuenta de Google.' }, 401);
    if (!operator(owner)) return c.json({ error: 'Tu cuenta requiere acceso al panel de Montu.' }, 403);
    return next();
  });

  api.get('/operator/directory/index', (c) => {
    const owner = sessionTokenOf(c, ctx.vault)!;
    const equipos = myTeams(owner).map((t) => ({ id: t.id, nombre: t.name, miembros: members(t.id).map((m) => publicIdOf(m.token)) }));
    const visible = new Set([publicIdOf(owner), ...equipos.flatMap((t) => t.miembros)]);
    const ids = new Map(ctx.store.listPeople().map((p) => [publicIdOf(p.token), p.token]));
    const agents = new Map<string, ReturnType<typeof toAgent>[]>();
    for (const a of db.prepare(agentQuery + ' ORDER BY a.created_at, a.id').all()) {
      const token = String(a.person_token);
      const list = agents.get(token) ?? [];
      list.push(toAgent(a));
      agents.set(token, list);
    }
    const totals = usage();
    return c.json({
      yo: publicIdOf(owner), desdeUTC: totals.desdeUTC, equipos,
      personas: totals.personas.map((p) => {
        const token = ids.get(p.persona)!;
        return { ...p, agentes: agents.get(token) ?? [], fuentes: visible.has(p.persona) ? sources(token).filter((f) => f.estado !== 'Sin conectar') : [] };
      }),
    });
  });

  api.get('/operator/directory/person/:id', (c) => {
    const owner = sessionTokenOf(c, ctx.vault)!;
    const p = ctx.store.listPeople().find((v) => publicIdOf(v.token) === c.req.param('id'));
    if (!p || ctx.sim.isSynthetic(p.token)) return c.notFound();
    const mine = p.token === owner;
    const common = myTeams(owner).filter((t) => teams.isMember(t.id, p.token));
    const visible = mine || common.length > 0;
    const fileId = c.req.query('archivo');
    if (fileId !== undefined) {
      const entry = visible && ctx.repo.tree(p.token).find((f) => (mine || f.share === 'siempre') && publicIdOf(f.path) === fileId);
      const file = entry && ctx.repo.read(p.token, entry.path);
      if (!file || (!mine && file.share !== 'siempre')) return c.notFound();
      return c.json({ ruta: file.path, texto: file.content, actualizado: file.updatedAt });
    }
    return c.json({
      id: publicIdOf(p.token), nombre: p.name, propia: mine, visible,
      agentes: db.prepare(agentQuery + ' AND a.person_token = ? ORDER BY a.created_at, a.id').all(p.token).map(toAgent),
      fuentes: visible ? sources(p.token) : [], contexto: visible ? memberWork(ctx, p, new Date(), mine) : null,
      archivos: visible ? repo.tree(p.token).filter((f) => mine || f.share === 'siempre').map((f) => ({
        id: publicIdOf(f.path), ruta: f.path, permiso: f.share, actualizado: f.updatedAt, autor: f.updatedBy,
      })) : [],
      traspasos: common.flatMap((t) => notes.all(t.id).filter((h) => h.author_token === p.token).map((h) => ({
        id: publicIdOf(t.id + '/' + h.writer_id), agenteId: h.writer_id, agente: h.writer_label, equipo: t.name, texto: h.body, actualizado: h.updated_at,
      }))),
    });
  });

  const path = '/operator/mcp';
  api.post(path, rateLimit(120), async (c) => {
    c.header('Cache-Control', 'private, no-store');
    const secret = /^Bearer (mta_[a-zA-Z0-9_-]+)$/i.exec(c.req.header('authorization') ?? '')?.[1];
    const grant = secret && db.prepare(`SELECT a.person_token FROM montu_admin_grants g JOIN assistants a ON a.id = g.assistant_id
      WHERE g.token_hash = ? AND a.revoked_at IS NULL`).get(sha256(secret));
    if (!grant) return c.json({ error: 'Vincula el MCP administrativo en Montu.' }, 401, { 'WWW-Authenticate': 'Bearer' });
    const owner = String(grant.person_token);
    if (!operator(owner)) return c.json({ error: 'Se requiere acceso de operador.' }, 403);
    const { id, method, params } = asObject(await c.req.text());
    const result = (value: unknown) => c.json({ jsonrpc: '2.0', id, result: value });
    const error = (code: number, message: string) => c.json({ jsonrpc: '2.0', id, error: { code, message } });
    const p = asObject(JSON.stringify(params ?? {}));
    if (id === undefined) return c.body(null, 202);
    if (method === 'initialize') return result({ protocolVersion: p.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'montu-admin', version: '1' } });
    if (method === 'ping') return result({});
    if (method === 'tools/list') return result({ tools });
    if (method !== 'tools/call') return error(-32601, 'Método desconocido.');
    const payload = call(owner, p.name, asObject(JSON.stringify(p.arguments ?? {})));
    if (payload === null) return result({ isError: true, content: [{ type: 'text', text: 'Herramienta o archivo no disponible.' }] });
    return result({ content: [{ type: 'text', text: JSON.stringify(payload) }] });
  });
  api.get(path, (c) => c.body(null, 405, { allow: 'POST' }));
  return api;
}
