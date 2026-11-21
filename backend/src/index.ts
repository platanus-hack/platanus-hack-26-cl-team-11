import { serve } from '@hono/node-server';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startAgentRoutine } from './agents/routine.js';
import { createApp } from './app.js';
import { createContext, dataLocation, SQLITE_FILE } from './context.js';
import { designAssets } from './designAssets.js';
import { serveFrontend } from './frontendFiles.js';
import { startMesaTicker } from './mesa/ticker.js';
import { describeImport, importFromSqlite } from './pg/importSqlite.js';
import { startScheduler } from './scheduler.js';

const DRAIN_MS = 10_000;
const ctx = createContext();
const app = createApp(ctx);
if (process.env.DATABASE_URL?.trim()) {
  const imported = importFromSqlite(ctx.db, join(dataLocation(), SQLITE_FILE));
  if (imported) for (const line of describeImport(imported)) console.log(line);
}
startScheduler(ctx);
startAgentRoutine(ctx);
startMesaTicker(ctx);
app.route('/', designAssets());
const frontendDist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'dist');

serveFrontend(app, frontendDist);

const port = Number(process.env.PORT ?? 8787);
const server = serve({ fetch: app.fetch, port }, () => console.log(`Backend en http://localhost:${port}`));

process.once('SIGTERM', () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), DRAIN_MS).unref();
});
