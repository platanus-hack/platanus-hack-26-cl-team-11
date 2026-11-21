import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.INTEGRATIONS_DATA_DIR ?? join(here, 'data');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, 'integrations.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS people (
    token TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_token TEXT NOT NULL,
    source TEXT NOT NULL,
    type TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    summary TEXT NOT NULL,
    raw TEXT NOT NULL,
    received_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_person ON events (person_token, received_at);
`);

const SOURCES = [
  { id: 'apple_health', label: 'Apple Health', how: 'Atajo de iOS' },
  { id: 'google_calendar', label: 'Google Calendar', how: 'Cuenta de Google' },
  { id: 'gmail', label: 'Gmail', how: 'Cuenta de Google' },
  { id: 'granola', label: 'Granola', how: 'Llave personal' },
  { id: 'github', label: 'GitHub', how: 'Cuenta de GitHub' },
];

const MAX_BODY_BYTES = 1_000_000;
const now = () => new Date().toISOString();
const findPerson = (token) => db.prepare('SELECT token, name FROM people WHERE token = ?').get(token);

function addPerson(name) {
  const token = randomBytes(18).toString('base64url');
  db.prepare('INSERT INTO people (token, name, created_at) VALUES (?, ?, ?)').run(token, name, now());
  return token;
}

function saveEvent({ personToken, source, type, occurredAt, summary, raw }) {
  const result = db
    .prepare('INSERT INTO events (person_token, source, type, occurred_at, summary, raw, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(personToken, source, type, occurredAt, summary, JSON.stringify(raw), now());
  return Number(result.lastInsertRowid);
}

function listEvents(personToken, limit = 50) {
  return db
    .prepare('SELECT id, source, type, occurred_at, summary, raw, received_at FROM events WHERE person_token = ? ORDER BY id DESC LIMIT ?')
    .all(personToken, limit)
    .map((row) => ({ ...row, raw: JSON.parse(row.raw) }));
}

function lastSyncBySource(personToken) {
  const rows = db
    .prepare('SELECT source, MAX(received_at) AS last, COUNT(*) AS total FROM events WHERE person_token = ? GROUP BY source')
    .all(personToken);
  return Object.fromEntries(rows.map((row) => [row.source, { last: row.last, total: row.total }]));
}

const toNumber = (value) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

function healthEventFrom(payload) {
  const sleepHours = toNumber(payload.sleep_hours);
  const restingHeartRate = toNumber(payload.resting_hr);
  const steps = toNumber(payload.steps);
  const parts = [];
  if (sleepHours !== null) parts.push(`sueño ${sleepHours.toFixed(1)} h`);
  if (restingHeartRate !== null) parts.push(`pulso en reposo ${Math.round(restingHeartRate)} lpm`);
  if (steps !== null) parts.push(`${Math.round(steps)} pasos`);
  return {
    type: 'salud_diaria',
    occurredAt: typeof payload.date === 'string' && payload.date ? payload.date : now(),
    summary: parts.length ? parts.join(' · ') : 'datos de salud recibidos sin campos reconocidos',
  };
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { value: parsed };
  } catch {
    return { unparsed_text: text };
  }
}

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function connectPage(person, baseUrl) {
  const sync = lastSyncBySource(person.token);
  const ingestUrl = `${baseUrl}/ingest/health/${person.token}`;
  const rows = SOURCES.map((source) => {
    const state = sync[source.id];
    const status = state
      ? `<span class="ok">Conectado</span><small>${state.total} registros · último ${escapeHtml(state.last)}</small>`
      : source.id === 'apple_health'
        ? '<span class="wait">Esperando el primer envío</span>'
        : '<span class="soon">Próximamente</span>';
    return `<li><div><strong>${source.label}</strong><small>${source.how}</small></div><div class="status">${status}</div></li>`;
  }).join('');
  const recent = listEvents(person.token, 8)
    .map((event) => `<li><div><strong>${escapeHtml(event.summary)}</strong><small>${escapeHtml(event.source)} · ${escapeHtml(event.received_at)}</small></div></li>`)
    .join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conectar</title><style>
body{margin:0;background:#f2f2f5;color:#111;font-family:-apple-system,"Helvetica Neue",Arial,sans-serif}
main{max-width:560px;margin:0 auto;padding:28px 16px 48px}
h1{font-size:30px;margin:0 0 4px}p{color:#555;line-height:1.45}
ul{list-style:none;margin:16px 0;padding:0;background:#fff;border-radius:20px;overflow:hidden}
li{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:16px 18px;border-top:1px solid #ececf0}li:first-child{border-top:0}
small{display:block;color:#777;font-size:13px;margin-top:3px}.status{text-align:right}
.ok{color:#0a7d3b;font-weight:600}.wait{color:#b25e00;font-weight:600}.soon{color:#999}
code{display:block;background:#fff;border-radius:14px;padding:14px;font-size:13px;word-break:break-all}
h2{font-size:17px;margin:28px 0 0}
</style></head><body><main>
<h1>Hola, ${escapeHtml(person.name)}</h1><p>Conecta tus fuentes. Lo que entra aquí queda en tu memoria privada.</p>
<ul>${rows}</ul>
<h2>Apple Health</h2><p>Tu Atajo debe enviar un POST con JSON a esta dirección. Es personal: no la compartas.</p><code>${escapeHtml(ingestUrl)}</code>
<h2>Últimos registros</h2><ul>${recent || '<li><div><small>Todavía no llega nada.</small></div></li>'}</ul>
</main></body></html>`;
}

function send(response, status, body, contentType = 'application/json; charset=utf-8') {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  response.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' });
  response.end(payload);
}

async function handle(request, response) {
  const url = new URL(request.url, 'http://localhost');
  const baseUrl = process.env.PUBLIC_BASE_URL ?? `${request.headers['x-forwarded-proto'] ?? 'http'}://${request.headers.host}`;
  const [, first, second, third] = url.pathname.split('/');

  if (request.method === 'GET' && url.pathname === '/health') return send(response, 200, { ok: true });

  if (first === 'ingest' && second === 'health' && request.method === 'POST') {
    const person = findPerson(third ?? '');
    if (!person) return send(response, 404, { error: 'token desconocido' });
    const payload = await readJson(request);
    const event = healthEventFrom(payload);
    const id = saveEvent({ personToken: person.token, source: 'apple_health', raw: payload, ...event });
    return send(response, 201, { ok: true, id, summary: event.summary });
  }

  if (first === 'conectar' && request.method === 'GET') {
    const person = findPerson(second ?? '');
    if (!person) return send(response, 404, 'Link no válido.', 'text/plain; charset=utf-8');
    return send(response, 200, connectPage(person, baseUrl), 'text/html; charset=utf-8');
  }

  if (first === 'events' && request.method === 'GET') {
    const person = findPerson(second ?? '');
    if (!person) return send(response, 404, { error: 'token desconocido' });
    return send(response, 200, { person: person.name, events: listEvents(person.token) });
  }

  return send(response, 404, { error: 'no encontrado' });
}

const [command, ...args] = process.argv.slice(2);

if (command === 'add-person') {
  const name = args.join(' ').trim();
  if (!name) {
    console.error('Uso: node integrations/server.mjs add-person "Nombre"');
    process.exit(1);
  }
  const token = addPerson(name);
  console.log(`Persona creada: ${name}`);
  console.log(`Página de conexión: /conectar/${token}`);
  console.log(`Envío de Apple Health: POST /ingest/health/${token}`);
} else {
  const port = Number(process.env.PORT ?? 8787);
  createServer((request, response) => {
    handle(request, response).catch((error) => send(response, error.status ?? 500, { error: error.message }));
  }).listen(port, () => console.log(`Integraciones escuchando en http://localhost:${port}`));
}
