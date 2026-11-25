import { Hono } from 'hono';
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
  const notes = db.prepare(`SELECT h.author_token, h.writer_label, h.body, h.updated_at FROM team_handoffs h
    JOIN team_members m ON h.team_id = m.team_id AND h.author_token = m.person_token
    WHERE h.team_id = ? AND h.body <> '' AND (h.writer_id = 'web' OR EXISTS (
      SELECT 1 FROM assistants a WHERE a.id = h.writer_id AND a.person_token = h.author_token AND a.revoked_at IS NULL))
    ORDER BY h.updated_at DESC`);
  const call = (owner: string, name: unknown, args: Record<string, unknown>) => {
    if (name === 'montu_admin_uso') {
      const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
      const rows = db.prepare(`SELECT p.token, p.name,
        (SELECT COUNT(*) FROM assistants a WHERE a.person_token = p.token AND a.revoked_at IS NULL) AS connected,
        (SELECT MAX(last_seen_at) FROM assistants a WHERE a.person_token = p.token) AS last_connection,
        (SELECT COUNT(*) FROM repo_commits r WHERE r.person_token = p.token) AS commits,
        COALESCE(SUM(u.reads), 0) AS reads, COALESCE(SUM(u.publications), 0) AS publications, MAX(u.last_at) AS last_activity
        FROM people p LEFT JOIN montu_context_activity u ON p.token = u.person_token AND u.day >= ?
        GROUP BY p.token, p.name ORDER BY p.name, p.token`).all(since);
      return { desdeUTC: since, medicion: 'Lecturas y cambios efectivos del traspaso registrados desde el despliegue. Los commits y la última conexión incluyen el historial previo.', personas: rows.filter((p) => !ctx.sim.isSynthetic(String(p.token))).map((p) => ({
        persona: publicIdOf(String(p.token)), nombre: p.name, registrosDeAsistenteActivos: Number(p.connected), ultimaConexionOAlta: p.last_connection,
        commitsHistoricos: Number(p.commits), lecturas: Number(p.reads), cambiosTraspaso: Number(p.publications), ultimaActividadContexto: p.last_activity,
      })) };
    }
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
