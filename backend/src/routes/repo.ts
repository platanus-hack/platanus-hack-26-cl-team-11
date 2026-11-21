import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { assistantFrom, INVALID_ASSISTANT } from '../assistants/auth.js';
import { isAssistantKind, type AssistantKind } from '../assistants/store.js';
import { publicIdOf } from '../codes.js';
import type { AppContext } from '../context.js';
import { findHubSource } from '../hub/catalog.js';
import { isVisibility } from '../policy/store.js';
import { MAX_REPO_FILES } from '../repo/store.js';
import { checkCommit, checkFile, isRepoPath } from '../repo/validate.js';
import { recordInRoomsOf } from '../rooms/notify.js';
import { cleanTopics } from './hub.js';
import { asObject, NOT_FOUND } from './shared.js';

export const REPO_COMMIT_PATH = '/api/repo/commit';
export const REPO_PASTE_SUFFIX = '/repo/paste';
const COMMIT_BODY_BYTES = 250_000;
const PASTE_BODY_BYTES = 40_000;
const LOG_ENTRIES = 20;
const PERSON_AUTHOR = 'persona';
const FILE_NOT_FOUND = { error: 'Ese archivo no existe.' } as const;
const INVALID_PATH = { error: 'La ruta no es válida.' } as const;
const INVALID_SHARE = { error: 'El permiso debe ser siempre, preguntar o nunca.' } as const;
const INVALID_KIND = { error: 'Ese asistente no existe.' } as const;
const REPO_FULL = { error: `El repo ya tiene ${MAX_REPO_FILES} archivos. Borra alguno antes de agregar.` } as const;
const MISSING_PASTE = { error: 'Falta la respuesta de tu asistente.' } as const;
const TOO_LONG = { error: 'El contenido es demasiado largo.' } as const;

const HUB_SOURCE_OF_KIND: Record<AssistantKind, string> = {
  'claude-code': 'claude',
  claude: 'claude',
  codex: 'codex',
  chatgpt: 'chatgpt',
  grok: 'grok',
  openclaw: 'openclaw',
  instinct: 'instinct',
  cursor: 'asistente',
  gemini: 'asistente',
  otro: 'asistente',
};

export function repoRoutes({ store, teams, rooms, hub, assistants, repo }: AppContext) {
  const routes = new Hono();
  const limitTo = (maxSize: number) => bodyLimit({ maxSize, onError: (c) => c.json(TOO_LONG, 413) });

  const announce = (person: { token: string; name: string }, kind: AssistantKind, summary: string, topics: string[]) => {
    const source = findHubSource(HUB_SOURCE_OF_KIND[kind]);
    if (source) {
      if (!hub.connections(person.token).some((connection) => connection.source === source.id)) hub.connect(person.token, source.id, source.account(person.name));
      hub.addItem(person.token, { source: source.id, summary, topics, occurredAt: new Date().toISOString() });
    }
    recordInRoomsOf({ teams, rooms }, person.token, 'repo_cambia', { person: publicIdOf(person.token), files: repo.tree(person.token).length });
  };

  const viewRepo = (personToken: string) => ({ files: repo.tree(personToken), log: repo.log(personToken, LOG_ENTRIES) });

  routes.get('/repo', (c) => {
    const assistant = assistantFrom(assistants, c.req.header('authorization'));
    if (!assistant) return c.json(INVALID_ASSISTANT, 401);
    return c.json(viewRepo(assistant.personToken));
  });

  routes.get('/repo/file', (c) => {
    const assistant = assistantFrom(assistants, c.req.header('authorization'));
    if (!assistant) return c.json(INVALID_ASSISTANT, 401);
    const file = repo.read(assistant.personToken, c.req.query('path') ?? '');
    return file ? c.json(file) : c.json(FILE_NOT_FOUND, 404);
  });

  routes.post('/repo/commit', limitTo(COMMIT_BODY_BYTES), async (c) => {
    const assistant = assistantFrom(assistants, c.req.header('authorization'));
    if (!assistant) return c.json(INVALID_ASSISTANT, 401);
    const person = store.findPerson(assistant.personToken);
    if (!person) return c.json(INVALID_ASSISTANT, 401);
    const body = asObject(await c.req.text());
    const checked = checkCommit(body);
    if (!checked.ok) return c.json({ error: checked.error }, 422);
    const topics = cleanTopics(body.topics);
    const result = repo.commit(person.token, { by: assistant.label, message: checked.value.message, topics, files: checked.value.files, remove: checked.value.remove });
    if (!result.ok) return c.json(REPO_FULL, 409);
    announce(person, assistant.kind, checked.value.message, topics);
    return c.json({ commit: result.commit, files: repo.tree(person.token).length }, 201);
  });

  routes.get('/people/:token/repo', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    return c.json(viewRepo(person.token));
  });

  routes.get('/people/:token/repo/file', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const file = repo.read(person.token, c.req.query('path') ?? '');
    return file ? c.json(file) : c.json(FILE_NOT_FOUND, 404);
  });

  routes.patch('/people/:token/repo/file', async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const body = asObject(await c.req.text());
    if (!isRepoPath(body.path)) return c.json(INVALID_PATH, 400);
    if (!isVisibility(body.share)) return c.json(INVALID_SHARE, 400);
    if (!repo.setShare(person.token, body.path, body.share)) return c.json(FILE_NOT_FOUND, 404);
    return c.json({ path: body.path, share: body.share });
  });

  routes.delete('/people/:token/repo/file', (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    if (!repo.remove(person.token, c.req.query('path') ?? '', PERSON_AUTHOR)) return c.json(FILE_NOT_FOUND, 404);
    return c.json({ ok: true });
  });

  routes.post('/people/:token/repo/paste', limitTo(PASTE_BODY_BYTES), async (c) => {
    const person = store.findPerson(c.req.param('token'));
    if (!person) return c.json(NOT_FOUND, 404);
    const body = asObject(await c.req.text());
    if (!isAssistantKind(body.kind)) return c.json(INVALID_KIND, 400);
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return c.json(MISSING_PASTE, 400);
    const checked = checkFile({ path: `fuentes/${body.kind}/resumen.md`, content });
    if (!checked.ok) return c.json({ error: checked.error }, 422);
    const pasted = assistants.addPasted(person.token, body.kind);
    const message = `Resumen pegado desde ${pasted.label}`;
    const result = repo.commit(person.token, { by: PERSON_AUTHOR, message, topics: [], files: [checked.value], remove: [] });
    if (!result.ok) return c.json(REPO_FULL, 409);
    if (pasted.created) recordInRoomsOf({ teams, rooms }, person.token, 'asistente_conecta', { person: publicIdOf(person.token), kind: body.kind });
    announce(person, body.kind, message, []);
    return c.json({ commit: result.commit, path: checked.value.path }, 201);
  });

  return routes;
}
