import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppContext } from './context.js';
import { connectionRoutes } from './routes/connections.js';
import { ingestRoutes } from './routes/ingest.js';
import { oauthRoutes } from './routes/oauth.js';
import { peopleRoutes } from './routes/people.js';
import { ConnectorError } from './types.js';

export function createApp(ctx: AppContext) {
  const api = new Hono();

  api.onError((failure, c) => {
    if (failure instanceof ConnectorError) return c.json({ error: failure.message }, failure.status as ContentfulStatusCode);
    console.error(failure);
    return c.json({ error: 'Error interno.' }, 500);
  });

  api.get('/health', (c) => c.json({ ok: true }));
  api.route('/', peopleRoutes(ctx));
  api.route('/', connectionRoutes(ctx));
  api.route('/', ingestRoutes(ctx));
  api.route('/', oauthRoutes(ctx));

  return new Hono().route('/api', api);
}
