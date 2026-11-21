import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as z from 'zod/v4';
import type { AgentModel, AgentRequest } from '../src/agents/model.js';
import { createApp } from '../src/app.js';
import { createContext } from '../src/context.js';
import { InboundReading } from '../src/whatsapp/reading.js';

const post = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const model: AgentModel = {
  async decide<Schema extends z.ZodType>(request: AgentRequest<Schema>): Promise<z.infer<Schema>> {
    assert.equal(request.schema as z.ZodType, InboundReading);
    return request.schema.parse({ intent: 'otro', mood: '', blocker: '', note: '', question: '', reply: 'Hola. Cuéntame cómo viene tu día.' });
  },
};

interface ChatView {
  messages: Array<{ role: string; text: string }>;
  configured: boolean;
  whatsapp: { configured: boolean; linked: boolean };
}

test('el chat web le habla al mismo agente que WhatsApp y muestra la conversación, sin WhatsApp configurado', async () => {
  const ctx = createContext({ location: ':memory:', model, whatsapp: null });
  const { token } = ctx.store.addPerson('Ana');
  const app = createApp(ctx);
  const path = `/api/people/${token}/chat`;

  const empty = (await (await app.request(path)).json()) as ChatView;
  assert.deepEqual(empty.messages, []);
  assert.equal(empty.configured, true);
  assert.deepEqual(empty.whatsapp, { configured: false, linked: false, phoneEnding: null });

  const sent = await app.request(path, post({ text: '  Hola  ' }));
  assert.equal(sent.status, 201);
  const view = (await sent.json()) as ChatView;
  assert.deepEqual(
    view.messages.map((message) => [message.role, message.text]),
    [
      ['persona', 'Hola'],
      ['agente', 'Hola. Cuéntame cómo viene tu día.'],
    ],
  );

  assert.equal((await app.request(path, post({ text: ' ' }))).status, 400);
  assert.equal((await app.request('/api/people/nadie/chat')).status, 404);
});

test('sin modelo, el agente lo dice en el chat', async () => {
  const ctx = createContext({ location: ':memory:', model: null, whatsapp: null });
  const { token } = ctx.store.addPerson('Ana');
  const view = (await (await createApp(ctx).request(`/api/people/${token}/chat`, post({ text: 'Hola' }))).json()) as ChatView;
  assert.equal(view.configured, false);
  assert.equal(view.messages.at(-1)?.role, 'agente');
});
