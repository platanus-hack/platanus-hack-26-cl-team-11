import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono, MiddlewareHandler } from 'hono';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ASSETS_ROUTE = '/assets/*';
const NEVER_CHANGES = 'public, max-age=31536000, immutable';
const ALWAYS_ASK = 'no-cache';

const cached =
  (policy: string): MiddlewareHandler =>
  async (c, next) => {
    await next();
    if (c.res.ok) c.res.headers.set('Cache-Control', policy);
  };

export function serveFrontend(app: Hono, distDir: string): boolean {
  if (!existsSync(join(distDir, 'index.html'))) return false;
  const root = relative(process.cwd(), distDir) || '.';
  app.use(ASSETS_ROUTE, cached(NEVER_CHANGES), serveStatic({ root }));
  app.get(ASSETS_ROUTE, (c) => c.notFound());
  app.use('*', cached(ALWAYS_ASK), serveStatic({ root }));
  app.get('*', cached(ALWAYS_ASK), serveStatic({ root, path: 'index.html' }));
  return true;
}
