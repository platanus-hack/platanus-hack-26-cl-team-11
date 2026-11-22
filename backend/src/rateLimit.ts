import type { MiddlewareHandler } from 'hono';

const WINDOW_MS = 60_000;
const MAX_TRACKED_CALLERS = 5000;
const TOO_MANY = { error: 'Demasiados intentos. Espera un minuto.' } as const;
const SET_BY_THE_EDGE = ['cf-connecting-ip', 'true-client-ip'];
const UNKNOWN_CALLER = 'local';

export function callerOf(header: (name: string) => string | undefined): string {
  for (const name of SET_BY_THE_EDGE) {
    const value = header(name)?.trim();
    if (value) return value;
  }
  return header('x-forwarded-for')?.split(',')[0]?.trim() || UNKNOWN_CALLER;
}

interface Window {
  startedAt: number;
  count: number;
}

export function rateLimit(maxPerMinute: number, now: () => number = Date.now): MiddlewareHandler {
  const windows = new Map<string, Window>();
  return async (c, next) => {
    const caller = callerOf((name) => c.req.header(name));
    const instant = now();
    const current = windows.get(caller);
    const window = current && instant - current.startedAt < WINDOW_MS ? current : { startedAt: instant, count: 0 };
    window.count += 1;
    if (windows.size >= MAX_TRACKED_CALLERS && !windows.has(caller)) windows.clear();
    windows.set(caller, window);
    if (window.count > maxPerMinute) return c.json(TOO_MANY, 429);
    await next();
  };
}
