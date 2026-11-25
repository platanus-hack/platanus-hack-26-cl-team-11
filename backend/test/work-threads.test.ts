import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContext } from '../src/context.js';
import { createApp } from '../src/app.js';
import { SESSION_COOKIE } from '../src/session.js';
import { teamThreads } from '../src/board/threads.js';

test('two people resume one team thread, retry, search, read updates and lose access after removal', async () => {
  const ctx = createContext({ location: ':memory:', model: null });
  const a = ctx.store.addPerson('Ana'),
    b = ctx.store.addPerson('Beto');
  const g = ctx.teams.createTeam('Prueba');
  for (const p of [a, b]) ctx.teams.addMember(g.id, p.token);
  const run = teamThreads(ctx);
  const first = { id: 'claude-a', label: 'Claude Code', personToken: a.token };
  const second = { id: 'codex-b', label: 'Codex', personToken: b.token };
  const query = { equipo: g.id, referencia: 'Vita-cl/prueba#35' };
  const post = { ...query, titulo: 'Verificar el enlace', texto: 'Revisé el enlace con el usuario de prueba.', clave: 'primera-prueba' };
  const publish = async (actor: typeof first, p: typeof post) =>
    (await run('ronda_hilo_publicar', actor, p)) as { id: number; hilo: string };
  const entries = await Promise.all([publish(first, post), publish(first, post)]);
  assert.equal(entries[0]!.id, entries[1]!.id);
  const reply = await publish(second, {
    ...post,
    referencia: 'https://github.com/vita-cl/prueba/pull/35',
    texto: 'Comprobé el segundo caso.',
    clave: 'siguiente',
  });
  assert.equal(reply.hilo, entries[0]!.hilo);
  const thread = await run('ronda_hilo', second, query);
  assert.deepEqual('mensajes' in thread && thread.mensajes?.map((r) => r.agente), ['Claude Code', 'Codex']);
  for (const search of ['Beto', 'Vita-cl/prueba#35', 'enlace']) {
    const matches = await run('ronda_hilos', second, { equipo: g.id, buscar: search });
    assert.equal('hilos' in matches && matches.hilos?.length, 1);
  }
  const updates = await run('ronda_hilos_novedades', first, { equipo: g.id, desde: entries[0]!.id });
  assert.deepEqual('mensajes' in updates && updates.mensajes?.map((r) => r.id), [reply.id]);
  await assert.rejects(publish(first, { ...post, texto: 'otro' }), /otra actualización/);
  const app = createApp(ctx);
  const path = '/api/team-threads/' + g.id + '/' + reply.hilo;
  const headers = { cookie: SESSION_COOKIE + '=' + ctx.vault.seal(JSON.stringify({ token: b.token })) };
  assert.equal((await app.request(path)).status, 401);
  const page = await app.request(path, { headers });
  assert.equal(page.status, 200);
  assert.match(page.headers.get('cache-control') ?? '', /no-store/);
  assert.equal((await page.json()).mensajes.length, 2);
  ctx.teams.removeMember(g.id, b.token);
  assert.equal((await app.request(path, { headers })).status, 403);
  await assert.rejects(run('ronda_hilo', second, query), /pertenecer/);
});
