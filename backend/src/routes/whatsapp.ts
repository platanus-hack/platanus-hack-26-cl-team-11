import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppContext } from '../context.js';
import { rateLimit } from '../rateLimit.js';
import { asObject, NOT_FOUND } from './shared.js';

export const WHATSAPP_WEBHOOK_PATH = '/api/whatsapp/webhook';

const MAX_WEBHOOK_BYTES = 500_000;
const LINKS_PER_MINUTE = 20;
const INBOUND_MESSAGE = 'whatsapp.message.received';
const NOT_CONFIGURED = { error: 'WhatsApp todavía no está configurado en el servidor.' } as const;
const NOT_SIGNED = { error: 'La firma no es válida.' } as const;
const RECEIVED = { ok: true } as const;

export function whatsappRoutes({ store, whatsapp }: AppContext) {
  const routes = new Hono();
  const limitedLinks = rateLimit(LINKS_PER_MINUTE);

  routes.post('/whatsapp/webhook', bodyLimit({ maxSize: MAX_WEBHOOK_BYTES }), async (c) => {
    if (!whatsapp.configured) return c.json(NOT_CONFIGURED, 404);
    const rawBody = await c.req.text();
    if (!whatsapp.accepts(rawBody, c.req.header('x-webhook-signature'))) return c.json(NOT_SIGNED, 401);
    if (c.req.header('x-webhook-event') !== INBOUND_MESSAGE) return c.json(RECEIVED);
    const deliveryKey = c.req.header('x-idempotency-key');
    if (deliveryKey && !whatsapp.firstDelivery(deliveryKey)) return c.json(RECEIVED);
    void whatsapp.receive(asObject(rawBody)).catch((failure: unknown) => console.error('A WhatsApp message could not be handled.', failure));
    return c.json(RECEIVED);
  });

  routes.get('/people/:token/whatsapp', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json(whatsapp.statusOf(person.token));
  });

  routes.post('/people/:token/whatsapp/link', limitedLinks, async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const link = await whatsapp.startLink(person.token);
    return link ? c.json(link, 201) : c.json(NOT_CONFIGURED, 503);
  });

  routes.delete('/people/:token/whatsapp', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    whatsapp.unlink(person.token);
    return c.json(whatsapp.statusOf(person.token));
  });

  return routes;
}
