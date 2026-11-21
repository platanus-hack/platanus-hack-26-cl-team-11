import * as z from 'zod/v4';
import type { Fetch } from '../types.js';
import { AgentModelError, approximateTokens, MODEL_FAILURE, type AgentModel, type ModelUsage } from './model.js';

export const FIFTYX_BASE_URL = 'https://api.ai.50x.energy/v1';
export const FIFTYX_MODEL = 'deepseek-ai/DeepSeek-V4.1-Flash-1017';
export const FIFTYX_MAX_PARALLEL_CALLS = 4;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;
const MAX_OUTPUT_TOKENS = 8000;
const SCHEMA_NAME = 'respuesta';
const BAD_REQUEST = 400;
const TOO_MANY_REQUESTS = 429;
const REJECTED_CREDENTIALS = new Set([401, 403]);
const LOGGED_BODY_CHARS = 300;
const STREAM_RETRY_MS = 10 * 60 * 1000;
const STREAM_DATA = 'data:';
const STREAM_END = '[DONE]';
const TRAILING_SLASHES = /\/+$/;
const CODE_FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/;

export interface FiftyXConfig {
  apiKey: string;
  baseURL: string;
}

type ResponseFormat = { type: 'json_object' } | { type: 'json_schema'; json_schema: { name: string; strict: true; schema: unknown } };

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function fiftyXConfigFrom(env: NodeJS.ProcessEnv): FiftyXConfig | null {
  const apiKey = env.FIFTYX_API_KEY || undefined;
  if (!apiKey) return null;
  return { apiKey, baseURL: (env.FIFTYX_BASE_URL || FIFTYX_BASE_URL).replace(TRAILING_SLASHES, '') };
}

export const jsonSchemaOf = (schema: z.ZodType): Record<string, unknown> => {
  const { $schema: _dialect, ...shape } = z.toJSONSchema(schema) as Record<string, unknown>;
  return shape;
};

export function createLimiter(maxActive: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async <Result>(work: () => Promise<Result>): Promise<Result> => {
    if (active >= maxActive) await new Promise<void>((resume) => waiting.push(resume));
    else active += 1;
    try {
      return await work();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active -= 1;
    }
  };
}

const readJson = (text: string): unknown => {
  const trimmed = text.trim();
  const unfenced = CODE_FENCE.exec(trimmed)?.[1] ?? trimmed;
  try {
    return JSON.parse(unfenced) as unknown;
  } catch {
    return undefined;
  }
};

const failureOfStatus = (status: number): string =>
  REJECTED_CREDENTIALS.has(status) ? MODEL_FAILURE.credentials : status === TOO_MANY_REQUESTS ? MODEL_FAILURE.busy : MODEL_FAILURE.status(status);

const failureOfThrown = (failure: unknown): string =>
  failure instanceof DOMException && failure.name === 'TimeoutError' ? MODEL_FAILURE.silent : MODEL_FAILURE.unreachable;

const contentOf = (body: unknown): string => {
  const choices = (body as { choices?: Array<{ message?: { content?: unknown } }> } | null)?.choices;
  const content = choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
};

const usageOf = (body: unknown, messages: ChatMessage[], content: string): ModelUsage => {
  const usage = (body as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } } | null)?.usage;
  const input = usage?.prompt_tokens;
  const output = usage?.completion_tokens;
  if (typeof input === 'number' && typeof output === 'number') return { inputTokens: input, outputTokens: output, measured: true };
  return { inputTokens: approximateTokens(messages.map((message) => message.content).join('')), outputTokens: approximateTokens(content), measured: false };
};

export function createFiftyXModel(config: FiftyXConfig, fetchImpl: Fetch = fetch): AgentModel {
  const limit = createLimiter(FIFTYX_MAX_PARALLEL_CALLS);
  let acceptsJsonSchema = true;
  let warnedAboutModel = false;

  let streamsAgainAt = 0;

  const send = (messages: ChatMessage[], responseFormat: ResponseFormat, streaming = false) =>
    fetchImpl(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: FIFTYX_MODEL,
        messages,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: responseFormat,
        ...(streaming ? { stream: true, stream_options: { include_usage: true } } : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

  const formatFor = (jsonSchema: unknown): ResponseFormat =>
    acceptsJsonSchema ? { type: 'json_schema', json_schema: { name: SCHEMA_NAME, strict: true, schema: jsonSchema } } : { type: 'json_object' };

  const streamed = async (messages: ChatMessage[], jsonSchema: unknown, onText: (written: string) => void, onUsage?: (usage: ModelUsage) => void): Promise<string | null> => {
    if (Date.now() < streamsAgainAt) return null;
    const giveUp = () => {
      streamsAgainAt = Date.now() + STREAM_RETRY_MS;
      return null;
    };
    let response: Response;
    try {
      response = await send(messages, formatFor(jsonSchema), true);
    } catch {
      return null;
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel().catch(() => undefined);
      return giveUp();
    }
    let written = '';
    let pending = '';
    let usage: unknown = null;
    const decoder = new TextDecoder();
    try {
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        for (const line of lines) {
          const data = line.trim();
          if (!data.startsWith(STREAM_DATA)) continue;
          const body = data.slice(STREAM_DATA.length).trim();
          if (body === STREAM_END) continue;
          const part = readJson(body) as { usage?: unknown; choices?: Array<{ delta?: { content?: unknown } }> } | undefined;
          if (part?.usage) usage = part;
          const piece = part?.choices?.[0]?.delta?.content;
          if (typeof piece !== 'string' || !piece) continue;
          written += piece;
          onText(written);
        }
      }
    } catch {
      return null;
    }
    if (!written.trim()) return giveUp();
    onUsage?.(usageOf(usage, messages, written));
    return written;
  };

  const complete = async (messages: ChatMessage[], jsonSchema: unknown, onUsage?: (usage: ModelUsage) => void): Promise<string> => {
    let response: Response;
    try {
      response = await send(messages, formatFor(jsonSchema));
      if (acceptsJsonSchema && response.status === BAD_REQUEST) {
        acceptsJsonSchema = false;
        response = await send(messages, { type: 'json_object' });
      }
    } catch (failure) {
      throw new AgentModelError(failureOfThrown(failure));
    }
    if (!response.ok) {
      console.error('50x call failed.', response.status, (await response.text().catch(() => '')).slice(0, LOGGED_BODY_CHARS));
      throw new AgentModelError(failureOfStatus(response.status));
    }
    const body: unknown = await response.json().catch(() => null);
    const servedModel = (body as { model?: unknown } | null)?.model;
    if (typeof servedModel === 'string' && servedModel !== FIFTYX_MODEL && !warnedAboutModel) {
      warnedAboutModel = true;
      console.warn(`50x answered with ${servedModel} instead of ${FIFTYX_MODEL}.`);
    }
    const content = contentOf(body);
    onUsage?.(usageOf(body, messages, content));
    return content;
  };

  return {
    async decide(request) {
      const jsonSchema = jsonSchemaOf(request.schema);
      const system = `${request.system}\n\nResponde solo con un objeto JSON que cumpla este esquema JSON, sin texto antes ni después:\n${JSON.stringify(jsonSchema)}`;
      const messages: ChatMessage[] = [
        { role: 'system', content: system },
        { role: 'user', content: request.prompt },
      ];
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const onText = attempt === 1 ? request.onText : undefined;
        const answer = await limit(async () => (onText ? await streamed(messages, jsonSchema, onText, request.onUsage) : null) ?? (await complete(messages, jsonSchema, request.onUsage)));
        const parsed = request.schema.safeParse(readJson(answer));
        if (parsed.success) return parsed.data;
        messages.push({ role: 'assistant', content: answer }, { role: 'user', content: `Tu respuesta no cumple el esquema:\n${z.prettifyError(parsed.error)}\nResponde de nuevo solo con el objeto JSON.` });
      }
      throw new AgentModelError(MODEL_FAILURE.incomplete);
    },
  };
}
