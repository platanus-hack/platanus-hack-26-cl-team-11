import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as z from 'zod/v4';
import { AssembledAnswer, QuestionAnswer } from '../src/agents/ask.js';
import { RepoDigestAnswer } from '../src/agents/digest.js';
import type { AgentModel, AgentRequest } from '../src/agents/model.js';
import { ContactPlan, HelpReply, ProposalDraft } from '../src/agents/prompts.js';
import { createApp } from '../src/app.js';
import { joinDoc } from '../src/assistants/joinDoc.js';
import { createContext } from '../src/context.js';
import type { ReplyButton, WhatsAppChannel } from '../src/whatsapp/kapso.js';
import { InboundReading } from '../src/whatsapp/reading.js';

const ANA_PHONE = '56911110001';
const TOPIC = 'integración de pagos';
const PROPOSAL = 'Tomás ayuda a Ana con la integración de pagos.';

interface Message {
  id: number;
  text: string;
  options: Array<{ id: string; label: string }>;
}

interface Reading {
  intent: string;
  mood?: string;
  blocker?: string;
  question?: string;
  reply?: string;
}

function fakeModel(readingOf: () => Reading): AgentModel {
  return {
    async decide<Schema extends z.ZodType>(request: AgentRequest<Schema>): Promise<z.infer<Schema>> {
      const schema: z.ZodType = request.schema;
      if (schema === InboundReading) return request.schema.parse({ mood: '', blocker: '', note: '', question: '', reply: '', ...readingOf() });
      if (schema === RepoDigestAnswer) return request.schema.parse({ workingOn: [], needs: [], expertise: ['pagos'] });
      if (schema === ContactPlan) return request.schema.parse({ contacts: [{ teammate: 'p1', message: 'Ana necesita ayuda con pagos.' }] });
      if (schema === HelpReply) return request.schema.parse({ help: 'si', message: 'Puede ayudar con eso.' });
      if (schema === ProposalDraft) return request.schema.parse({ helpers: ['p1'], text: PROPOSAL });
      if (schema === QuestionAnswer) return request.schema.parse({ knows: 'si', answer: 'Tomás integró pagos con Toku en marzo.' });
      if (schema === AssembledAnswer) return request.schema.parse({ answer: 'Tomás ya integró pagos con Toku.', sources: ['r1'] });
      throw new Error('Unexpected schema.');
    },
  };
}

function setup(readingOf: () => Reading, options: { whatsapp?: boolean } = {}) {
  const pushed: Array<{ to: string; body: string; buttons: ReplyButton[] }> = [];
  const channel: WhatsAppChannel = {
    phoneNumberId: '1',
    sendText: async (to, body) => Boolean(pushed.push({ to, body, buttons: [] })),
    sendButtons: async (to, body, buttons) => Boolean(pushed.push({ to, body, buttons })),
    number: async () => '56900000000',
    isSigned: () => true,
  };
  const ctx = createContext({ location: ':memory:', model: fakeModel(readingOf), whatsapp: options.whatsapp === false ? null : channel });
  const app = createApp(ctx);
  const ana = ctx.store.addPerson('Ana');
  const tomas = ctx.store.addPerson('Tomás');
  const team = ctx.teams.createTeam('Producto');
  for (const member of [ana, tomas]) ctx.teams.addMember(team.id, member.token);
  ctx.repo.commit(tomas.token, { by: 'prueba', message: 'Sabe', topics: [], files: [{ path: 'sabe.md', content: 'Integré pagos con Toku.', share: 'siempre' }], remove: [] });
  const redeemed = ctx.assistants.redeem(ctx.assistants.createPairing(ana.token).code, 'claude-code', 'Claude Code');
  const token = redeemed.state === 'vigente' ? redeemed.token : '';
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const post = async <Body>(path: string, body: unknown) => (await (await app.request(`/api${path}`, { method: 'POST', headers, body: JSON.stringify(body) })).json()) as Body;
  const inbox = async () => (await (await app.request('/api/agent/inbox', { headers })).json()) as { pending: Message[]; recent: Message[] };
  const until = async (ready: () => Promise<boolean> | boolean) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (await ready()) return;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error('It never happened.');
  };
  return { ctx, app, ana, tomas, pushed, headers, post, inbox, until };
}

test('a check-in said through the assistant works like on WhatsApp, and its replies do not buzz the phone', async () => {
  const { ctx, ana, pushed, post, inbox, until } = setup(() => ({ intent: 'checkin', mood: 'cansada', blocker: TOPIC, reply: 'Anotado.' }));
  const started = await ctx.whatsapp.startLink(ana.token);
  await ctx.whatsapp.receive({ message: { type: 'text', from: ANA_PHONE, text: { body: `mi código es ${started?.code ?? ''}` } }, phone_number_id: '1' });
  const pushedByLinking = pushed.length;
  assert.ok(pushedByLinking >= 1);

  const said = await post<{ replies: Message[]; pending: Message[] }>('/agent/say', { text: 'vengo cansada, estoy pegada con la integración de pagos' });
  assert.match(said.replies[0]?.text ?? '', /^Anotado\./);
  assert.deepEqual(said.pending.map((item) => item.options.map((option) => option.label)), [['Permitir', 'No contar']]);
  assert.equal(pushed.length, pushedByLinking);
  assert.equal(ctx.store.listEvents(ana.token).find((event) => event.source === 'checkin')?.summary, 'Check-in: cansada · con un bloqueo');

  const allow = said.pending[0]?.options.find((option) => option.label === 'Permitir')?.id ?? '';
  const answered = await post<{ replies: Message[]; pending: Message[] }>('/agent/answer', { option: allow });
  assert.equal(answered.replies[0]?.text, 'Listo. Tu agente ya está conversando con los de tu equipo.');
  assert.deepEqual(answered.pending, []);

  await until(async () => (await inbox()).pending.some((item) => item.text.includes(PROPOSAL)));
  const offer = (await inbox()).pending[0];
  assert.deepEqual(offer?.options.map((option) => option.label), ['Aceptar', 'Ahora no']);
  assert.ok(pushed.some((message) => message.to === ANA_PHONE && message.body.includes(PROPOSAL)));

  const accepted = await post<{ replies: Message[] }>('/agent/answer', { option: offer?.options[0]?.id });
  assert.equal(accepted.replies[0]?.text, 'Anotado. Te aviso cuando acepten todos.');
  const again = await post<{ replies: Message[] }>('/agent/answer', { option: offer?.options[0]?.id });
  assert.equal(again.replies[0]?.text, 'Eso ya lo respondiste.');
});

test('a question asked through the assistant comes back answered in the same call, without WhatsApp configured', async () => {
  const { post } = setup(() => ({ intent: 'pregunta', question: '¿Alguien ya integró pagos con Toku?' }), { whatsapp: false });
  const said = await post<{ replies: Message[] }>('/agent/say', { text: 'alguien ya integró pagos con toku?' });
  assert.deepEqual(said.replies.map((reply) => reply.text), [
    'Le pregunto a los agentes de Producto. Te aviso cuando respondan.',
    'Tomás ya integró pagos con Toku.\n\nArmada con lo que comparte Tomás.',
  ]);
});

test('the same three actions are MCP tools, and only for an assistant that is still connected', async () => {
  const { app, headers } = setup(() => ({ intent: 'otro', reply: 'Hola. Puedes contarme cómo vienes.' }));
  const rpc = async (body: unknown, auth = headers) => app.request('/api/mcp', { method: 'POST', headers: auth, body: JSON.stringify(body) });
  const result = async <Result>(body: unknown) => ((await (await rpc(body)).json()) as { result: Result }).result;

  assert.equal((await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize' }, { ...headers, authorization: 'Bearer rda_falso' })).status, 401);
  const opened = await result<{ capabilities: { tools: object }; serverInfo: { name: string } }>({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  assert.equal(opened.serverInfo.name, 'ronda');
  assert.equal((await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);

  const listed = await result<{ tools: Array<{ name: string }> }>({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(listed.tools.map((tool) => tool.name), ['ronda_decir', 'ronda_pendientes', 'ronda_responder']);

  const said = await result<{ content: Array<{ text: string }> }>({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ronda_decir', arguments: { mensaje: 'hola' } } });
  assert.equal(said.content[0]?.text, 'Hola. Puedes contarme cómo vienes.');
  const pending = await result<{ content: Array<{ text: string }> }>({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'ronda_pendientes', arguments: {} } });
  assert.match(pending.content[0]?.text ?? '', /^Pendientes:\nSin novedades\.\n\nÚltimos mensajes:\nHola\./);

  const unknown = (await (await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'otra', arguments: {} } })).json()) as { error: { code: number } };
  assert.equal(unknown.error.code, -32602);
  assert.equal((await app.request('/api/agent/inbox')).status, 401);
});

test('the join document tells the assistant how to talk to the agent and never to choose for its owner', () => {
  const doc = joinDoc({ baseUrl: 'https://ronda.test', code: 'ABCD2345', ownerName: 'Ana', expiresAt: '2026-11-21T20:00:00.000Z' });
  assert.ok(doc.includes('https://ronda.test/api/agent/say'));
  assert.ok(doc.includes('claude mcp add --transport http ronda https://ronda.test/api/mcp --header "Authorization: Bearer <token>"'));
  assert.ok(doc.includes('Never choose for Ana'));
});
