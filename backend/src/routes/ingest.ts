import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { publicIdOf } from '../codes.js';
import { CONNECTORS } from '../connectors/registry.js';
import type { AppContext } from '../context.js';
import { openDeliveryStore } from '../deliveries.js';
import { rateLimit } from '../rateLimit.js';
import { asObject, NOT_FOUND } from './shared.js';

const MAX_BODY_BYTES = 1_000_000;
const DELIVERIES_PER_MINUTE = 30;
const NOTHING_READABLE = 'No pudimos leer ningún dato de salud en el envío.';
const RECEIVED_ONE = 'Listo. Llegaron tus datos.';
const MOST_DAYS_FROM_CURRENT_SHORTCUT = 10;
const OLD_SHORTCUT_HINT = 'Tu Atajo es una versión antigua y lee un mes entero, por eso tarda. Bórralo en la app Atajos y agrégalo de nuevo desde tu página de Montu.';
const NOTHING_SENT = 'Tu teléfono no mandó datos de salud. Revisa que Salud tenga sueño o pasos registrados.';

const shortDay = (day: string) => day.slice(5).split('-').reverse().join('-');

const receivedMessage = (days: string[]) => {
  const first = days[0] ?? '';
  const last = days.at(-1) ?? first;
  return days.length === 1 ? `Listo. Llegó 1 día de datos, el ${shortDay(first)}.` : `Listo. Llegaron ${days.length} días de datos, del ${shortDay(first)} al ${shortDay(last)}.`;
};

export function ingestRoutes({ db, store }: AppContext) {
  const routes = new Hono();
  const deliveries = openDeliveryStore(db);
  const limitedDeliveries = rateLimit(DELIVERIES_PER_MINUTE);

  routes.post('/ingest/:slug/:token', limitedDeliveries, bodyLimit({ maxSize: MAX_BODY_BYTES }), async (c) => {
    const slug = c.req.param('slug');
    const connector = CONNECTORS.find((item) => item.kind === 'push' && item.ingestSlug === slug);
    const person = store.findPerson(c.req.param('token'));
    if (connector?.kind !== 'push' || !person) return c.json({ ...NOT_FOUND, message: NOT_FOUND.error }, 404);
    const startedAt = Date.now();
    const payload = asObject(await c.req.text());
    const noted = (ok: boolean, message: string, days: number) => {
      deliveries.record(person.token, connector.id, { at: new Date().toISOString(), ok, message });
      console.log(`Push delivery: source=${connector.id} person=${publicIdOf(person.token)} ok=${ok} days=${days} ms=${Date.now() - startedAt}`);
    };
    const batch = connector.toBatch?.(payload) ?? null;
    if (!batch) {
      const event = store.saveEvent(person.token, connector.toEvent(payload));
      noted(true, RECEIVED_ONE, 1);
      return c.json({ ok: true, id: event?.id ?? null, summary: event?.summary ?? null }, 201);
    }
    if (!batch.events.length) {
      const error = batch.ignored > 0 ? NOTHING_READABLE : NOTHING_SENT;
      noted(false, error, 0);
      return c.json({ error, message: error, ignored: batch.ignored, example: batch.ignoredSample }, 400);
    }
    const saved = batch.events.map((draft) => store.saveEvent(person.token, draft));
    const days = batch.events.map((draft) => draft.occurredAt);
    const message = days.length > MOST_DAYS_FROM_CURRENT_SHORTCUT ? `${receivedMessage(days)} ${OLD_SHORTCUT_HINT}` : receivedMessage(days);
    noted(true, message, days.length);
    return c.json(
      { ok: true, id: saved.at(-1)?.id ?? null, summary: batch.events.at(-1)?.summary ?? null, days: days.length, from: days[0], to: days.at(-1), ignored: batch.ignored, message },
      201,
    );
  });

  return routes;
}
