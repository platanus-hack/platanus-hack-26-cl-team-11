import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as z from 'zod/v4';
import { AssembledAnswer, QuestionAnswer } from '../src/agents/ask.js';
import { AgentModelError, type AgentModel, type AgentRequest } from '../src/agents/model.js';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';

const QUESTION = '¿Alguien ya integró pagos con Toku?';
const SHARED = 'Integré los pagos con Toku en marzo. El webhook llega firmado.';
const HELD_BACK = 'Estoy agotada y no quiero más proyectos.';
const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

interface Script {
  knows?: (ownerName: string) => 'si' | 'parcial' | 'no';
  fail?: boolean;
  hold?: Promise<void>;
}

interface ReplyView {
  authorName: string;
  text: string | null;
  tellable: boolean;
  byAgent: boolean;
}

interface PostView {
  id: string;
  kind: string;
  replies: ReplyView[];
  answer: { status: string; text: string | null; sources: string[]; asked: number; problem: string | null } | null;
}

function fakeModel(script: Script = {}) {
  const prompts: string[] = [];
  const model: AgentModel = {
    async decide<Schema extends z.ZodType>(request: AgentRequest<Schema>): Promise<z.infer<Schema>> {
      prompts.push(`${request.system}\n${request.prompt}`);
      if (script.hold) await script.hold;
      if (script.fail) throw new AgentModelError('El modelo no respondió.');
      const schema: z.ZodType = request.schema;
      const ownerName = /agente personal de (\S+) en Ronda/.exec(request.system)?.[1] ?? '';
      if (schema === QuestionAnswer) {
        const knows = script.knows?.(ownerName) ?? 'si';
        return request.schema.parse({ knows, answer: knows === 'no' ? '' : `${ownerName} integró pagos con Toku en marzo.` });
      }
      if (schema === AssembledAnswer) return request.schema.parse({ answer: 'Tomás ya integró pagos con Toku en marzo.', sources: ['r1', 'r9'] });
      throw new Error('Unexpected schema.');
    },
  };
  return { model, prompts };
}

function setup(model: AgentModel | null) {
  const ctx = createContext({ location: ':memory:', model });
  const app = createApp(ctx);
  const ana = ctx.store.addPerson('Ana');
  const tomas = ctx.store.addPerson('Tomás');
  const lia = ctx.store.addPerson('Lía');
  const bruno = ctx.store.addPerson('Bruno');
  const team = ctx.teams.createTeam('Producto');
  for (const member of [ana, tomas, lia, bruno]) ctx.teams.addMember(team.id, member.token);
  const write = (token: string, path: string, content: string, share: 'siempre' | 'preguntar' | 'nunca') =>
    ctx.repo.commit(token, { by: 'prueba', message: 'Estado', topics: [], files: [{ path, content, share }], remove: [] });
  write(tomas.token, 'sabe.md', SHARED, 'siempre');
  write(tomas.token, 'privado.md', HELD_BACK, 'preguntar');
  write(lia.token, 'ahora.md', 'Trabajo en el diseño del tablero.', 'siempre');

  const publish = async (author: string, kind: string, text: string) =>
    (await (await app.request(`/api/people/${author}/teams/${team.id}/board`, json({ kind, text }))).json()) as PostView;
  const board = async (viewer: string) =>
    (await (await app.request(`/api/people/${viewer}/teams/${team.id}/board`)).json()) as { configured: boolean; posts: PostView[] };
  const postOf = async (viewer: string, postId: string) => (await board(viewer)).posts.find((post) => post.id === postId) as PostView;
  const ask = (author: string, postId: string) => app.request(`/api/people/${author}/board/${postId}/ask`, json({}));
  const settled = async (viewer: string, postId: string) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const current = await postOf(viewer, postId);
      if (current.answer && current.answer.status !== 'en_curso') return current;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('The agents never finished.');
  };
  return { ctx, app, team, ana, tomas, lia, bruno, publish, board, postOf, ask, settled };
}

test('a question on the board is answered by the agents of the people who share something, and the asker gets one answer', async () => {
  const { model, prompts } = fakeModel({ knows: (owner) => (owner === 'Tomás' ? 'si' : 'no') });
  const { ana, lia, publish, settled, board } = setup(model);

  const published = await publish(ana.token, 'pregunta', QUESTION);
  assert.equal(published.answer?.status, 'en_curso');
  const done = await settled(ana.token, published.id);

  assert.equal(done.answer?.status, 'lista');
  assert.equal(done.answer?.text, 'Tomás ya integró pagos con Toku en marzo.');
  assert.deepEqual(done.answer?.sources, ['Tomás']);
  assert.equal(done.answer?.asked, 2);
  assert.equal(done.answer?.problem, null);
  assert.deepEqual(done.replies, [{ ...done.replies[0], authorName: 'Tomás', text: 'Tomás integró pagos con Toku en marzo.', tellable: true, byAgent: true }]);

  const seenByLia = (await board(lia.token)).posts[0] as PostView;
  assert.equal(seenByLia.replies[0]?.text, 'Tomás integró pagos con Toku en marzo.');
  assert.equal(seenByLia.answer?.text, 'Tomás ya integró pagos con Toku en marzo.');

  assert.equal(prompts.length, 3);
  const everything = prompts.join('\n');
  assert.ok(everything.includes(SHARED));
  assert.ok(!everything.includes(HELD_BACK));
  assert.ok(!prompts.some((prompt) => prompt.includes('agente personal de Bruno')));
});

test('when no agent knows anything the asker is told so and no answer is made up', async () => {
  const { model, prompts } = fakeModel({ knows: () => 'no' });
  const { ana, publish, settled } = setup(model);

  const done = await settled(ana.token, (await publish(ana.token, 'pregunta', QUESTION)).id);
  assert.equal(done.answer?.status, 'lista');
  assert.equal(done.answer?.text, null);
  assert.deepEqual(done.answer?.sources, []);
  assert.deepEqual(done.replies, []);
  assert.equal(prompts.length, 2);
});

test('only questions go to the agents, and without a model the board works as before', async () => {
  const { model, prompts } = fakeModel();
  const withModel = setup(model);
  const request = await withModel.publish(withModel.ana.token, 'pedido', 'Necesito revisar el contrato.');
  assert.equal(request.answer, null);
  assert.equal((await withModel.ask(withModel.ana.token, request.id)).status, 400);
  assert.deepEqual(prompts, []);

  const withoutModel = setup(null);
  const question = await withoutModel.publish(withoutModel.ana.token, 'pregunta', QUESTION);
  assert.equal(question.answer, null);
  assert.equal((await withoutModel.board(withoutModel.ana.token)).configured, false);
  assert.equal((await withoutModel.ask(withoutModel.ana.token, question.id)).status, 503);
});

test('a failed answer says why, and asking again replaces the agent replies instead of repeating them', async () => {
  const script: Script = { fail: true };
  const { model } = fakeModel(script);
  const { ana, tomas, publish, settled, ask, postOf } = setup(model);

  const failed = await settled(ana.token, (await publish(ana.token, 'pregunta', QUESTION)).id);
  assert.equal(failed.answer?.status, 'fallida');
  assert.equal(failed.answer?.problem, 'El modelo no respondió.');
  assert.deepEqual(failed.replies, []);

  assert.equal((await ask(tomas.token, failed.id)).status, 403);

  script.fail = false;
  assert.equal((await ask(ana.token, failed.id)).status, 202);
  const first = await settled(ana.token, failed.id);
  assert.equal(first.answer?.status, 'lista');
  assert.equal(first.replies.length, 2);

  assert.equal((await ask(ana.token, failed.id)).status, 202);
  const second = await settled(ana.token, failed.id);
  assert.equal(second.replies.length, 2);
  assert.equal((await postOf(ana.token, failed.id)).answer?.sources.length, 1);
});

test('a question that is being answered cannot be asked again, and a team answers at most three at once', async () => {
  let release: () => void = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { model } = fakeModel({ hold });
  const { ana, publish, ask, settled } = setup(model);

  const posts = [];
  for (let position = 0; position < 4; position += 1) posts.push(await publish(ana.token, 'pregunta', `${QUESTION} ${position}`));
  assert.deepEqual(posts.map((post) => post.answer?.status ?? null), ['en_curso', 'en_curso', 'en_curso', null]);
  assert.equal((await ask(ana.token, posts[0]?.id ?? '')).status, 409);
  assert.equal((await ask(ana.token, posts[3]?.id ?? '')).status, 429);

  release();
  for (const post of posts.slice(0, 3)) assert.equal((await settled(ana.token, post.id)).answer?.status, 'lista');
  assert.equal((await ask(ana.token, posts[3]?.id ?? '')).status, 202);
  assert.equal((await settled(ana.token, posts[3]?.id ?? '')).answer?.status, 'lista');
});
