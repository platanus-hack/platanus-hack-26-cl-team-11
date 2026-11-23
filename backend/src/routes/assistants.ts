import { Hono } from 'hono';
import { assistantFrom, INVALID_ASSISTANT } from '../assistants/auth.js';
import { invalidJoinDoc, joinDoc } from '../assistants/joinDoc.js';
import { ASSISTANT_NAMES, isAssistantKind, MAX_ASSISTANTS_PER_PERSON, PAIRING_MINUTES, type Assistant, type Redeemed } from '../assistants/store.js';
import { publicIdOf } from '../codes.js';
import type { AppContext } from '../context.js';
import { rateLimit } from '../rateLimit.js';
import { recordInRoomsOf } from '../rooms/notify.js';
import { asObject, NOT_FOUND } from './shared.js';

const MAX_LABEL_LENGTH = 60;
const JOIN_ATTEMPTS_PER_MINUTE = 120;
const ASSISTANT_NOT_FOUND = { error: 'Ese asistente no existe.' } as const;
const TRAILING_SLASHES = /\/+$/;
const MARKDOWN = { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' } as const;

type Refused = Exclude<Redeemed['state'], 'vigente'>;

const REFUSAL: Record<Refused, { status: 404 | 409 | 410; error: string }> = {
  desconocido: { status: 404, error: 'Ese código no existe. Pide un link nuevo a tu persona.' },
  usado: { status: 410, error: 'Ese código ya se usó. Pide un link nuevo a tu persona.' },
  vencido: { status: 410, error: 'Ese código venció. Pide un link nuevo a tu persona.' },
  lleno: { status: 409, error: `Ya hay ${MAX_ASSISTANTS_PER_PERSON} asistentes conectados. Tu persona tiene que quitar uno en su página de Montu.` },
};

const viewAssistant = (assistant: Assistant) => ({ id: assistant.id, kind: assistant.kind, label: assistant.label, createdAt: assistant.createdAt, lastSeenAt: assistant.lastSeenAt });

export function assistantRoutes({ store, teams, rooms, assistants, repo, config }: AppContext) {
  const routes = new Hono();
  const limited = rateLimit(JOIN_ATTEMPTS_PER_MINUTE);

  routes.post('/people/:token/assistants/pairings', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const pairing = assistants.createPairing(person.token);
    return c.json({ code: pairing.code, path: `/a/${pairing.code}`, expiresAt: pairing.expiresAt, minutes: PAIRING_MINUTES }, 201);
  });

  routes.post('/people/:token/assistants/connectors', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const body = asObject(await c.req.text());
    const kind = isAssistantKind(body.kind) ? body.kind : 'otro';
    const connected = assistants.connect(person.token, kind, `${ASSISTANT_NAMES[kind]} (conector)`);
    if (!connected) return c.json({ error: REFUSAL.lleno.error }, REFUSAL.lleno.status);
    recordInRoomsOf({ teams, rooms }, person.token, 'asistente_conecta', { person: publicIdOf(person.token), kind });
    const url = `${(config.publicBaseUrl ?? new URL(c.req.url).origin).replace(TRAILING_SLASHES, '')}/api/mcp`;
    return c.json({ url, header: `Authorization: Bearer ${connected.token}`, keyUrl: `${url}/k/${connected.token}`, assistant: viewAssistant(connected.assistant) }, 201);
  });

  routes.get('/people/:token/assistants', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json({ assistants: assistants.assistantsOf(person.token).map(viewAssistant) });
  });

  routes.delete('/people/:token/assistants/:assistantId', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    if (!assistants.revoke(person.token, c.req.param('assistantId'))) return c.json(ASSISTANT_NOT_FOUND, 404);
    return c.json({ ok: true });
  });

  routes.post('/assistants/join', limited, async (c) => {
    const body = asObject(await c.req.text());
    const kind = isAssistantKind(body.kind) ? body.kind : 'otro';
    const label = (typeof body.label === 'string' ? body.label.trim().slice(0, MAX_LABEL_LENGTH) : '') || ASSISTANT_NAMES[kind];
    const redeemed = assistants.redeem(typeof body.code === 'string' ? body.code : '', kind, label);
    if (redeemed.state !== 'vigente') return c.json({ error: REFUSAL[redeemed.state].error }, REFUSAL[redeemed.state].status);
    const person = store.findPerson(redeemed.assistant.personToken);
    recordInRoomsOf({ teams, rooms }, redeemed.assistant.personToken, 'asistente_conecta', { person: publicIdOf(redeemed.assistant.personToken), kind });
    return c.json({ token: redeemed.token, assistant: viewAssistant(redeemed.assistant), person: { name: person?.name ?? '' } }, 201);
  });

  routes.get('/assistants/me', (c) => {
    const assistant = assistantFrom(assistants, c.req.header('authorization'));
    if (!assistant) return c.json(INVALID_ASSISTANT, 401);
    const person = store.findPerson(assistant.personToken);
    const salas = teams.teamsOf(assistant.personToken).flatMap((team) => {
      const room = rooms.roomOfTeam(team.id);
      return room ? [{ code: room.code, name: room.name }] : [];
    });
    return c.json({ assistant: viewAssistant(assistant), person: { name: person?.name ?? '' }, rooms: salas, repo: { files: repo.tree(assistant.personToken).length, version: repo.version(assistant.personToken) } });
  });

  return routes;
}

export function joinDocRoutes({ store, assistants, config }: AppContext) {
  const routes = new Hono();
  const limited = rateLimit(JOIN_ATTEMPTS_PER_MINUTE);

  routes.get('/a/:code', limited, (c) => {
    const pairing = assistants.pairingState(c.req.param('code'));
    const person = pairing.personToken ? store.findPerson(pairing.personToken) : undefined;
    if (pairing.state !== 'vigente' || !person) return c.body(invalidJoinDoc(pairing.state === 'vigente' ? 'desconocido' : pairing.state), pairing.state === 'desconocido' ? 404 : 410, MARKDOWN);
    const baseUrl = (config.publicBaseUrl ?? new URL(c.req.url).origin).replace(TRAILING_SLASHES, '');
    return c.body(joinDoc({ baseUrl, code: pairing.code, ownerName: person.name, expiresAt: pairing.expiresAt ?? '' }), 200, MARKDOWN);
  });

  return routes;
}
