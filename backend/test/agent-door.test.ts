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

test('the three actions and the repo are MCP tools, and only for an assistant that is still connected', async () => {
  const { app, headers } = setup(() => ({ intent: 'otro', reply: 'Hola. Puedes contarme cómo vienes.' }));
  const rpc = async (body: unknown, auth = headers) => app.request('/api/mcp', { method: 'POST', headers: auth, body: JSON.stringify(body) });
  const result = async <Result>(body: unknown) => ((await (await rpc(body)).json()) as { result: Result }).result;

  assert.equal((await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize' }, { ...headers, authorization: 'Bearer rda_falso' })).status, 401);
  const opened = await result<{ capabilities: { tools: object }; serverInfo: { name: string } }>({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  assert.equal(opened.serverInfo.name, 'ronda');
  assert.equal((await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);

  const listed = await result<{ tools: Array<{ name: string }> }>({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(listed.tools.map((tool) => tool.name), ['ronda_contexto', 'ronda_traspaso', 'ronda_decir', 'ronda_pendientes', 'ronda_responder', 'ronda_repo_ver', 'ronda_repo_guardar','ronda_hilos','ronda_hilo','ronda_hilo_publicar','ronda_hilos_novedades']);

  const said = await result<{ content: Array<{ text: string }> }>({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ronda_decir', arguments: { mensaje: 'hola' } } });
  assert.equal(said.content[0]?.text, 'Hola. Puedes contarme cómo vienes.');
  const pending = await result<{ content: Array<{ text: string }> }>({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'ronda_pendientes', arguments: {} } });
  assert.match(pending.content[0]?.text ?? '', /\n\nPendientes:\nSin novedades\.\n\nÚltimos mensajes:\nHola\./);

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

test('a connector made on the page gives a URL and a header, and through MCP the assistant writes and reads the repo', async () => {
  const { ctx, app, ana } = setup(() => ({ intent: 'otro' }), { whatsapp: false });
  const made = (await (await app.request(`/api/people/${ana.token}/assistants/connectors`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'instinct' }) })).json()) as {
    url: string;
    header: string;
    keyUrl: string;
  };
  assert.ok(made.url.endsWith('/api/mcp'));
  const key = made.keyUrl.slice(made.keyUrl.lastIndexOf('/') + 1);
  assert.equal(made.header, `Authorization: Bearer ${key}`);
  assert.ok(ctx.assistants.assistantsOf(ana.token).some((assistant) => assistant.kind === 'instinct'));

  const call = async (path: string, name: string, args: unknown, headers: Record<string, string> = {}) => {
    const response = await app.request(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) });
    return ((await response.json()) as { result: { content: Array<{ text: string }> } }).result.content[0]?.text ?? '';
  };
  const byHeader = { authorization: `Bearer ${key}` };

  assert.equal(await call('/api/mcp', 'ronda_repo_ver', {}, byHeader), 'El repo está vacío.');
  const saved = await call(`/api/mcp/k/${key}`, 'ronda_repo_guardar', { mensaje: 'Primer contexto', temas: ['pagos'], archivos: [{ path: 'ahora.md', content: 'Trabaja en cobros.', share: 'siempre' }] });
  assert.match(saved, /^Guardado\. El repo tiene 1 archivo\./);
  assert.equal(await call('/api/mcp', 'ronda_repo_ver', {}, byHeader), 'ahora.md · siempre · 18 bytes');
  assert.equal(await call('/api/mcp', 'ronda_repo_ver', { ruta: 'ahora.md' }, byHeader), 'Trabaja en cobros.');
  const refused = await call('/api/mcp', 'ronda_repo_guardar', { mensaje: 'Llave', archivos: [{ path: 'llave.md', content: 'sk-abcdefghijklmnopqrstuvwxyz0123' }] }, byHeader);
  assert.match(refused, /^No se guardó nada\./);
  assert.equal((await app.request('/api/mcp/k/rda_inventado', { method: 'POST', body: '{}' })).status, 401);
});

test('the pending tool says what is new since the last time this assistant looked', async () => {
  const { app, headers, post } = setup(() => ({ intent: 'otro', reply: 'Hola.' }), { whatsapp: false });
  const pending = async () => {
    const response = await app.request('/api/mcp', { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ronda_pendientes', arguments: {} } }) });
    return ((await response.json()) as { result: { content: Array<{ text: string }> } }).result.content[0]?.text ?? '';
  };
  await post('/agent/say', { text: 'hola' });
  assert.match(await pending(), /^Nuevo desde la última vez:\nHola\./);
  assert.match(await pending(), /^Nuevo desde la última vez:\nSin novedades\./);
});

test('handoffs follow the private team and connector across clients, with revocation, withdrawal and revision checks', async () => {
  const { ctx, app, ana, tomas, headers, post } = setup(() => ({ intent: 'otro' }), { whatsapp: false });
  const team = ctx.teams.teamsOf(ana.token)[0]!;
  const room = ctx.teams.createTeam('Sala con QR');
  ctx.teams.addMember(room.id, ana.token);
  ctx.rooms.createRoom(room.id);
  const other = ctx.store.addPerson('Otra persona');
  const second = ctx.teams.createTeam('Otro equipo');
  ctx.teams.addMember(second.id, other.token);
  ctx.teams.addMember(second.id, tomas.token);
  const codex = ctx.assistants.connect(tomas.token, 'codex', 'Codex de Tomás')!;
  const chat = ctx.assistants.connect(ana.token, 'chatgpt', 'ChatGPT de Ana')!;
  const rpc = async (token: string, name: string, args = {}) => {
    const response = await app.request('/api/mcp/k/' + token, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) });
    assert.equal(response.status, 200);
    const envelope = await response.json() as { result: { content: Array<{ text: string }>; isError?: boolean } };
    return JSON.parse(envelope.result.content[0]!.text);
  };
  const text = 'La carga está probada. Siguiente paso: revisión de Producto.';
  const write = async (texto: string, revision: number, equipo = team.id) => rpc(codex.token, 'ronda_traspaso', { equipo, texto, revision });
  assert.deepEqual(await write(text, 0), { revision: 1 });
  assert.deepEqual(await write(text, 0), { revision: 1 });
  assert.equal((await write('Otro cambio', 0)).status, 409);
  assert.equal((await write(codex.token, 1)).status, 422);
  assert.equal((await write(text, 0, room.id)).status, 403);
  await post('/agent/say', { text: 'hola' });
  const local = await (await app.request('/api/agent/context', { headers })).json() as { equipos: unknown[] };
  const fromChat = await rpc(chat.token, 'ronda_contexto');
  assert.deepEqual(fromChat.equipos, local.equipos);
  assert.deepEqual(fromChat.equipos.map((entry: { nombre: string }) => entry.nombre), ['Producto']);
  const [note] = fromChat.equipos[0].traspasos;
  assert.equal(note.autor, 'Tomás');
  assert.equal(note.texto, text);
  assert.equal(note.mio, false);
  const own = await rpc(codex.token, 'ronda_contexto');
  assert.equal(own.equipos.find((item: { id: string }) => item.id === team.id).traspasos[0].mio, true);
  assert.equal(own.miBandeja.recent.length, 0);
  assert.equal(fromChat.miBandeja.recent.length, 1);
  for (const secret of [ana.token, tomas.token, codex.token, team.joinCode, room.joinCode]) {
    assert.ok(!JSON.stringify(fromChat).includes(secret));
  }
  const outsider = ctx.assistants.connect(other.token, 'instinct', 'Instinct')!;
  assert.ok(!JSON.stringify(await rpc(outsider.token, 'ronda_contexto')).includes(text));
  assert.equal((await rpc(outsider.token, 'ronda_traspaso', { equipo: team.id, texto: text, revision: 0 })).status, 403);
  assert.deepEqual(await write('', 1), { revision: 2 });
  assert.equal((await rpc(chat.token, 'ronda_contexto')).equipos[0].traspasos.length, 0);
  await write(text, 2);
  ctx.teams.removeMember(team.id, tomas.token);
  assert.ok(!JSON.stringify(await rpc(chat.token, 'ronda_contexto')).includes(text));
  assert.equal((await write(text, 3)).status, 403);
  await rpc(chat.token, 'ronda_traspaso', { equipo: team.id, texto: 'Nota del conector a retirar', revision: 0 });
  ctx.assistants.revoke(ana.token, chat.assistant.id);
  assert.ok(!(await (await app.request('/api/agent/context', { headers })).text()).includes('Nota del conector a retirar'));
  assert.equal((await app.request('/api/agent/context', { headers: { authorization: 'Bearer ' + chat.token } })).status, 401);
  assert.equal((await app.request('/api/agent/context')).status, 401);
});
