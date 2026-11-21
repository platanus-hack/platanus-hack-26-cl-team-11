import type { AppContext } from './context.js';
import { syncSource } from './sync.js';

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const FIRST_RUN_AFTER_MS = 60 * 1000;

export async function syncAll(ctx: AppContext): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;
  for (const { personToken, source } of ctx.store.listAllConnections()) {
    try {
      await syncSource(ctx, personToken, source);
      synced += 1;
    } catch {
      failed += 1;
    }
  }
  return { synced, failed };
}

export function startScheduler(ctx: AppContext, intervalMs: number = DEFAULT_INTERVAL_MS, firstRunAfterMs: number = Math.min(FIRST_RUN_AFTER_MS, intervalMs)): () => void {
  let runInFlight = false;
  const runUnlessBusy = async () => {
    if (runInFlight) return;
    runInFlight = true;
    try {
      await syncAll(ctx);
    } catch (failure) {
      console.error('La sincronización programada falló.', failure);
    } finally {
      runInFlight = false;
    }
  };
  const first = setTimeout(() => void runUnlessBusy(), firstRunAfterMs);
  first.unref();
  const timer = setInterval(() => void runUnlessBusy(), intervalMs);
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
