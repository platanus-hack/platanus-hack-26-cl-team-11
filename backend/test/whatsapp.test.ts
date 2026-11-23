import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type * as z from 'zod/v4';
import { AssembledAnswer, QuestionAnswer } from '../src/agents/ask.js';
import { RepoDigestAnswer } from '../src/agents/digest.js';
import type { AgentModel, AgentRequest } from '../src/agents/model.js';
import { ContactPlan, HelpReply, ProposalDraft } from '../src/agents/prompts.js';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';
import { createKapsoChannel, type ReplyButton, type WhatsAppChannel } from '../src/whatsapp/kapso.js';
import { InboundReading } from '../src/whatsapp/reading.js';

const ANA_PHONE = '56911110001';
const TOMAS_PHONE = '56911110002';
const NUMBER_ID = '1234567890';
const TOPIC = 'integración de pagos';
const PROPOSAL = 'Tomás ayuda a Ana con la integración de pagos.';
const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

interface Sent {
  to: string;
  body: string;
  buttons: ReplyButton[];
}

interface Reading {
  intent: string;
  mood?: string;
  blocker?: string;
  note?: string;
  question?: string;
  reply?: string;
}

function fakeChannel() {
  const sent: Sent[] = [];
  const channel: WhatsAppChannel = {
    phoneNumberId: NUMBER_ID,
    sendText: async (to, body) => Boolean(sent.push({ to, body, buttons: [] })),
    sendButtons: async (to, body, buttons) => Boolean(sent.push({ to, body, buttons })),
    number: async () => '56900000000',
    isSigned: (_rawBody, signature) => signature === 'firmado',
  };
  return { channel, sent };
}

function fakeModel(readingOf: (message: string) => Reading) {
  const prompts: string[] = [];
  const model: AgentModel = {
    async decide<Schema extends z.ZodType>(request: AgentRequest<Schema>): Promise<z.infer<Schema>> {
      prompts.push(`${request.system}\n${request.prompt}`);
      const schema: z.ZodType = request.schema;
      if (schema === InboundReading) return request.schema.parse({ mood: 'normal', blocker: '', note: '', question: '', reply: '', ...readingOf(request.prompt) });
      if (schema === RepoDigestAnswer) return request.schema.parse({ workingOn: [], needs: [], expertise: ['pagos'] });
      if (schema === ContactPlan) return request.schema.parse({ contacts: [{ teammate: 'p1', message: 'Ana necesita ayuda con pagos.' }] });
      if (schema === HelpReply) return request.schema.parse({ help: 'si', message: 'Puede ayudar con eso.' });
      if (schema === ProposalDraft) return request.schema.parse({ helpers: ['p1'], text: PROPOSAL });
      if (schema === QuestionAnswer) return request.schema.parse({ knows: 'si', answer: 'Tomás integró pagos con Toku en marzo.' });
      if (schema === AssembledAnswer) return request.schema.parse({ answer: 'Tomás ya integró pagos con Toku.', sources: ['r1'] });
      throw new Error('Unexpected schema.');
    },
  };
  return { model, prompts };
}

function setup(readingOf: ((message: string) => Reading) | null = () => ({ intent: 'otro', reply: 'Hola.' })) {
  const { channel, sent } = fakeChannel();
  const fake = readingOf ? fakeModel(readingOf) : null;
  const ctx = createContext({ location: ':memory:', model: fake?.model ?? null, whatsapp: channel });
  const app = createApp(ctx);
  const ana = ctx.store.addPerson('Ana');
  const tomas = ctx.store.addPerson('Tomás');
  const team = ctx.teams.createTeam('Producto');
  for (const member of [ana, tomas]) ctx.teams.addMember(team.id, member.token);
  ctx.repo.commit(tomas.token, { by: 'prueba', message: 'Sabe', topics: [], files: [{ path: 'sabe.md', content: 'Integré pagos con Toku.', share: 'siempre' }], remove: [] });

  let deliveries = 0;
  const webhook = (payload: unknown, headers: Record<string, string> = {}) => {
    deliveries += 1;
    return app.request('/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-webhook-signature': 'firmado', 'x-webhook-event': 'whatsapp.message.received', 'x-idempotency-key': `entrega-${deliveries}`, ...headers },
      body: JSON.stringify(payload),
    });
  };
  const textFrom = (phone: string, body: string) => ({ message: { id: 'wamid.1', type: 'text', from: phone, text: { body }, kapso: { direction: 'inbound' } }, phone_number_id: NUMBER_ID });
  const buttonFrom = (phone: string, id: string) => ({
    message: { id: 'wamid.2', type: 'interactive', from: phone, interactive: { type: 'button_reply', button_reply: { id, title: 'x' } }, kapso: { direction: 'inbound' } },
    phone_number_id: NUMBER_ID,
  });
  const until = async (ready: () => boolean) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (ready()) return;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error('It never happened.');
  };
  const say = async (phone: string, body: string) => {
    const before = sent.length;
    assert.equal((await webhook(textFrom(phone, body))).status, 200);
    await until(() => sent.length > before);
  };
  const press = async (phone: string, id: string) => {
    const before = sent.length;
    assert.equal((await webhook(buttonFrom(phone, id))).status, 200);
    await until(() => sent.length > before);
  };
  const link = async (personToken: string, phone: string) => {
    const started = (await (await app.request(`/api/people/${personToken}/whatsapp/link`, json({}))).json()) as { code: string; url: string | null };
    await say(phone, `Hola Montu, mi código es ${started.code}`);
    return started;
  };
  const status = async (personToken: string) => (await (await app.request(`/api/people/${personToken}/whatsapp`)).json()) as { configured: boolean; linked: boolean; phoneEnding: string | null };
  const buttonOf = (message: Sent | undefined, title: string) => message?.buttons.find((button) => button.title === title)?.id ?? '';
  return { ctx, app, team, ana, tomas, sent, prompts: fake?.prompts ?? [], webhook, textFrom, say, press, link, status, until, buttonOf };
}

test('a person links their phone with a code and an unknown phone is told how to link, once', async () => {
  const { ana, sent, link, status, say, webhook, textFrom } = setup();
  assert.deepEqual(await status(ana.token), { configured: true, linked: false, phoneEnding: null });

  await say('56999999999', 'hola');
  assert.match(sent[0]?.body ?? '', /Conectar WhatsApp/);
  assert.equal((await webhook(textFrom('56999999999', 'hola de nuevo'))).status, 200);

  const started = await link(ana.token, ANA_PHONE);
  assert.match(started.url ?? '', /^https:\/\/wa\.me\/56900000000\?text=/);
  assert.deepEqual(await status(ana.token), { configured: true, linked: true, phoneEnding: '0001' });
  assert.equal(sent.length, 2);
  assert.deepEqual({ to: sent[1]?.to, greets: sent[1]?.body.startsWith('Listo, Ana.') }, { to: ANA_PHONE, greets: true });

  await say('56988888888', `mi código es ${started.code}`);
  assert.match(sent[2]?.body ?? '', /Conectar WhatsApp/);
});

test('the webhook refuses an unsigned call, ignores other events and handles a repeated delivery once', async () => {
  const { ana, sent, link, webhook, textFrom, until } = setup();
  await link(ana.token, ANA_PHONE);
  const before = sent.length;

  assert.equal((await webhook(textFrom(ANA_PHONE, 'hola'), { 'x-webhook-signature': 'otra' })).status, 401);
  assert.equal((await webhook(textFrom(ANA_PHONE, 'hola'), { 'x-webhook-event': 'whatsapp.message.sent' })).status, 200);
  assert.equal((await webhook({ ...textFrom(ANA_PHONE, 'hola'), phone_number_id: 'otro-número' })).status, 200);
  assert.equal((await webhook(textFrom(ANA_PHONE, 'hola'), { 'x-idempotency-key': 'repetida' })).status, 200);
  assert.equal((await webhook(textFrom(ANA_PHONE, 'hola'), { 'x-idempotency-key': 'repetida' })).status, 200);
  await until(() => sent.length > before);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(sent.length, before + 1);
});

test('a check-in by WhatsApp stays private, the agent asks before telling a blocker, and a yes starts a round that ends in an introduction', async () => {
  const { ctx, ana, tomas, sent, prompts, link, say, press, until, buttonOf } = setup(() => ({
    intent: 'checkin',
    mood: 'cansada',
    blocker: TOPIC,
    note: 'Lleva dos días trabada con los pagos.',
    reply: 'Anotado, vienes cansada.',
  }));
  await link(ana.token, ANA_PHONE);
  await link(tomas.token, TOMAS_PHONE);
  const before = sent.length;

  await say(ANA_PHONE, 'vengo cansada, llevo dos días pegada con la integración de pagos');
  await until(() => sent.length >= before + 2);
  assert.match(sent[before]?.body ?? '', /^Anotado, vienes cansada\.\nPor tus fuentes veo: energía baja hoy/);
  const ask = sent[before + 1];
  assert.match(ask?.body ?? '', /«integración de pagos»/);
  assert.deepEqual(ask?.buttons.map((button) => button.title), ['Permitir', 'No contar']);
  const checkin = ctx.store.listEvents(ana.token).find((event) => event.source === 'checkin');
  assert.equal(checkin?.summary, 'Check-in: cansada · con un bloqueo');
  assert.equal(prompts.length, 1);

  await press(ANA_PHONE, buttonOf(ask, 'Permitir'));
  await until(() => sent.filter((message) => message.buttons.some((button) => button.title === 'Aceptar')).length === 2);
  const offers = sent.filter((message) => message.buttons.some((button) => button.title === 'Aceptar'));
  assert.deepEqual(offers.map((offer) => offer.to).sort(), [ANA_PHONE, TOMAS_PHONE]);
  assert.ok(offers.every((offer) => offer.body.includes(PROPOSAL)));
  assert.ok(!prompts.slice(1).join('\n').includes('Lleva dos días trabada'));

  const offerOf = (phone: string) => offers.find((offer) => offer.to === phone);
  await press(ANA_PHONE, buttonOf(offerOf(ANA_PHONE), 'Aceptar'));
  assert.equal(sent.at(-1)?.body, 'Anotado. Te aviso cuando acepten todos.');
  await press(TOMAS_PHONE, buttonOf(offerOf(TOMAS_PHONE), 'Aceptar'));
  await until(() => sent.filter((message) => message.body.startsWith('Quedó acordado entre Ana y Tomás.')).length === 2);
  assert.equal(ctx.agents.proposalsOf(ctx.teams.teamsOf(ana.token)[0]?.id ?? '')[0]?.status, 'acordada');

  await press(ANA_PHONE, buttonOf(offerOf(ANA_PHONE), 'Aceptar'));
  assert.equal(sent.at(-1)?.body, 'Eso ya lo respondiste.');
});

test('a later message that does not say how the person feels keeps the mood of the day and does not repeat what the sources show', async () => {
  const readings: Reading[] = [
    { intent: 'checkin', mood: 'cansada', reply: 'Anotado.' },
    { intent: 'checkin', mood: '', note: 'Avanzó con el informe.', reply: 'Queda anotado.' },
  ];
  const { ctx, ana, sent, link, say } = setup(() => readings.shift() ?? { intent: 'otro' });
  await link(ana.token, ANA_PHONE);
  await say(ANA_PHONE, 'vengo cansada');
  assert.match(sent.at(-1)?.body ?? '', /^Anotado\.\nPor tus fuentes veo: energía baja hoy/);
  await say(ANA_PHONE, 'avancé con el informe');
  assert.equal(sent.at(-1)?.body, 'Queda anotado.');
  const moods = ctx.store.listEvents(ana.token).filter((event) => event.source === 'checkin').map((event) => (event.raw as { mood: string }).mood);
  assert.deepEqual(moods, ['cansada', 'cansada']);
});

test('a no keeps the blocker private and a button from another phone does nothing', async () => {
  const { ctx, ana, tomas, sent, link, say, press, webhook, until, buttonOf } = setup(() => ({ intent: 'checkin', mood: 'mal', blocker: TOPIC, reply: 'Anotado.' }));
  await link(ana.token, ANA_PHONE);
  await link(tomas.token, TOMAS_PHONE);
  const before = sent.length;
  await say(ANA_PHONE, 'estoy trabada con los pagos');
  await until(() => sent.length >= before + 2);
  const ask = sent[before + 1];

  const stolen = { message: { type: 'interactive', from: TOMAS_PHONE, interactive: { type: 'button_reply', button_reply: { id: buttonOf(ask, 'Permitir') } } }, phone_number_id: NUMBER_ID };
  assert.equal((await webhook(stolen)).status, 200);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(ctx.agents.decisionsOf(ana.token).released.size, 0);

  await press(ANA_PHONE, buttonOf(ask, 'No contar'));
  assert.equal(sent.at(-1)?.body, 'Entendido. No lo cuento.');
  assert.equal(ctx.agents.decisionsOf(ana.token).denied.size, 1);
  assert.equal(ctx.agents.latestRound(ctx.teams.teamsOf(ana.token)[0]?.id ?? ''), undefined);
});

test('a question by WhatsApp goes to the board and the assembled answer comes back', async () => {
  const { ana, sent, link, say, until } = setup(() => ({ intent: 'pregunta', question: '¿Alguien ya integró pagos con Toku?' }));
  await link(ana.token, ANA_PHONE);
  const before = sent.length;
  await say(ANA_PHONE, 'alguien ya integró pagos con toku?');
  await until(() => sent.length === before + 2);
  assert.deepEqual(sent.slice(before).map((message) => message.body), [
    'Le pregunto a los agentes de Producto. Te aviso cuando respondan.',
    'Tomás ya integró pagos con Toku.\n\nArmada con lo que comparte Tomás.',
  ]);
});

test('without a model the agent says it cannot read messages, and without Kapso the routes say so', async () => {
  const { ana, sent, link, say } = setup(null);
  await link(ana.token, ANA_PHONE);
  await say(ANA_PHONE, 'hola');
  assert.match(sent.at(-1)?.body ?? '', /falta el modelo/);

  const ctx = createContext({ location: ':memory:', model: null, whatsapp: null });
  const app = createApp(ctx);
  const person = ctx.store.addPerson('Lía');
  assert.deepEqual(await (await app.request(`/api/people/${person.token}/whatsapp`)).json(), { configured: false, linked: false, phoneEnding: null });
  assert.equal((await app.request(`/api/people/${person.token}/whatsapp/link`, json({}))).status, 503);
  assert.equal((await app.request('/api/whatsapp/webhook', json({}))).status, 404);
});

test('the Kapso channel sends text and buttons in its format, retries a busy conversation and checks the signature', async () => {
  const calls: Array<{ url: string; headers: Record<string, string>; body: Record<string, unknown> | null }> = [];
  const statuses = [200, 409, 200, 200];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null });
    const status = statuses[calls.length - 1] ?? 200;
    return new Response(JSON.stringify(calls.length === 4 ? { data: [{ display_phone_number_normalized: '56900000000' }] } : {}), { status });
  }) as typeof fetch;
  const channel = createKapsoChannel({ apiKey: 'llave', phoneNumberId: NUMBER_ID, webhookSecret: 'secreto', number: null }, fakeFetch, 1);

  assert.equal(await channel.sendText(ANA_PHONE, 'Hola'), true);
  assert.equal(calls[0]?.url, `https://api.kapso.ai/meta/whatsapp/v24.0/${NUMBER_ID}/messages`);
  assert.equal(calls[0]?.headers['x-api-key'], 'llave');
  assert.deepEqual(calls[0]?.body, { messaging_product: 'whatsapp', to: ANA_PHONE, type: 'text', text: { body: 'Hola' } });

  assert.equal(await channel.sendButtons(ANA_PHONE, '¿Sí?', [{ id: 'wp1:si', title: 'Permitir' }]), true);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[2]?.body, {
    messaging_product: 'whatsapp',
    to: ANA_PHONE,
    type: 'interactive',
    interactive: { type: 'button', body: { text: '¿Sí?' }, action: { buttons: [{ type: 'reply', reply: { id: 'wp1:si', title: 'Permitir' } }] } },
  });

  assert.equal(await channel.number(), '56900000000');
  assert.equal(await channel.number(), '56900000000');
  assert.equal(calls.length, 4);

  const rawBody = '{"message":{"type":"text"}}';
  const signature = createHmac('sha256', 'secreto').update(rawBody).digest('hex');
  assert.equal(channel.isSigned(rawBody, signature), true);
  assert.equal(channel.isSigned(`${rawBody} `, signature), false);
  assert.equal(channel.isSigned(rawBody, undefined), false);
});

test('saying the same blocker again asks for permission again and reopens it even after an agreed proposal', async () => {
  const { ctx, ana, tomas, sent, link, say, press, until, buttonOf } = setup(() => ({ intent: 'checkin', mood: 'normal', blocker: TOPIC, note: '', reply: 'Anotado.' }));
  await link(ana.token, ANA_PHONE);
  await link(tomas.token, TOMAS_PHONE);
  const asksOf = () => sent.filter((message) => message.to === ANA_PHONE && message.buttons.some((button) => button.title === 'Permitir'));
  const offersOf = (phone: string) => sent.filter((message) => message.to === phone && message.buttons.some((button) => button.title === 'Aceptar'));

  await say(ANA_PHONE, 'estoy pegada con la integración de pagos');
  await until(() => asksOf().length === 1);
  await press(ANA_PHONE, buttonOf(asksOf()[0], 'Permitir'));
  await until(() => offersOf(ANA_PHONE).length === 1 && offersOf(TOMAS_PHONE).length === 1);
  await press(ANA_PHONE, buttonOf(offersOf(ANA_PHONE)[0], 'Aceptar'));
  await press(TOMAS_PHONE, buttonOf(offersOf(TOMAS_PHONE)[0], 'Aceptar'));
  await until(() => ctx.agents.proposalsOf(ctx.teams.teamsOf(ana.token)[0]?.id ?? '')[0]?.status === 'acordada');

  await say(ANA_PHONE, 'sigo pegada con la integración de pagos');
  await until(() => asksOf().length === 2);
  assert.equal(ctx.agents.proposalsOf(ctx.teams.teamsOf(ana.token)[0]?.id ?? '').filter((proposal) => proposal.status === 'acordada').length, 0);
  await press(ANA_PHONE, buttonOf(asksOf()[1], 'Permitir'));
  await until(() => offersOf(ANA_PHONE).length === 2);
});
