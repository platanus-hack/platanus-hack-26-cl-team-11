import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';
import type { ContextMap } from '../src/hub/map.js';
import { MAX_REPO_FILES, type RepoCommit, type RepoEntry, type RepoFile } from '../src/repo/store.js';

const json = (body: unknown, method = 'POST') => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

interface RepoView {
  files: RepoEntry[];
  log: RepoCommit[];
}

const setup = async (kind = 'claude-code') => {
  const ctx = createContext({ location: ':memory:', model: null });
  const app = createApp(ctx);
  const ana = ctx.store.addPerson('Ana Pérez');
  const redeemed = ctx.assistants.redeem(ctx.assistants.createPairing(ana.token).code, kind as 'claude-code', 'Claude Code');
  assert.equal(redeemed.state, 'vigente');
  const token = redeemed.state === 'vigente' ? redeemed.token : '';
  const authorized = (init: RequestInit = {}) => ({ ...init, headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${token}` } });
  const commit = (body: unknown) => app.request('/api/repo/commit', authorized(json(body)));
  const repoOf = async () => (await (await app.request(`/api/people/${ana.token}/repo`)).json()) as RepoView;
  return { ctx, app, ana, token, authorized, commit, repoOf };
};

test('an assistant writes files into its person repo, and both of them can read the tree', async () => {
  const { app, ana, authorized, commit, repoOf } = await setup();
  assert.equal((await app.request('/api/repo/commit', json({ message: 'x', files: [{ path: 'a.md', content: 'a' }] }))).status, 401);
  assert.equal((await app.request('/api/repo')).status, 401);

  const pushed = await commit({
    message: '  Primer contexto  ',
    topics: ['Pagos', 'pagos'],
    files: [
      { path: 'ahora.md', content: '- Integra pagos\n- Necesita a alguien que conozca OAuth', share: 'siempre' },
      { path: 'fuentes/claude-code/proyecto.md', content: 'Trabaja en el backend de pagos.' },
    ],
  });
  assert.equal(pushed.status, 201);
  const result = (await pushed.json()) as { commit: RepoCommit; files: number };
  assert.equal(result.files, 2);
  assert.deepEqual({ message: result.commit.message, topics: result.commit.topics, by: result.commit.by }, { message: 'Primer contexto', topics: ['pagos'], by: 'Claude Code' });

  const mine = (await (await app.request('/api/repo', authorized())).json()) as RepoView;
  assert.deepEqual(
    mine.files.map((file) => [file.path, file.share]),
    [
      ['ahora.md', 'siempre'],
      ['fuentes/claude-code/proyecto.md', 'preguntar'],
    ],
  );
  assert.deepEqual(await repoOf(), mine);
  const file = (await (await app.request('/api/repo/file?path=ahora.md', authorized())).json()) as RepoFile;
  assert.match(file.content, /OAuth/);
  assert.equal((await app.request('/api/repo/file?path=nope.md', authorized())).status, 404);
  assert.equal((await app.request(`/api/people/${ana.token}/repo/file?path=ahora.md`)).status, 200);
  assert.equal((await app.request('/api/people/nope/repo')).status, 404);
});

test('a commit that breaks a rule saves nothing: bad path, too big, a credential, no message, too many files', async () => {
  const { commit, repoOf } = await setup();
  const good = { path: 'ok.md', content: 'bien' };
  const rejected = async (body: unknown) => {
    const response = await commit(body);
    assert.equal(response.status, 422);
    return ((await response.json()) as { error: string }).error;
  };
  assert.match(await rejected({ message: 'x', files: [good, { path: '../etc/passwd', content: 'x' }] }), /ruta/);
  assert.match(await rejected({ message: 'x', files: [good, { path: 'grande.md', content: 'a'.repeat(9000) }] }), /8 KB/);
  assert.match(await rejected({ message: 'x', files: [good, { path: 'llave.md', content: 'token: ghp_abcdefghijklmnopqrstuvwxyz0123456789' }] }), /credencial/);
  assert.match(await rejected({ message: 'x', files: [good, { path: 'ok.md', content: 'otra vez' }] }), /dos veces/);
  assert.match(await rejected({ message: 'x', files: [{ path: 'a.md', content: 'a', share: 'publico' }] }), /permiso/);
  assert.match(await rejected({ files: [good] }), /mensaje/);
  assert.match(await rejected({ message: 'x' }), /no trae archivos/);
  assert.match(await rejected({ message: 'x', files: Array.from({ length: 21 }, (_, index) => ({ path: `f${index}.md`, content: 'x' })) }), /hasta 20/);
  assert.deepEqual((await repoOf()).files, []);
});

test('the person decides who sees each file, and her assistant cannot change that back', async () => {
  const { ctx, app, ana, commit, repoOf } = await setup();
  await commit({ message: 'Estado', files: [{ path: 'estado.md', content: 'Semana pesada.', share: 'siempre' }] });
  const patch = (body: unknown) => app.request(`/api/people/${ana.token}/repo/file`, json(body, 'PATCH'));
  assert.equal((await patch({ path: 'estado.md', share: 'todos' })).status, 400);
  assert.equal((await patch({ path: 'nope.md', share: 'nunca' })).status, 404);
  assert.equal((await patch({ path: 'estado.md', share: 'nunca' })).status, 200);

  await commit({ message: 'Estado al día', files: [{ path: 'estado.md', content: 'Semana más liviana.', share: 'siempre' }] });
  const file = ctx.repo.read(ana.token, 'estado.md');
  assert.deepEqual({ content: file?.content, share: file?.share }, { content: 'Semana más liviana.', share: 'nunca' });
  assert.deepEqual(ctx.repo.shared(ana.token), []);

  await commit({ message: 'Borra y agrega', delete: ['estado.md'], files: [{ path: 'sabe.md', content: '- OAuth de Google', share: 'siempre' }] });
  assert.deepEqual(
    (await repoOf()).files.map((entry) => entry.path),
    ['sabe.md'],
  );
  assert.equal((await app.request(`/api/people/${ana.token}/repo/file?path=sabe.md`, { method: 'DELETE' })).status, 200);
  assert.equal((await app.request(`/api/people/${ana.token}/repo/file?path=sabe.md`, { method: 'DELETE' })).status, 404);
  const history = (await repoOf()).log.map((entry) => entry.message);
  assert.deepEqual(history, ['Borra sabe.md', 'Borra y agrega', 'Estado al día', 'Permiso de estado.md: nunca', 'Estado']);
});

test('a commit can be larger than a normal request, and a full repo refuses more files', async () => {
  const { ctx, ana, commit } = await setup();
  const big = await commit({ message: 'Tres archivos largos', files: ['a', 'b', 'c'].map((name) => ({ path: `${name}.md`, content: name.repeat(6000) })) });
  assert.equal(big.status, 201);

  const filler = (start: number, count: number) => Array.from({ length: count }, (_, index) => ({ path: `n/${start + index}.md`, content: 'x' }));
  for (let start = 0; start < MAX_REPO_FILES - 3; start += 20) {
    const result = ctx.repo.commit(ana.token, { by: 'prueba', message: 'relleno', topics: [], files: filler(start, Math.min(20, MAX_REPO_FILES - 3 - start)), remove: [] });
    assert.equal(result.ok, true);
  }
  assert.equal(ctx.repo.tree(ana.token).length, MAX_REPO_FILES);
  assert.equal((await commit({ message: 'Uno más', files: [{ path: 'extra.md', content: 'x' }] })).status, 409);
  assert.equal((await commit({ message: 'Cambia uno', files: [{ path: 'a.md', content: 'nuevo' }] })).status, 201);
});

test('each commit shows up in the context map under the assistant that made it, and in the room', async () => {
  const { app, ana, commit } = await setup();
  const room = (await (await app.request('/api/rooms', json({ name: 'Hack', token: ana.token }))).json()) as { code: string };
  const before = (await (await app.request(`/api/context/${ana.token}`)).json()) as ContextMap;
  assert.ok(!before.sources.some((source) => source.id === 'chatgpt'));

  await commit({ message: 'Resumió el proyecto de pagos', topics: ['codigo'], files: [{ path: 'README.md', content: 'Ana, backend.' }] });
  const after = (await (await app.request(`/api/context/${ana.token}`)).json()) as ContextMap;
  const claude = after.sources.find((source) => source.id === 'claude');
  assert.equal(claude?.connected, true);
  assert.equal(claude?.items[0]?.summary, 'Resumió el proyecto de pagos');

  const events = (await (await app.request(`/api/rooms/${room.code}/events`)).json()) as { events: Array<{ type: string; payload: { files?: number } }> };
  const last = events.events.at(-1);
  assert.equal(last?.type, 'repo_cambia');
  assert.equal(last?.payload.files, 1);
});

test('an answer pasted from a chat app becomes one file that asks before it is shared, and the app counts as connected once', async () => {
  const { ctx, app, ana, repoOf } = await setup();
  const paste = (body: unknown) => app.request(`/api/people/${ana.token}/repo/paste`, json(body));
  assert.equal((await paste({ kind: 'fax', content: 'x' })).status, 400);
  assert.equal((await paste({ kind: 'chatgpt', content: '  ' })).status, 400);
  assert.equal((await paste({ kind: 'chatgpt', content: 'sk-abcdefghijklmnopqrstuvwxyz012345' })).status, 422);
  assert.equal(ctx.assistants.assistantsOf(ana.token).length, 1);

  assert.equal((await paste({ kind: 'chatgpt', content: 'Ana lidera pagos y sabe de OAuth.' })).status, 201);
  assert.equal((await paste({ kind: 'chatgpt', content: 'Ana lidera pagos, sabe de OAuth y de Stripe.' })).status, 201);
  const file = (await repoOf()).files.find((entry) => entry.path === 'fuentes/chatgpt/resumen.md');
  assert.deepEqual({ share: file?.share, by: file?.updatedBy }, { share: 'preguntar', by: 'persona' });
  assert.deepEqual(
    ctx.assistants.assistantsOf(ana.token).map((assistant) => assistant.label),
    ['Claude Code', 'ChatGPT (pegado a mano)'],
  );
  const map = (await (await app.request(`/api/context/${ana.token}`)).json()) as ContextMap;
  assert.equal(map.sources.find((source) => source.id === 'chatgpt')?.connected, true);
});
