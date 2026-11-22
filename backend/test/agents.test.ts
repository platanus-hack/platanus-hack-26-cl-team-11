import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as z from 'zod/v4';
import { AgentModelError, type AgentModel, type AgentRequest } from '../src/agents/model.js';
import { ContactPlan, HelpReply, ProposalDraft } from '../src/agents/prompts.js';
import { runDueRounds } from '../src/agents/routine.js';
import { ROUND_TIME_LIMIT_MS } from '../src/agents/store.js';
import { createApp } from '../src/app.js';
import { createContext, type AppContext } from '../src/context.js';
import { seedDemo } from '../src/seed.js';

const TOPIC = 'integración de pagos';
const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

interface Script {
  contacts?: Array<{ teammate: string; message: string }>;
  help?: 'si' | 'parcial' | 'no';
  helpers?: string[];
  fail?: boolean;
  hold?: Promise<void>;
}

function fakeModel(script: Script = {}) {
  const prompts: string[] = [];
  const model: AgentModel = {
    async decide<Schema extends z.ZodType>(request: AgentRequest<Schema>): Promise<z.infer<Schema>> {
      prompts.push(`${request.system}\n${request.prompt}`);
      if (script.hold) await script.hold;
      if (script.fail) throw new AgentModelError('El modelo no respondió.');
      const schema: z.ZodType = request.schema;
      if (schema === ContactPlan) return request.schema.parse({ contacts: script.contacts ?? [{ teammate: 'p1', message: 'Ana necesita ayuda con pagos.' }] });
      if (schema === HelpReply) return request.schema.parse({ help: script.help ?? 'si', message: 'Puede ayudar con eso.' });
      if (schema === ProposalDraft) return request.schema.parse({ helpers: script.helpers ?? ['p1'], text: 'Tomás ayuda a Ana con la integración de pagos.' });
      throw new Error('Unexpected schema.');
    },
  };
  return { model, prompts };
}

interface AgentsView {
  configured: boolean;
  round: { status: string; problem: string | null } | null;
  asks: Array<{ topic: string }>;
  threads: Array<{ requesterName: string; helperName: string; help: string | null; mine: boolean; messages: Array<{ fromName: string; text: string }> | null }>;
  proposals: Array<{ id: string; text: string; status: string; myAnswer: string | null; parties: Array<{ name: string; role: string; answer: string }> }>;
}

function setup(model: AgentModel | null) {
  const ctx = createContext({ location: ':memory:', model });
  const app = createApp(ctx);
  const people = seedDemo(ctx);
  const team = ctx.teams.createTeam('Producto');
  for (const person of people) ctx.teams.addMember(team.id, person.token);
  const tokenOf = (name: string) => people.find((person) => person.name === name)?.token ?? '';
  const view = async (name: string) => (await (await app.request(`/api/people/${tokenOf(name)}/teams/${team.id}/agents`)).json()) as AgentsView;
  const startRound = (name: string) => app.request(`/api/people/${tokenOf(name)}/teams/${team.id}/agents/rounds`, json({}));
  const settled = async (name: string) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const current = await view(name);
      if (current.round && current.round.status !== 'en_curso') return current;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('The round never finished.');
  };
  const allow = (name: string, topic: string, allowed = true) => app.request(`/api/people/${tokenOf(name)}/agents/asks`, json({ topic, allow: allowed }));
  const answer = (name: string, proposalId: string, decision: string) =>
    app.request(`/api/people/${tokenOf(name)}/agents/proposals/${proposalId}/answer`, json({ answer: decision }));
  return { ctx, app, team, tokenOf, view, startRound, settled, allow, answer };
}

test('a blocker that asks first stays with its owner until they allow it, then two agents talk and both people agree', async () => {
  const { model, prompts } = fakeModel();
  const { view, startRound, settled, allow, answer } = setup(model);

  const before = await view('Ana');
  assert.equal(before.configured, true);
  assert.deepEqual(before.asks.map((ask) => ask.topic), [TOPIC]);

  assert.equal((await startRound('Ana')).status, 202);
  const silent = await settled('Ana');
  assert.equal(silent.round?.status, 'lista');
  assert.deepEqual(silent.threads, []);
  assert.deepEqual(prompts, []);

  assert.equal((await allow('Ana', TOPIC)).status, 200);
  assert.deepEqual((await view('Ana')).asks, []);
  assert.equal((await startRound('Ana')).status, 202);
  const done = await settled('Ana');
  assert.equal(done.round?.status, 'lista');
  assert.equal(done.round?.problem, null);
  assert.equal(done.threads.length, 1);
  assert.equal(done.threads[0]?.requesterName, 'Ana');
  assert.equal(done.threads[0]?.help, 'si');
  assert.deepEqual(done.threads[0]?.messages?.map((message) => message.fromName), ['Ana', done.threads[0]?.helperName]);

  const helperName = done.threads[0]?.helperName ?? '';
  const outsider = ['Tomás', 'Sofía', 'Diego', 'Carla'].find((name) => name !== helperName) ?? '';
  const proposal = done.proposals[0];
  assert.equal(proposal?.status, 'por_aprobar');
  assert.equal(proposal?.myAnswer, 'pendiente');
  assert.deepEqual(proposal?.parties.map((party) => party.role), ['pide', 'ayuda']);

  const outside = await view(outsider);
  assert.deepEqual(outside.proposals, []);
  assert.equal(outside.threads[0]?.mine, false);
  assert.equal(outside.threads[0]?.messages, null);
  assert.equal((await answer(outsider, proposal?.id ?? '', 'acepta')).status, 403);
  assert.equal((await answer('Ana', proposal?.id ?? '', 'quizas')).status, 400);

  assert.equal((await answer('Ana', proposal?.id ?? '', 'acepta')).status, 200);
  assert.equal((await view('Ana')).proposals[0]?.status, 'por_aprobar');
  assert.equal((await answer(helperName, proposal?.id ?? '', 'acepta')).status, 200);
  assert.equal((await view(outsider)).proposals[0]?.status, 'acordada');
  assert.equal((await answer('Ana', proposal?.id ?? '', 'rechaza')).status, 409);
});

test('nothing private reaches the model: no energy, load, sleep or check-in note, only what each person lets out', async () => {
  const { model, prompts } = fakeModel();
  const { ctx, app, startRound, settled, allow } = setup(model);
  for (const person of ctx.store.listPeople()) {
    const saved = await app.request(`/api/people/${person.token}/policy`, { ...json({ energy: 'preguntar', load: 'preguntar' }), method: 'PUT' });
    assert.equal(saved.status, 200);
  }
  await allow('Ana', TOPIC);
  await startRound('Ana');
  await settled('Ana');

  assert.ok(prompts.length >= 3);
  const sent = prompts.join('\n');
  assert.ok(sent.includes(TOPIC));
  for (const leak of ['Energía', 'Carga', 'sueño', 'sleep', 'reuniones', 'cansada']) assert.ok(!sent.includes(leak), `leaked ${leak}`);
});

test('by default energy and load are shared, so the agents get them until the person changes the permission', async () => {
  const { model, prompts } = fakeModel();
  const { startRound, settled, allow } = setup(model);
  await allow('Ana', TOPIC);
  await startRound('Ana');
  await settled('Ana');

  assert.ok(prompts.join('\n').includes('Energía'));
});

test('a topic the owner refuses never opens a conversation, and an open proposal is not asked twice', async () => {
  const refused = setup(fakeModel().model);
  await refused.allow('Ana', TOPIC, false);
  await refused.startRound('Ana');
  const afterRefusal = await refused.settled('Ana');
  assert.deepEqual(afterRefusal.asks, []);
  assert.deepEqual(afterRefusal.threads, []);

  const { model, prompts } = fakeModel();
  const repeated = setup(model);
  await repeated.allow('Ana', TOPIC);
  await repeated.startRound('Ana');
  await repeated.settled('Ana');
  const callsAfterFirst = prompts.length;
  await repeated.startRound('Tomás');
  const second = await repeated.settled('Ana');
  assert.equal(prompts.length, callsAfterFirst);
  assert.equal(second.proposals.length, 1);

  const proposal = second.proposals[0];
  assert.equal((await repeated.answer('Ana', proposal?.id ?? '', 'rechaza')).status, 200);
  assert.equal((await repeated.view('Ana')).proposals[0]?.status, 'descartada');
  await repeated.startRound('Ana');
  assert.equal((await repeated.settled('Ana')).proposals.length, 2);
});

test('when nobody can help there is no proposal, and ids the model invents are ignored', async () => {
  const nobody = setup(fakeModel({ help: 'no' }).model);
  await nobody.allow('Ana', TOPIC);
  await nobody.startRound('Ana');
  const declined = await nobody.settled('Ana');
  assert.equal(declined.threads[0]?.help, 'no');
  assert.deepEqual(declined.proposals, []);

  const invented = setup(fakeModel({ contacts: [{ teammate: 'p99', message: 'Hola' }], helpers: ['p99'] }).model);
  await invented.allow('Ana', TOPIC);
  await invented.startRound('Ana');
  const ignored = await invented.settled('Ana');
  assert.deepEqual(ignored.threads, []);
  assert.deepEqual(ignored.proposals, []);
});

test('a round needs the model configured, runs one at a time and reports a model failure', async () => {
  const unconfigured = setup(null);
  assert.equal((await unconfigured.view('Ana')).configured, false);
  assert.equal((await unconfigured.startRound('Ana')).status, 503);

  let release: () => void = () => {};
  const hold = new Promise<void>((resolve) => (release = resolve));
  const busy = setup(fakeModel({ hold }).model);
  await busy.allow('Ana', TOPIC);
  assert.equal((await busy.startRound('Ana')).status, 202);
  assert.equal((await busy.startRound('Tomás')).status, 409);
  release();
  assert.equal((await busy.settled('Ana')).round?.status, 'lista');

  const failing = setup(fakeModel({ fail: true }).model);
  await failing.allow('Ana', TOPIC);
  await failing.startRound('Ana');
  const failed = await failing.settled('Ana');
  assert.equal(failed.round?.status, 'fallida');
  assert.equal(failed.round?.problem, 'El modelo no respondió.');

  const stranger = failing.ctx.store.addPerson('Fuera');
  assert.equal((await failing.app.request(`/api/people/${stranger.token}/teams/${failing.team.id}/agents`)).status, 403);
  assert.equal((await failing.app.request(`/api/people/${stranger.token}/teams/${failing.team.id}/agents/rounds`, json({}))).status, 403);
});

const withHour = (ctx: AppContext, hour: number | null): AppContext => ({ ...ctx, config: { ...ctx.config, agentRoundHour: hour } });

test('the daily routine waits for its hour, skips teams with nothing to ask and runs once a day', async () => {
  const { model, prompts } = fakeModel();
  const { ctx, view, allow } = setup(model);
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', hourCycle: 'h23' }).format(now));

  assert.equal(await runDueRounds(withHour(ctx, null), now), 0);
  assert.equal(await runDueRounds(withHour(ctx, hour), now), 0);
  assert.equal((await view('Ana')).round, null);

  await allow('Ana', TOPIC);
  if (hour < 23) assert.equal(await runDueRounds(withHour(ctx, hour + 1), now), 0);
  assert.equal(await runDueRounds(withHour(ctx, hour), now), 1);
  assert.equal((await view('Ana')).round?.status, 'lista');
  const calls = prompts.length;
  assert.ok(calls >= 3);
  assert.equal(await runDueRounds(withHour(ctx, hour), now), 0);
  assert.equal(prompts.length, calls);
});

test('a round stuck past its time limit is closed as failed and no longer blocks the team', () => {
  const { ctx, team } = setup(fakeModel().model);
  const stuck = ctx.agents.startRound(team.id, null);
  assert.ok(stuck);
  assert.equal(ctx.agents.startRound(team.id, null), null);

  const longAgo = new Date(Date.now() - ROUND_TIME_LIMIT_MS - 1000).toISOString();
  ctx.db.prepare('UPDATE agent_rounds SET started_at = ? WHERE id = ?').run(longAgo, stuck.id);
  const next = ctx.agents.startRound(team.id, null);
  assert.ok(next);
  assert.notEqual(next.id, stuck.id);

  ctx.agents.finishRound(stuck.id, 'lista', null);
  const closed = ctx.db.prepare('SELECT status, problem FROM agent_rounds WHERE id = ?').get(stuck.id) as { status: string; problem: string };
  assert.equal(closed.status, 'fallida');
  assert.ok(closed.problem.includes('tardó demasiado'));
});
