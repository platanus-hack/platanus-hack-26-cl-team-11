import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppContext } from './context.js';
import { duelRoutes } from './duels/routes.js';
import { adminRoutes } from './routes/admin.js';
import { agentDoorRoutes } from './routes/agentDoor.js';
import { agentRoutes } from './routes/agents.js';
import { assistantRoutes, joinDocRoutes } from './routes/assistants.js';
import { boardRoutes } from './routes/board.js';
import { checkinRoutes } from './routes/checkins.js';
import { connectionRoutes } from './routes/connections.js';
import { hubRoutes } from './routes/hub.js';
import { ingestRoutes } from './routes/ingest.js';
import { oauthRoutes } from './routes/oauth.js';
import { peopleRoutes } from './routes/people.js';
import { pulseRoutes } from './routes/pulse.js';
import { REPO_COMMIT_PATH, REPO_PASTE_SUFFIX, repoRoutes } from './routes/repo.js';
import { mesaRoutes } from './routes/mesa.js';
import { roomRoutes } from './routes/rooms.js';
import { chatRoutes } from './routes/chat.js';
import { faceRoutes } from './routes/faces.js';
import { profileRoutes } from './routes/profile.js';
import { signalRoutes } from './routes/signals.js';
import { simRoutes } from './routes/sim.js';
import { teamRoutes } from './routes/teams.js';
import { WHATSAPP_WEBHOOK_PATH, whatsappRoutes } from './routes/whatsapp.js';
import { onboardingRoutes } from './routes/onboarding.js';
import { securityHeaders } from './securityHeaders.js';
import { ConnectorError } from './types.js';
import { databaseStats } from './pg/database.js';

const DEFAULT_MAX_BODY_BYTES = 10_000;
const INGEST_PATH_PREFIX = '/api/ingest/';

const setsItsOwnLimit = (path: string) => path.startsWith(INGEST_PATH_PREFIX) || path === REPO_COMMIT_PATH || path === WHATSAPP_WEBHOOK_PATH || path.endsWith(REPO_PASTE_SUFFIX);

const SLOW_REQUEST_MS = 150;

export function createApp(ctx: AppContext) {
  const api = new Hono();
  const limitBody = bodyLimit({ maxSize: DEFAULT_MAX_BODY_BYTES, onError: (c) => c.json({ error: 'El contenido es demasiado largo.' }, 413) });

  api.onError((failure, c) => {
    if (failure instanceof ConnectorError) return c.json({ error: failure.message }, failure.status as ContentfulStatusCode);
    console.error(failure);
    return c.json({ error: 'Error interno.' }, 500);
  });

  api.use('*', async (c, next) => {
    const started = performance.now();
    const queries = databaseStats.queries;
    const spent = databaseStats.ms;
    await next();
    const total = performance.now() - started;
    const asked = databaseStats.queries - queries;
    c.res.headers.append('Server-Timing', `db;dur=${(databaseStats.ms - spent).toFixed(1)};desc="${asked} consultas", total;dur=${total.toFixed(1)}`);
    if (total >= SLOW_REQUEST_MS) console.warn(`Pedido lento: ${c.req.method} ${c.req.routePath} tardó ${Math.round(total)} ms, ${Math.round(databaseStats.ms - spent)} ms en la base con ${asked} consultas.`);
  });
  api.use('*', (c, next) => (setsItsOwnLimit(c.req.path) ? next() : limitBody(c, next)));
  api.get('/health', (c) => c.json({ ok: true }));
  api.route('/duelos', duelRoutes(ctx));
  api.route('/', peopleRoutes(ctx));
  api.route('/', connectionRoutes(ctx));
  api.route('/', ingestRoutes(ctx));
  api.route('/', oauthRoutes(ctx));
  api.route('/', signalRoutes(ctx));
  api.route('/', teamRoutes(ctx));
  api.route('/', checkinRoutes(ctx));
  api.route('/', boardRoutes(ctx));
  api.route('/', pulseRoutes(ctx));
  api.route('/', hubRoutes(ctx));
  api.route('/', agentRoutes(ctx));
  api.route('/', roomRoutes(ctx));
  api.route('/', mesaRoutes(ctx));
  api.route('/', adminRoutes(ctx));
  api.route('/', assistantRoutes(ctx));
  api.route('/', repoRoutes(ctx));
  api.route('/', simRoutes(ctx));
  api.route('/', whatsappRoutes(ctx));
  api.route('/', agentDoorRoutes(ctx));
  api.route('/', onboardingRoutes(ctx));
  api.route('/', profileRoutes(ctx));
  api.route('/', faceRoutes(ctx));
  api.route('/', chatRoutes(ctx));

  return new Hono().use('*', securityHeaders()).route('/api', api).route('/', joinDocRoutes(ctx));
}
