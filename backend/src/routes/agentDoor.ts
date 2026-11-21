import { Hono, type Context } from 'hono';
import { assistantFrom, INVALID_ASSISTANT } from '../assistants/auth.js';
import type { AppContext } from '../context.js';
import { rateLimit } from '../rateLimit.js';
import type { AgentMessage } from '../whatsapp/bridge.js';
import { asObject } from './shared.js';

const MAX_MESSAGE_LENGTH = 2000;
const CALLS_PER_MINUTE = 60;
const MISSING_TEXT = { error: 'Falta el texto.' } as const;
const MISSING_OPTION = { error: 'Falta la opción elegida.' } as const;
const PROTOCOL_VERSION = '2025-06-18';
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const NOTHING_NEW = 'Sin novedades.';

const TOOLS = [
  {
    name: 'ronda_decir',
    description:
      'Le dice algo al agente personal de tu persona en Ronda, igual que por WhatsApp: cómo viene, en qué está, qué la tiene bloqueada, o una pregunta para su equipo. Devuelve lo que el agente responde. Una pregunta al equipo puede tardar hasta un minuto.',
    inputSchema: { type: 'object', properties: { mensaje: { type: 'string', description: 'Lo que tu persona quiere decirle a su agente, con sus palabras.' } }, required: ['mensaje'] },
  },
  {
    name: 'ronda_pendientes',
    description: 'Muestra lo que el agente de Ronda espera de tu persona (permisos para contar un bloqueo, propuestas de ayuda por aceptar) y sus últimos mensajes.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ronda_responder',
    description: 'Elige una opción de un pendiente, por ejemplo permitir o aceptar. Usa el id de la opción que entrega ronda_pendientes. Hazlo solo cuando tu persona te lo diga.',
    inputSchema: { type: 'object', properties: { opcion: { type: 'string', description: 'El id de la opción elegida.' } }, required: ['opcion'] },
  },
] as const;

const asText = (messages: AgentMessage[]): string =>
  messages.length === 0
    ? NOTHING_NEW
    : messages.map((message) => (message.options.length === 0 ? message.text : `${message.text}\nOpciones: ${message.options.map((option) => `${option.label} (id: ${option.id})`).join(' · ')}`)).join('\n\n');

export function agentDoorRoutes({ assistants, whatsapp }: AppContext) {
  const routes = new Hono();
  const limited = rateLimit(CALLS_PER_MINUTE);

  const ownerOf = (c: Context) => assistantFrom(assistants, c.req.header('authorization'))?.personToken;

  const textFrom = (value: unknown) => (typeof value === 'string' ? value.trim().slice(0, MAX_MESSAGE_LENGTH) : '');

  routes.post('/agent/say', limited, async (c) => {
    const owner = ownerOf(c);
    if (!owner) return c.json(INVALID_ASSISTANT, 401);
    const text = textFrom(asObject(await c.req.text()).text);
    if (!text) return c.json(MISSING_TEXT, 400);
    return c.json({ replies: await whatsapp.say(owner, text), pending: whatsapp.inboxOf(owner).pending });
  });

  routes.get('/agent/inbox', limited, (c) => {
    const owner = ownerOf(c);
    if (!owner) return c.json(INVALID_ASSISTANT, 401);
    return c.json(whatsapp.inboxOf(owner));
  });

  routes.post('/agent/answer', limited, async (c) => {
    const owner = ownerOf(c);
    if (!owner) return c.json(INVALID_ASSISTANT, 401);
    const option = textFrom(asObject(await c.req.text()).option);
    if (!option) return c.json(MISSING_OPTION, 400);
    return c.json({ replies: whatsapp.choose(owner, option), pending: whatsapp.inboxOf(owner).pending });
  });

  const callTool = async (owner: string, name: unknown, args: Record<string, unknown>): Promise<string | null> => {
    if (name === 'ronda_decir') {
      const message = textFrom(args.mensaje);
      return message ? asText(await whatsapp.say(owner, message)) : null;
    }
    if (name === 'ronda_pendientes') {
      const inbox = whatsapp.inboxOf(owner);
      return `Pendientes:\n${asText(inbox.pending)}\n\nÚltimos mensajes:\n${asText(inbox.recent)}`;
    }
    if (name === 'ronda_responder') {
      const option = textFrom(args.opcion);
      return option ? asText(whatsapp.choose(owner, option)) : null;
    }
    return null;
  };

  routes.post('/mcp', limited, async (c) => {
    const owner = ownerOf(c);
    if (!owner) return c.json(INVALID_ASSISTANT, 401, { 'www-authenticate': 'Bearer' });
    const message = asObject(await c.req.text());
    const { id, method } = message;
    const params = asObject(JSON.stringify(message.params ?? {}));
    const result = (value: unknown) => c.json({ jsonrpc: '2.0', id: id ?? null, result: value });
    const failure = (code: number, text: string) => c.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message: text } });

    if (id === undefined) return c.body(null, 202);
    if (method === 'initialize') {
      return result({
        protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'ronda', version: '1' },
        instructions: 'Ronda es el agente personal de tu persona dentro de su equipo. Úsalo cuando tu persona quiera contarle algo a su agente, preguntarle algo a su equipo o responder un pendiente.',
      });
    }
    if (method === 'ping') return result({});
    if (method === 'tools/list') return result({ tools: TOOLS });
    if (method === 'tools/call') {
      const text = await callTool(owner, params.name, asObject(JSON.stringify(params.arguments ?? {})));
      return text === null ? failure(INVALID_PARAMS, 'Herramienta o argumentos no válidos.') : result({ content: [{ type: 'text', text }] });
    }
    return failure(METHOD_NOT_FOUND, 'Método no disponible.');
  });

  routes.get('/mcp', (c) => c.body(null, 405, { allow: 'POST' }));

  return routes;
}
