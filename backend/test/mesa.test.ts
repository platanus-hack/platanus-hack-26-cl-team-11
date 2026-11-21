import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as z from 'zod/v4';
import type { RoundEstimate } from '../src/agents/estimate.js';
import type { AgentModel, AgentRequest } from '../src/agents/model.js';
import { ContactPlan, HelpReply, ProposalDraft } from '../src/agents/prompts.js';
import { createApp } from '../src/app.js';
import { createContext, type Config } from '../src/context.js';
import { openLoginStore } from '../src/logins.js';
import { mesaMembersOf } from '../src/mesa/members.js';
import { MESA_TEAM_ID } from '../src/mesa/store.js';
import { runMesaTick } from '../src/mesa/ticker.js';
import { seedDemo } from '../src/seed.js';

const TOPIC = 'integración de pagos';
const SPENT_PER_CALL = { inputTokens: 100, outputTokens: 10, measured: true };
const send = (method: string, body: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

interface MesaView {
  configured: boolean;
  operator: boolean;
  member: boolean;
  publishing: boolean;
  intervalSeconds: number | null;
  round: { id: string; status: string; problem: string | null } | null;
  estimate: RoundEstimate;
  usage: { lastRound: { calls: number; tokens: number; measured: boolean } | null; lastDayTokens: number; dailyCap: number };
  asks: Array<{ topic: string }>;
  threads: Array<{ requesterName: string; mine: boolean; messages: unknown[] | null }>;
  proposals: Array<{ id: string }>;
}

function fakeModel() {
  const prompts: string[] = [];
  const model: AgentModel = {
    async decide<Schema extends z.ZodType>(request: AgentRequest<Schema>): Promise<z.infer<Schema>> {
      prompts.push(request.prompt);
      request.onUsage?.(SPENT_PER_CALL);
      const schema: z.ZodType = request.schema;
      if (schema === ContactPlan) return request.schema.parse({ contacts: [{ teammate: 'p1', message: 'Ana necesita ayuda con pagos.' }] });
      if (schema === HelpReply) return request.schema.parse({ help: 'si', message: 'Puede ayudar con eso.' });
      if (schema === ProposalDraft) return request.schema.parse({ helpers: ['p1'], text: 'Tomás ayuda a Ana con la integración de pagos.' });
      throw new Error('Unexpected schema.');
    },
  };
  return { model, prompts };
}

function setup(options: { config?: Config; model?: AgentModel | null } = {}) {
  const fake = fakeModel();
  const ctx = createContext({ location: ':memory:', model: options.model === undefined ? fake.model : options.model, config: options.config ?? { publicBaseUrl: null, oauth: {} } });
  const app = createApp(ctx);
  const people = seedDemo(ctx);
  const tokenOf = (name: string) => people.find((person) => person.name === name)?.token ?? '';
  const view = async (name: string) => (await (await app.request(`/api/people/${tokenOf(name)}/mesa`)).json()) as MesaView;
  const startRound = (name: string) => app.request(`/api/people/${tokenOf(name)}/mesa/rounds`, send('POST', {}));
  const setInterval = (name: string, seconds: unknown) => app.request(`/api/people/${tokenOf(name)}/mesa/interval`, send('PUT', { seconds }));
  const setMember = (name: string, member: unknown) => app.request(`/api/people/${tokenOf(name)}/mesa/membership`, send('PUT', { member }));
  const settled = async (name: string) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const current = await view(name);
      if (current.round && current.round.status !== 'en_curso') return current;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('The round never finished.');
  };
  return { ctx, app, people, prompts: fake.prompts, tokenOf, view, startRound, setInterval, setMember, settled };
}

test('everyone is in the public table without joining a team, except simulated people and whoever left', async () => {
  const { ctx, people, tokenOf, view, setMember } = setup();
  assert.equal(ctx.teams.teamsOf(tokenOf('Ana')).length, 0);
  assert.equal(ctx.teams.isMember(MESA_TEAM_ID, tokenOf('Ana')), false);
  assert.equal(mesaMembersOf(ctx).length, people.length);

  const invented = ctx.store.addPerson('Persona simulada');
  ctx.sim.mark(invented.token);
  const silent = ctx.store.addPerson('Sin nada publicado');
  assert.equal(mesaMembersOf(ctx).length, people.length + 1);
  const before = await view('Ana');
  assert.equal(before.member, true);
  assert.equal(before.estimate.people, people.length);
  assert.equal((await (await createApp(ctx).request(`/api/people/${silent.token}/mesa`)).json() as MesaView).publishing, false);

  assert.equal((await setMember('Tomás', 'no')).status, 400);
  assert.equal((await setMember('Tomás', false)).status, 200);
  assert.equal((await view('Tomás')).member, false);
  assert.equal((await view('Ana')).estimate.people, people.length - 1);
  assert.equal((await setMember('Tomás', true)).status, 200);
  assert.equal((await view('Ana')).estimate.people, people.length);
});

test('a round in the public table is estimated first, then run by hand, and the spend is shown next to the estimate', async () => {
  const { ctx, tokenOf, view, startRound, settled, prompts } = setup();
  const idle = await view('Ana');
  assert.equal(idle.configured, true);
  assert.equal(idle.operator, true);
  assert.equal(idle.round, null);
  assert.ok(idle.estimate.needs > 0, 'sin pedidos, igual conversan sobre lo que cada persona hace');
  assert.deepEqual(idle.asks.map((ask) => ask.topic), [TOPIC]);

  ctx.agents.decideTopic(tokenOf('Ana'), TOPIC, true);
  const ready = await view('Ana');
  assert.equal(ready.estimate.needs, 1);
  assert.ok(ready.estimate.tokens.total > 0);
  assert.deepEqual(prompts, []);

  assert.equal((await startRound('Ana')).status, 202);
  const done = await settled('Ana');
  assert.equal(done.round?.status, 'lista');
  assert.equal(done.round?.problem, null);
  assert.equal(done.threads.length, 1);
  assert.equal(done.threads[0]?.requesterName, 'Ana');
  assert.equal(done.threads[0]?.mine, true);
  assert.equal(done.proposals.length, 1);
  assert.deepEqual(done.usage.lastRound, { calls: 3, tokens: 330, measured: true });
  assert.equal(done.usage.lastDayTokens, 330);
  assert.ok(done.usage.lastRound.calls >= ready.estimate.calls.min && done.usage.lastRound.calls <= ready.estimate.calls.max);

  const outsider = await view('Carla');
  assert.equal(outsider.threads.length, 1);
  assert.equal(outsider.threads[0]?.mine, false);
  assert.equal(outsider.threads[0]?.messages, null);
  assert.deepEqual(outsider.proposals, []);
});

test('only the Montu team starts rounds and sets the interval once people sign in with Google', async () => {
  const config: Config = { publicBaseUrl: null, oauth: { google: { clientId: 'id', clientSecret: 'secret' } }, mesaOperators: ['ana@montu.test'] };
  const { ctx, tokenOf, view, startRound, setInterval } = setup({ config });
  openLoginStore(ctx.db).assign('Ana@Montu.test', tokenOf('Ana'), 'Ana');
  openLoginStore(ctx.db).assign('tomas@montu.test', tokenOf('Tomás'), 'Tomás');

  assert.equal((await view('Ana')).operator, true);
  assert.equal((await view('Tomás')).operator, false);
  assert.equal((await view('Sofía')).operator, false);
  assert.equal((await startRound('Tomás')).status, 403);
  assert.equal((await setInterval('Tomás', 60)).status, 403);
  assert.equal((await startRound('Sofía')).status, 403);
  assert.equal((await setInterval('Ana', 60)).status, 200);
  assert.equal((await view('Tomás')).intervalSeconds, 60);
});

test('the interval accepts ten seconds to a day, or nothing for manual', async () => {
  const { view, setInterval } = setup();
  assert.equal((await view('Ana')).intervalSeconds, null);
  for (const invalid of [5, 86_401, 30.5, '60', true]) assert.equal((await setInterval('Ana', invalid)).status, 400);
  assert.equal((await setInterval('Ana', 10)).status, 200);
  assert.equal((await view('Ana')).intervalSeconds, 10);
  assert.equal((await setInterval('Ana', null)).status, 200);
  assert.equal((await view('Ana')).intervalSeconds, null);
});

test('with an interval, a round starts by itself only when someone published something new', async () => {
  const { ctx, tokenOf, prompts } = setup();
  const start = new Date();
  const later = (seconds: number) => new Date(start.getTime() + seconds * 1000);

  assert.equal(runMesaTick(ctx, start).outcome, 'manual');
  ctx.mesa.setIntervalSeconds(60);

  const first = runMesaTick(ctx, start);
  assert.equal(first.outcome, 'iniciada');
  await first.done;
  assert.ok(prompts.length > 0, 'sin pedidos, los agentes conversan igual');
  const chatted = prompts.length;

  assert.equal(runMesaTick(ctx, later(10)).outcome, 'esperando');
  assert.equal(runMesaTick(ctx, later(61)).outcome, 'sin_novedad');

  ctx.agents.decideTopic(tokenOf('Ana'), TOPIC, true);
  assert.equal(runMesaTick(ctx, later(30)).outcome, 'esperando');
  const second = runMesaTick(ctx, later(62));
  assert.equal(second.outcome, 'iniciada');
  await second.done;
  assert.equal(prompts.length, chatted + 3);
  assert.equal(ctx.agents.latestRound(MESA_TEAM_ID)?.status, 'lista');

  assert.equal(runMesaTick(ctx, later(200)).outcome, 'sin_novedad');
  assert.equal(prompts.length, chatted + 3);
});

test('automatic rounds stop at the daily token cap, and a round already running is never doubled', async () => {
  const capped = setup({ config: { publicBaseUrl: null, oauth: {}, mesaDailyTokenCap: 300 } });
  capped.ctx.agents.decideTopic(capped.tokenOf('Ana'), TOPIC, true);
  assert.equal((await capped.startRound('Ana')).status, 202);
  await capped.settled('Ana');
  capped.ctx.mesa.setIntervalSeconds(10);
  capped.ctx.agents.decideTopic(capped.tokenOf('Ana'), 'otro tema', true);
  capped.ctx.mesa.saveFingerprint('otra huella');
  assert.equal(runMesaTick(capped.ctx, new Date(Date.now() + 60_000)).outcome, 'tope');

  let release = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const slow: AgentModel = {
    async decide<Schema extends z.ZodType>(request: AgentRequest<Schema>): Promise<z.infer<Schema>> {
      await hold;
      return request.schema.parse({ contacts: [] });
    },
  };
  const busy = setup({ model: slow });
  busy.ctx.agents.decideTopic(busy.tokenOf('Ana'), TOPIC, true);
  assert.equal((await busy.startRound('Ana')).status, 202);
  assert.equal((await busy.startRound('Ana')).status, 409);
  busy.ctx.mesa.setIntervalSeconds(10);
  assert.equal(runMesaTick(busy.ctx, new Date(Date.now() + 60_000)).outcome, 'en_curso');
  release();
  await busy.settled('Ana');
});

test('without a model the public table says so and starts nothing', async () => {
  const { ctx, view, startRound } = setup({ model: null });
  assert.equal((await view('Ana')).configured, false);
  assert.equal((await startRound('Ana')).status, 503);
  ctx.mesa.setIntervalSeconds(10);
  assert.equal(runMesaTick(ctx).outcome, 'sin_modelo');
  assert.equal((await createApp(ctx).request('/api/people/nadie/mesa')).status, 404);
});

interface LiveView {
  me: string;
  people: Array<{ id: string; name: string }>;
  round: { id: string; status: string } | null;
  events: Array<{ id: number; type: string; from?: string; to?: string; by?: string; tool?: string; state?: string; topic?: string; help?: string; outcome?: string; text: string | null; calls?: number; tokens?: number }>;
  lastEventId: number;
}

test('the live view streams each step of the round, with the words only for the two people in a conversation', async () => {
  const { ctx, app, people, tokenOf, startRound, settled } = setup();
  const live = async (name: string, since = 0) => (await (await app.request(`/api/people/${tokenOf(name)}/mesa/live?since=${since}`)).json()) as LiveView;

  const idle = await live('Ana');
  assert.equal(idle.people.length, people.length);
  assert.equal(idle.people.find((person) => person.id === idle.me)?.name, 'Ana');
  assert.deepEqual(idle.events, []);

  ctx.agents.decideTopic(tokenOf('Ana'), TOPIC, true);
  assert.equal((await startRound('Ana')).status, 202);
  await settled('Ana');

  const mine = await live('Ana');
  assert.deepEqual(
    mine.events.map((event) => (event.type === 'paso' ? `${event.tool}:${event.state}` : event.type)),
    ['ronda_empieza', 'pedido_busca', 'equipo.consultar:inicio', 'equipo.consultar:fin', 'hilo_abre', 'checkin.consultar:inicio', 'checkin.consultar:fin', 'hilo_responde', 'propuesta.redactar:inicio', 'propuesta.redactar:fin', 'propuesta_nace', 'pedido_cierra', 'ronda_termina'],
  );
  const steps = mine.events.filter((event) => event.type === 'paso');
  assert.deepEqual(steps.map((event) => event.by === mine.me), [true, true, false, false, true, true]);
  const [, search, ask, reply, proposal, close, end] = mine.events.filter((event) => event.type !== 'paso');
  assert.equal(search?.from, mine.me);
  assert.equal(search?.topic, TOPIC);
  assert.equal(ask?.text, 'Ana necesita ayuda con pagos.');
  assert.equal(reply?.text, 'Puede ayudar con eso.');
  assert.equal(reply?.help, 'si');
  assert.equal(proposal?.text, 'Tomás ayuda a Ana con la integración de pagos.');
  assert.equal(close?.outcome, 'propuesta');
  assert.equal(end?.calls, 3);
  assert.equal(end?.tokens, 330);

  const outside = await live('Carla');
  assert.deepEqual(outside.events.map((event) => event.type), mine.events.map((event) => event.type));
  assert.ok(outside.events.every((event) => event.text === null));
  assert.equal(outside.events.find((event) => event.type === 'hilo_abre')?.from, mine.me);

  assert.deepEqual((await live('Ana', mine.lastEventId)).events, []);
  assert.equal((await app.request('/api/people/nadie/mesa/live')).status, 404);
});

test('a need nobody relates to closes saying so, and a second round only streams its own steps', async () => {
  const alone: AgentModel = {
    async decide<Schema extends z.ZodType>(request: AgentRequest<Schema>): Promise<z.infer<Schema>> {
      return request.schema.parse({ contacts: [] });
    },
  };
  const { ctx, app, tokenOf, startRound, settled } = setup({ model: alone });
  const live = async () => (await (await app.request(`/api/people/${tokenOf('Ana')}/mesa/live`)).json()) as LiveView;
  ctx.agents.decideTopic(tokenOf('Ana'), TOPIC, true);

  assert.equal((await startRound('Ana')).status, 202);
  await settled('Ana');
  const first = await live();
  assert.deepEqual(first.events.map((event) => event.type), ['ronda_empieza', 'pedido_busca', 'paso', 'paso', 'pedido_cierra', 'ronda_termina']);
  assert.equal(first.events.find((event) => event.type === 'pedido_cierra')?.outcome, 'nadie');

  assert.equal((await startRound('Ana')).status, 202);
  await settled('Ana');
  const second = await live();
  assert.equal(second.events.length, first.events.length);
  assert.ok((second.events[0]?.id ?? 0) > first.lastEventId);
});

test('while the model writes, the live view carries the words to the two people in the conversation and only the length to the rest', async () => {
  let release = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const writing: AgentModel = {
    async decide<Schema extends z.ZodType>(request: AgentRequest<Schema>): Promise<z.infer<Schema>> {
      const schema: z.ZodType = request.schema;
      if (schema === ContactPlan) {
        request.onText?.('{"contacts":[{"teammate":"p1","message":"Ana necesita');
        await hold;
        return request.schema.parse({ contacts: [{ teammate: 'p1', message: 'Ana necesita ayuda con pagos.' }] });
      }
      if (schema === HelpReply) return request.schema.parse({ help: 'si', message: 'Puede ayudar con eso.' });
      return request.schema.parse({ helpers: ['p1'], text: 'Tomás ayuda a Ana con la integración de pagos.' });
    },
  };
  const { ctx, app, tokenOf, startRound, settled } = setup({ model: writing });
  const live = async (name: string) =>
    (await (await app.request(`/api/people/${tokenOf(name)}/mesa/live`)).json()) as LiveView & { streams: Array<{ kind: string; from: string; to: string; chars: number; text: string | null }> };
  ctx.agents.decideTopic(tokenOf('Ana'), TOPIC, true);
  assert.equal((await startRound('Ana')).status, 202);

  const asker = await live('Ana');
  assert.equal(asker.streams.length, 1);
  assert.equal(asker.streams[0]?.kind, 'ask');
  assert.equal(asker.streams[0]?.from, asker.me);
  assert.equal(asker.streams[0]?.text, 'Ana necesita');
  const helper = await live('Tomás');
  assert.equal(helper.streams[0]?.to, helper.me);
  assert.equal(helper.streams[0]?.text, 'Ana necesita');
  const outsider = await live('Carla');
  assert.equal(outsider.streams[0]?.text, null);
  assert.equal(outsider.streams[0]?.chars, 'Ana necesita'.length);

  release();
  await settled('Ana');
  assert.deepEqual((await live('Ana')).streams, []);
});
