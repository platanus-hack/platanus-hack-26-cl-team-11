import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as z from 'zod/v4';
import { RepoDigestAnswer } from '../src/agents/digest.js';
import type { AgentModel, AgentRequest } from '../src/agents/model.js';
import { ContactPlan, HelpReply, ProposalDraft } from '../src/agents/prompts.js';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';
import { MAX_SIM_PEOPLE, SimTeam } from '../src/sim/personas.js';

const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

function fakeModel(hold?: Promise<void>) {
  const asked: z.ZodType[] = [];
  const model: AgentModel = {
    async decide<Schema extends z.ZodType>(request: AgentRequest<Schema>): Promise<z.infer<Schema>> {
      const schema: z.ZodType = request.schema;
      asked.push(schema);
      if (schema === SimTeam) {
        if (hold) await hold;
        const listed = JSON.parse(request.prompt.slice(request.prompt.indexOf('['), request.prompt.lastIndexOf(']') + 1)) as Array<{ id: string }>;
        return request.schema.parse({
          people: listed.map(({ id }, index) => ({
            id,
            role: 'Ingeniera de pagos',
            workingOn: 'Integra el cobro con tarjeta.',
            needTopic: index === 0 ? 'Conciliación bancaria' : '',
            needStatement: index === 0 ? 'Necesita a alguien que conozca la conciliación bancaria.' : '',
            expertise: ['Conciliación', 'SQL'],
          })),
        });
      }
      if (schema === ContactPlan) return request.schema.parse({ contacts: [{ teammate: 'p1', message: 'Necesita ayuda con la conciliación.' }] });
      if (schema === HelpReply) return request.schema.parse({ help: 'si', message: 'Puede ayudar con eso.' });
      if (schema === ProposalDraft) return request.schema.parse({ helpers: ['p1'], text: 'Una persona ayuda a otra con la conciliación.' });
      throw new Error('Unexpected schema.');
    },
  };
  return { model, asked };
}

interface RoomState {
  people: Array<{ name: string; synthetic: boolean }>;
  round: { status: string } | null;
  threads: Array<{ topic: string; help: string | null; messages: Array<{ from: string; text: string }> | null }>;
}

async function setup(model: AgentModel | null) {
  const ctx = createContext({ location: ':memory:', model });
  const app = createApp(ctx);
  const room = (await (await app.request('/api/rooms', json({ name: 'Banco Sur' }))).json()) as { code: string };
  const state = async () => (await (await app.request(`/api/rooms/${room.code}/state`)).json()) as RoomState;
  const settled = async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const current = await state();
      if (current.round && current.round.status !== 'en_curso') return current;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('The round never finished.');
  };
  return { ctx, app, room, state, settled };
}

test('a simulation fills the room with invented people, each with a repo, and their agents talk without reading the repos again', async () => {
  const { model, asked } = fakeModel();
  const { ctx, app, room, settled } = await setup(model);
  const started = await app.request(`/api/rooms/${room.code}/simulate`, json({ people: 12 }));
  assert.equal(started.status, 202);
  assert.equal(((await started.json()) as { people: number }).people, 12);

  const state = await settled();
  assert.equal(state.round?.status, 'lista');
  assert.equal(state.people.length, 12);
  assert.ok(state.people.every((person) => person.synthetic));
  const first = ctx.teams.membersOf(ctx.rooms.findRoom(room.code)?.teamId ?? '').find((member) => member.name === 'Camila');
  assert.deepEqual(
    ctx.repo.tree(first?.token ?? '').map((entry) => [entry.path, entry.share, entry.updatedBy]),
    [
      ['README.md', 'siempre', 'Simulación'],
      ['ahora.md', 'siempre', 'Simulación'],
      ['sabe.md', 'siempre', 'Simulación'],
    ],
  );
  assert.match(ctx.repo.read(first?.token ?? '', 'ahora.md')?.content ?? '', /conciliación bancaria/);

  assert.equal(asked.filter((schema) => schema === SimTeam).length, 2);
  assert.equal(asked.filter((schema) => schema === RepoDigestAnswer).length, 0);
  assert.equal(state.threads.length, 2);
  for (const thread of state.threads) {
    assert.deepEqual(
      thread.messages?.map((message) => message.text),
      ['Necesita ayuda con la conciliación.', 'Puede ayudar con eso.'],
    );
  }
});

test('the room screen shows what two invented people say, and never what a real person says', async () => {
  const { model } = fakeModel();
  const { ctx, app, room, settled } = await setup(model);
  const ana = (await (await app.request(`/api/rooms/${room.code}/join`, json({ name: 'Ana' }))).json()) as { token: string };
  ctx.repo.commit(ana.token, { by: 'Codex', message: 'Contexto', topics: [], files: [{ path: 'ahora.md', content: 'x', share: 'siempre' }], remove: [] });
  ctx.digests.save(ana.token, ctx.repo.version(ana.token), { workingOn: [], needs: [{ topic: 'Contrato', statement: 'Necesita revisar un contrato.' }], expertise: [] });
  await app.request(`/api/rooms/${room.code}/simulate`, json({ people: 3 }));

  const state = await settled();
  assert.deepEqual(
    state.people.map((person) => person.synthetic),
    [false, true, true, true],
  );
  const hers = state.threads.find((thread) => thread.topic === 'Contrato');
  assert.equal(hers?.help, 'si');
  assert.equal(hers?.messages, null);
  assert.ok(state.threads.length >= 2);
  assert.ok(state.threads.every((thread) => thread.messages === null));
});

test('a simulation needs the model, an existing room and a free room, and never passes sixty people', async () => {
  const offline = await setup(null);
  assert.equal((await offline.app.request(`/api/rooms/${offline.room.code}/simulate`, json({ people: 5 }))).status, 503);
  assert.equal((await offline.app.request('/api/rooms/NOPE00/simulate', json({ people: 5 }))).status, 404);

  let release = () => {};
  const { model } = fakeModel(new Promise<void>((resolve) => (release = resolve)));
  const { app, room, settled } = await setup(model);
  const first = app.request(`/api/rooms/${room.code}/simulate`, json({ people: 5000 }));
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal((await app.request(`/api/rooms/${room.code}/simulate`, json({ people: 5 }))).status, 409);
  release();
  assert.equal(((await (await first).json()) as { people: number }).people, MAX_SIM_PEOPLE);
  assert.equal((await settled()).people.length, MAX_SIM_PEOPLE);
  const again = await app.request(`/api/rooms/${room.code}/simulate`, json({ people: 5 }));
  assert.equal(((await again.json()) as { people: number }).people, 0);
});
