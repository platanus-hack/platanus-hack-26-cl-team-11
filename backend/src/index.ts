import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startAgentRoutine } from './agents/routine.js';
import { createApp } from './app.js';
import { createContext } from './context.js';
import { designAssets } from './designAssets.js';
import { startMesaTicker } from './mesa/ticker.js';
import { startScheduler } from './scheduler.js';

const ctx = createContext();
const app = createApp(ctx);
startScheduler(ctx);
startAgentRoutine(ctx);
startMesaTicker(ctx);
app.route('/', designAssets());
const frontendDist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'dist');

if (existsSync(join(frontendDist, 'index.html'))) {
  const root = relative(process.cwd(), frontendDist) || '.';
  app.use('*', serveStatic({ root }));
  app.get('*', serveStatic({ root, path: 'index.html' }));
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`Backend en http://localhost:${port}`));
