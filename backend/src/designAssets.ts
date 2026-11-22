import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type MiddlewareHandler } from 'hono';
import { etag } from 'hono/etag';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVED = /^\/design\/(?:(?:grafo|faces|logo|sources|luz|contexto|montu|pitch|prep|libro)\/|(?:tokens|ronda)\.css$)/;

const ESCAPES_OR_CLIMBS = /%|\\|\.\./;
const isServed = (path: string) => SERVED.test(path) && !ESCAPES_OR_CLIMBS.test(path);

const IMAGE = /\.(?:png|jpe?g|webp|gif|woff2?)$/;
const KEPT_A_DAY = 'public, max-age=86400, stale-while-revalidate=604800';
const ALWAYS_ASK = 'no-cache';

const cached: MiddlewareHandler = async (c, next) => {
  await next();
  if (c.res.ok) c.res.headers.set('Cache-Control', IMAGE.test(c.req.path) ? KEPT_A_DAY : ALWAYS_ASK);
};

export function designAssets() {
  const routes = new Hono();
  const serve = serveStatic({ root: relative(process.cwd(), REPO_ROOT) || '.' });
  for (const path of ['/dec', '/deck', '/problema']) routes.get(path, (c) => c.redirect('/design/pitch/index.html'));
  routes.get('/prep', (c) => c.redirect('/design/prep/index.html'));
  routes.get('/libro', (c) => c.redirect('/design/libro/index.html'));
  routes.use('/design/*', etag(), cached, (c, next) => (isServed(c.req.path) ? serve(c, next) : next()));
  return routes;
}
