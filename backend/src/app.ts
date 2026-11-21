import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppContext } from './context.js';
import { boardRoutes } from './routes/board.js';
import { checkinRoutes } from './routes/checkins.js';
import { connectionRoutes } from './routes/connections.js';
import { hubRoutes } from './routes/hub.js';
import { ingestRoutes } from './routes/ingest.js';
import { oauthRoutes } from './routes/oauth.js';
import { peopleRoutes } from './routes/people.js';
import { pulseRoutes } from './routes/pulse.js';
import { signalRoutes } from './routes/signals.js';
import { teamRoutes } from './routes/teams.js';
import { ConnectorError } from './types.js';

const DEFAULT_MAX_BODY_BYTES = 10_000;
const INGEST_PATH_PREFIX = '/api/ingest/';

export function createApp(ctx: AppContext) {
  const api = new Hono();
  const limitBody = bodyLimit({ maxSize: DEFAULT_MAX_BODY_BYTES, onError: (c) => c.json({ error: 'El contenido es demasiado largo.' }, 413) });

  api.onError((failure, c) => {
    if (failure instanceof ConnectorError) return c.json({ error: failure.message }, failure.status as ContentfulStatusCode);
    console.error(failure);
    return c.json({ error: 'Error interno.' }, 500);
  });

  api.use('*', (c, next) => (c.req.path.startsWith(INGEST_PATH_PREFIX) ? next() : limitBody(c, next)));
  api.get('/health', (c) => c.json({ ok: true }));
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

  return new Hono().route('/api', api);
}
