import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppContext } from './context.js';
import { duelRoutes } from './duels/routes.js';
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
import { roomRoutes } from './routes/rooms.js';
import { signalRoutes } from './routes/signals.js';
import { simRoutes } from './routes/sim.js';
import { teamRoutes } from './routes/teams.js';
import { ConnectorError } from './types.js';

const DEFAULT_MAX_BODY_BYTES = 10_000;
const INGEST_PATH_PREFIX = '/api/ingest/';

const setsItsOwnLimit = (path: string) => path.startsWith(INGEST_PATH_PREFIX) || path === REPO_COMMIT_PATH || path.endsWith(REPO_PASTE_SUFFIX);

export function createApp(ctx: AppContext) {
  const api = new Hono();
  const limitBody = bodyLimit({ maxSize: DEFAULT_MAX_BODY_BYTES, onError: (c) => c.json({ error: 'El contenido es demasiado largo.' }, 413) });

  api.onError((failure, c) => {
    if (failure instanceof ConnectorError) return c.json({ error: failure.message }, failure.status as ContentfulStatusCode);
    console.error(failure);
    return c.json({ error: 'Error interno.' }, 500);
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
  api.route('/', assistantRoutes(ctx));
  api.route('/', repoRoutes(ctx));
  api.route('/', simRoutes(ctx));

  return new Hono().route('/api', api).route('/', joinDocRoutes(ctx));
}
