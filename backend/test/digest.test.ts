import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as z from 'zod/v4';
import { RepoDigestAnswer } from '../src/agents/digest.js';
import { AgentModelError, type AgentModel, type AgentRequest } from '../src/agents/model.js';
import { ContactPlan, HelpReply, ProposalDraft } from '../src/agents/prompts.js';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';

const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

interface DigestScript {
  workingOn?: string[];
  needs?: Array<{ topic: string; statement: string; path: string }>;
  expertise?: string[];
}

function fakeModel(digestOf: (ownerPrompt: string) => DigestScript | 'falla') {
  const prompts: string[] = [];
  let digests = 0;
  const model: AgentModel = {
    async decide<Schema extends z.ZodType>(request: AgentRequest<Schema>): Promise<z.infer<Schema>> {
      prompts.push(`${request.system}\n${request.prompt}`);
      const schema: z.ZodType = request.schema;
      if (schema === RepoDigestAnswer) {
        digests += 1;
        const script = digestOf(request.system);
        if (script === 'falla') throw new AgentModelError('El modelo rechazó las credenciales del servidor.');
        return request.schema.parse({ workingOn: [], needs: [], expertise: [], ...script });
      }
      if (schema === ContactPlan) return request.schema.parse({ contacts: [{ teammate: 'p1', message: 'Ana necesita ayuda con OAuth.' }] });
      if (schema === HelpReply) return request.schema.parse({ help: 'si', message: 'Puede ayudar con eso.' });
      if (schema === ProposalDraft) return request.schema.parse({ helpers: ['p1'], text: 'Tomás ayuda a Ana con el OAuth de Google.' });
      throw new Error('Unexpected schema.');
    },
  };
  return { model, prompts, digestCalls: () => digests };
}

const NEED = { topic: 'OAuth de Google', statement: 'Necesita a alguien que conozca el OAuth de Google para revisar los permisos.', path: 'ahora.md' };

async function setup(digestOf: (ownerPrompt: string) => DigestScript | 'falla') {
  const fake = fakeModel(digestOf);
  const ctx = createContext({ location: ':memory:', model: fake.model });
  const app = createApp(ctx);
  const room = (await (await app.request('/api/rooms', json({ name: 'Hack' }))).json()) as { code: string };
  const enter = async (name: string) => {
    const joined = (await (await app.request(`/api/rooms/${room.code}/join`, json({ name }))).json()) as { token: string };
    const redeemed = ctx.assistants.redeem(ctx.assistants.createPairing(joined.token).code, 'codex', 'Codex');
    const assistantToken = redeemed.state === 'vigente' ? redeemed.token : '';
    const commit = (body: unknown) => app.request('/api/repo/commit', { ...json(body), headers: { 'content-type': 'application/json', authorization: `Bearer ${assistantToken}` } });
    return { token: joined.token, commit };
  };
  const ana = await enter('Ana');
  const tomas = await enter('Tomás');
  const teamId = ctx.teams.teamsOf(ana.token)[0]?.id ?? '';
  const round = async () => {
    assert.equal((await app.request(`/api/people/${ana.token}/teams/${teamId}/agents/rounds`, json({}))).status, 202);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (ctx.agents.latestRound(teamId)?.status !== 'en_curso') return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('The round never finished.');
  };
  const events = async () => ((await (await app.request(`/api/rooms/${room.code}/events`)).json()) as { events: Array<{ type: string; payload: Record<string, unknown> }> }).events;
  return { ...fake, ctx, app, room, ana, tomas, teamId, round, events };
}

test('a need that an assistant wrote in a shared file becomes a conversation and a proposal, and the room sees each step', async () => {
  const { ctx, app, room, ana, tomas, teamId, round, events, prompts } = await setup((system) => (system.includes('Ana') ? { workingOn: ['Integra el login con Google.'], needs: [NEED] } : { expertise: ['OAuth', 'Google Cloud'] }));
  await ana.commit({ message: 'Contexto', files: [{ path: 'ahora.md', content: '- Necesita ayuda con el OAuth de Google.', share: 'siempre' }] });
  await tomas.commit({ message: 'Contexto', files: [{ path: 'sabe.md', content: '- OAuth y Google Cloud.', share: 'siempre' }] });
  await round();

  assert.deepEqual({ status: ctx.agents.latestRound(teamId)?.status, problem: ctx.agents.latestRound(teamId)?.problem }, { status: 'lista', problem: null });
  const proposals = ctx.agents.proposalsOf(teamId);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0]?.topic, 'OAuth de Google');
  assert.deepEqual(
    proposals[0]?.parties.map((party) => [party.name, party.role]),
    [
      ['Ana', 'pide'],
      ['Tomás', 'ayuda'],
    ],
  );
  const contact = prompts.find((prompt) => prompt.includes('Elige hasta'));
  assert.ok(contact?.includes('Google Cloud'));

  const happened = (await events()).map((event) => event.type);
  assert.deepEqual(happened.slice(-7), ['ronda_empieza', 'pedido_busca', 'hilo_abre', 'hilo_responde', 'propuesta_nace', 'pedido_cierra', 'ronda_termina']);
  const state = (await (await app.request(`/api/rooms/${room.code}/state`)).json()) as { threads: Array<{ topic: string; help: string }>; round: { status: string } };
  assert.deepEqual(
    state.threads.map((thread) => [thread.topic, thread.help]),
    [['OAuth de Google', 'si']],
  );
  assert.equal(state.round.status, 'lista');
});

test('a file that asks first or is private never reaches the model, and a path the model invents is ignored', async () => {
  const { ctx, ana, tomas, teamId, round, prompts } = await setup(() => ({ needs: [{ ...NEED, path: 'inventado.md' }] }));
  await ana.commit({
    message: 'Contexto',
    files: [
      { path: 'ahora.md', content: 'Trabaja en el login.', share: 'siempre' },
      { path: 'estado.md', content: 'Duerme mal por el plazo.' },
      { path: 'privado.md', content: 'Busca otro trabajo.', share: 'nunca' },
    ],
  });
  await tomas.commit({ message: 'Contexto', files: [{ path: 'sabe.md', content: 'OAuth.', share: 'siempre' }] });
  await round();

  const everything = prompts.join('\n');
  assert.ok(everything.includes('Trabaja en el login.'));
  assert.ok(!everything.includes('Duerme mal'));
  assert.ok(!everything.includes('Busca otro trabajo'));
  assert.deepEqual(ctx.agents.threadsOf(ctx.agents.latestRound(teamId)?.id ?? ''), []);
  assert.deepEqual(ctx.agents.proposalsOf(teamId), []);
});

test('a repo is read once per version: unchanged repos are not read again, a new commit is', async () => {
  const { ana, tomas, round, digestCalls } = await setup(() => ({}));
  await ana.commit({ message: 'Contexto', files: [{ path: 'ahora.md', content: 'Trabaja en el login.', share: 'siempre' }] });
  await round();
  assert.equal(digestCalls(), 1);
  await round();
  assert.equal(digestCalls(), 1);
  await tomas.commit({ message: 'Contexto', files: [{ path: 'sabe.md', content: 'OAuth.', share: 'siempre' }] });
  await round();
  assert.equal(digestCalls(), 2);
});

test('a need the person refused is not asked, even if it is still written in her repo', async () => {
  const { ctx, app, ana, tomas, teamId, round } = await setup((system) => (system.includes('Ana') ? { needs: [NEED] } : { expertise: ['OAuth'] }));
  await ana.commit({ message: 'Contexto', files: [{ path: 'ahora.md', content: 'Necesita ayuda con OAuth.', share: 'siempre' }] });
  await tomas.commit({ message: 'Contexto', files: [{ path: 'sabe.md', content: 'OAuth.', share: 'siempre' }] });
  assert.equal((await app.request(`/api/people/${ana.token}/agents/asks`, json({ topic: 'oauth de google', allow: false }))).status, 200);
  await round();
  assert.deepEqual(ctx.agents.proposalsOf(teamId), []);
});

test('when the model cannot read the repos the round says so instead of ending quietly with nothing', async () => {
  const { ctx, ana, teamId, round, events } = await setup(() => 'falla');
  await ana.commit({ message: 'Contexto', files: [{ path: 'ahora.md', content: 'Necesita ayuda con OAuth.', share: 'siempre' }] });
  await round();
  const latest = ctx.agents.latestRound(teamId);
  assert.deepEqual({ status: latest?.status, problem: latest?.problem }, { status: 'fallida', problem: 'El modelo rechazó las credenciales del servidor.' });
  assert.deepEqual((await events()).at(-1)?.payload.status, 'fallida');
});
