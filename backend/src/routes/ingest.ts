import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { CONNECTORS } from '../connectors/registry.js';
import type { AppContext } from '../context.js';
import { asObject, NOT_FOUND } from './shared.js';

const MAX_BODY_BYTES = 1_000_000;
const NOTHING_READABLE = 'No pudimos leer ningún dato de salud en el envío.';

const shortDay = (day: string) => day.slice(5).split('-').reverse().join('-');

const receivedMessage = (days: string[]) => {
  const first = days[0] ?? '';
  const last = days.at(-1) ?? first;
  return days.length === 1 ? `Listo. Llegó 1 día de datos, el ${shortDay(first)}.` : `Listo. Llegaron ${days.length} días de datos, del ${shortDay(first)} al ${shortDay(last)}.`;
};

export function ingestRoutes({ store }: AppContext) {
  const routes = new Hono();

  routes.post('/ingest/:slug/:token', bodyLimit({ maxSize: MAX_BODY_BYTES }), async (c) => {
    const slug = c.req.param('slug');
    const connector = CONNECTORS.find((item) => item.kind === 'push' && item.ingestSlug === slug);
    const person = store.findPerson(c.req.param('token'));
    if (connector?.kind !== 'push' || !person) return c.json(NOT_FOUND, 404);
    const payload = asObject(await c.req.text());
    const batch = connector.toBatch?.(payload) ?? null;
    if (!batch) {
      const event = store.saveEvent(person.token, connector.toEvent(payload));
      return c.json({ ok: true, id: event?.id ?? null, summary: event?.summary ?? null }, 201);
    }
    if (!batch.events.length) return c.json({ error: NOTHING_READABLE, ignored: batch.ignored, example: batch.ignoredSample }, 400);
    const saved = batch.events.map((draft) => store.saveEvent(person.token, draft));
    const days = batch.events.map((draft) => draft.occurredAt);
    return c.json(
      { ok: true, id: saved.at(-1)?.id ?? null, summary: batch.events.at(-1)?.summary ?? null, days: days.length, from: days[0], to: days.at(-1), ignored: batch.ignored, message: receivedMessage(days) },
      201,
    );
  });

  return routes;
}
