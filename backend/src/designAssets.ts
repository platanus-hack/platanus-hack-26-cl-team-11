import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVED = /^\/design\/(?:(?:grafo|faces|logo|sources|luz)\/|(?:tokens|ronda)\.css$)/;

export function designAssets() {
  const routes = new Hono();
  const serve = serveStatic({ root: relative(process.cwd(), REPO_ROOT) || '.' });
  routes.use('/design/*', (c, next) => (SERVED.test(c.req.path) ? serve(c, next) : next()));
  return routes;
}
