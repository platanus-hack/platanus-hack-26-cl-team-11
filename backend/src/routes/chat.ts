import { Hono } from 'hono';
import { MAX_CHAT_TEXT_LENGTH, openChatStore } from '../chat.js';
import type { AppContext } from '../context.js';
import { rateLimit } from '../rateLimit.js';
import { asObject, NOT_FOUND } from './shared.js';

const MESSAGES_PER_MINUTE = 20;
const EMPTY_MESSAGE = { error: 'Escribe un mensaje.' } as const;
const MISSING_OPTION = { error: 'Falta la opción elegida.' } as const;

interface ChatLine {
  key: string;
  role: 'persona' | 'agente';
  text: string;
  at: string;
  options: Array<{ id: string; label: string }>;
}

export function chatRoutes({ db, store, whatsapp, model }: AppContext) {
  const routes = new Hono();
  const limited = rateLimit(MESSAGES_PER_MINUTE);
  const said = openChatStore(db);

  const viewOf = (personToken: string) => {
    const inbox = whatsapp.inboxOf(personToken);
    const open = new Map(inbox.pending.map((message) => [message.id, message.options]));
    const heard = new Map([...inbox.recent, ...inbox.pending].map((message) => [message.id, message]));
    const lines: ChatLine[] = [
      ...said.recent(personToken).map((message) => ({ key: `p${message.id}`, role: 'persona' as const, text: message.text, at: message.at, options: [] })),
      ...[...heard.values()].map((message) => ({ key: `a${message.id}`, role: 'agente' as const, text: message.text, at: message.at, options: open.get(message.id) ?? [] })),
    ].sort((left, right) => left.at.localeCompare(right.at) || right.role.localeCompare(left.role) || left.key.localeCompare(right.key));
    return { messages: lines, configured: model !== null, whatsapp: whatsapp.statusOf(personToken) };
  };

  routes.get('/people/:token/chat', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json(viewOf(person.token));
  });

  routes.post('/people/:token/chat', limited, async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const body = asObject(await c.req.text());
    const text = typeof body.text === 'string' ? [...body.text.trim()].slice(0, MAX_CHAT_TEXT_LENGTH).join('') : '';
    if (!text) return c.json(EMPTY_MESSAGE, 400);
    said.add(person.token, text, new Date());
    await whatsapp.say(person.token, text);
    return c.json(viewOf(person.token), 201);
  });

  routes.post('/people/:token/chat/answer', limited, async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const option = asObject(await c.req.text()).option;
    if (typeof option !== 'string' || !option.trim()) return c.json(MISSING_OPTION, 400);
    whatsapp.choose(person.token, option.trim());
    return c.json(viewOf(person.token), 201);
  });

  return routes;
}
