import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as z from 'zod/v4';
import { createFiftyXModel, FIFTYX_BASE_URL, FIFTYX_MAX_PARALLEL_CALLS, FIFTYX_MODEL, fiftyXConfigFrom, jsonSchemaOf } from '../src/agents/fiftyx.js';
import { AgentModelError, MODEL_FAILURE } from '../src/agents/model.js';
import type { Fetch } from '../src/types.js';

const Reply = z.object({ help: z.string(), message: z.string() });
const VALID = { help: 'si', message: 'Puede ayudar.' };
const CONFIG = { apiKey: 'test-key', baseURL: FIFTYX_BASE_URL };
const REQUEST = { system: 'Eres un agente.', prompt: 'Decide.', schema: Reply };

interface SentBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  response_format: { type: string; json_schema?: { schema: unknown } };
}

interface Sent {
  url: string;
  authorization: string | null;
  body: SentBody;
}

const completion = (content: string, status = 200) => new Response(JSON.stringify({ model: FIFTYX_MODEL, choices: [{ message: { content } }] }), { status });

function fakeFetch(answers: Array<() => Response | Promise<Response>>) {
  const sent: Sent[] = [];
  const fetchImpl: Fetch = async (input, init) => {
    sent.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization'), body: JSON.parse(String(init?.body)) as SentBody });
    const answer = answers[Math.min(sent.length, answers.length) - 1];
    if (!answer) throw new Error('No answer scripted.');
    return answer();
  };
  return { fetchImpl, sent };
}

const failureOf = async (work: Promise<unknown>) => {
  try {
    await work;
  } catch (failure) {
    assert.ok(failure instanceof AgentModelError);
    return failure.message;
  }
  throw new Error('Expected a model failure.');
};

test('50x is configured only with its key, and the base address can be replaced', () => {
  assert.equal(fiftyXConfigFrom({}), null);
  assert.deepEqual(fiftyXConfigFrom({ FIFTYX_API_KEY: 'k' }), { apiKey: 'k', baseURL: FIFTYX_BASE_URL });
  assert.deepEqual(fiftyXConfigFrom({ FIFTYX_API_KEY: 'k', FIFTYX_BASE_URL: 'https://example.test/v1/' }), { apiKey: 'k', baseURL: 'https://example.test/v1' });
});

test('a decision asks the exact DeepSeek model for the schema and returns the parsed answer', async () => {
  const { fetchImpl, sent } = fakeFetch([() => completion(JSON.stringify(VALID))]);
  const decision = await createFiftyXModel(CONFIG, fetchImpl).decide(REQUEST);
  assert.deepEqual(decision, VALID);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.url, `${FIFTYX_BASE_URL}/chat/completions`);
  assert.equal(sent[0]?.authorization, 'Bearer test-key');
  assert.equal(sent[0]?.body.model, FIFTYX_MODEL);
  assert.equal(sent[0]?.body.response_format.type, 'json_schema');
  assert.deepEqual(sent[0]?.body.response_format.json_schema?.schema, jsonSchemaOf(Reply));
  assert.match(sent[0]?.body.messages[0]?.content ?? '', /Eres un agente\.[\s\S]*"help"/);
  assert.equal(sent[0]?.body.messages[1]?.content, 'Decide.');
});

test('an answer wrapped in a code fence is still read', async () => {
  const { fetchImpl } = fakeFetch([() => completion(`\`\`\`json\n${JSON.stringify(VALID)}\n\`\`\``)]);
  assert.deepEqual(await createFiftyXModel(CONFIG, fetchImpl).decide(REQUEST), VALID);
});

test('an answer outside the schema is asked again once with the problem, then reported as incomplete', async () => {
  const recovered = fakeFetch([() => completion('{"help":"si"}'), () => completion(JSON.stringify(VALID))]);
  assert.deepEqual(await createFiftyXModel(CONFIG, recovered.fetchImpl).decide(REQUEST), VALID);
  assert.equal(recovered.sent.length, 2);
  assert.equal(recovered.sent[1]?.body.messages.length, 4);
  assert.equal(recovered.sent[1]?.body.messages[2]?.content, '{"help":"si"}');
  assert.match(recovered.sent[1]?.body.messages[3]?.content ?? '', /no cumple el esquema/);

  const stubborn = fakeFetch([() => completion('no es json')]);
  assert.equal(await failureOf(createFiftyXModel(CONFIG, stubborn.fetchImpl).decide(REQUEST)), MODEL_FAILURE.incomplete);
  assert.equal(stubborn.sent.length, 2);
});

test('when 50x rejects the schema format it falls back to plain JSON and remembers it', async () => {
  const { fetchImpl, sent } = fakeFetch([() => new Response('{"error":"unsupported response_format"}', { status: 400 }), () => completion(JSON.stringify(VALID))]);
  const model = createFiftyXModel(CONFIG, fetchImpl);
  assert.deepEqual(await model.decide(REQUEST), VALID);
  assert.deepEqual(await model.decide(REQUEST), VALID);
  assert.deepEqual(
    sent.map((call) => call.body.response_format.type),
    ['json_schema', 'json_object', 'json_object'],
  );
});

test('rejected credentials, a busy provider, a server error and a dropped connection each get their own message', async () => {
  const failing = (status: number) => createFiftyXModel(CONFIG, fakeFetch([() => new Response('{}', { status })]).fetchImpl).decide(REQUEST);
  assert.equal(await failureOf(failing(401)), MODEL_FAILURE.credentials);
  assert.equal(await failureOf(failing(429)), MODEL_FAILURE.busy);
  assert.equal(await failureOf(failing(503)), MODEL_FAILURE.status(503));
  const dropped: Fetch = async () => {
    throw new TypeError('fetch failed');
  };
  assert.equal(await failureOf(createFiftyXModel(CONFIG, dropped).decide(REQUEST)), MODEL_FAILURE.unreachable);
  const timedOut: Fetch = async () => {
    throw new DOMException('The operation timed out.', 'TimeoutError');
  };
  assert.equal(await failureOf(createFiftyXModel(CONFIG, timedOut).decide(REQUEST)), MODEL_FAILURE.silent);
});

test('no more than four calls reach 50x at the same time', async () => {
  let active = 0;
  let peak = 0;
  const { fetchImpl } = fakeFetch([
    async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return completion(JSON.stringify(VALID));
    },
  ]);
  const model = createFiftyXModel(CONFIG, fetchImpl);
  const decisions = await Promise.all(Array.from({ length: 12 }, () => model.decide(REQUEST)));
  assert.equal(decisions.length, 12);
  assert.equal(peak, FIFTYX_MAX_PARALLEL_CALLS);
});
