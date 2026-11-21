import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openStore } from './db.js';

const app = createApp(openStore());
const frontendDist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'dist');

if (existsSync(join(frontendDist, 'index.html'))) {
  const root = relative(process.cwd(), frontendDist) || '.';
  app.use('*', serveStatic({ root }));
  app.get('*', serveStatic({ root, path: 'index.html' }));
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`Backend en http://localhost:${port}`));
