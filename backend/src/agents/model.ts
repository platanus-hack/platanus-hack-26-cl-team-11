import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type * as z from 'zod/v4';

export const DEFAULT_AGENT_MODEL = 'claude-opus-5-5';
const MAX_OUTPUT_TOKENS = 16000;
const PROXY_PLACEHOLDER_KEY = 'via-proxy';
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 1;

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  measured: boolean;
}

export interface AgentRequest<Schema extends z.ZodType> {
  system: string;
  prompt: string;
  schema: Schema;
  onUsage?: (usage: ModelUsage) => void;
}

export const APPROXIMATE_CHARS_PER_TOKEN = 3.3;
export const approximateTokens = (text: string): number => Math.ceil(text.length / APPROXIMATE_CHARS_PER_TOKEN);

export interface AgentModel {
  decide<Schema extends z.ZodType>(request: AgentRequest<Schema>): Promise<z.infer<Schema>>;
}

export class AgentModelError extends Error {}

export interface AgentModelConfig {
  apiKey?: string;
  authToken?: string;
  baseURL?: string;
  model: string;
}

export function agentModelConfigFrom(env: NodeJS.ProcessEnv): AgentModelConfig | null {
  const apiKey = env.ANTHROPIC_API_KEY || undefined;
  const authToken = env.ANTHROPIC_AUTH_TOKEN || undefined;
  const baseURL = env.ANTHROPIC_BASE_URL || undefined;
  if (!apiKey && !authToken && !baseURL) return null;
  return { apiKey, authToken, baseURL, model: env.AGENT_MODEL || DEFAULT_AGENT_MODEL };
}

export const MODEL_FAILURE = {
  credentials: 'El modelo rechazó las credenciales del servidor.',
  busy: 'El modelo está recibiendo demasiados pedidos. Prueba en un minuto.',
  unreachable: 'No se pudo conectar con el modelo.',
  silent: 'El modelo no respondió.',
  incomplete: 'El modelo entregó una respuesta incompleta.',
  status: (status: number | undefined) => `El modelo respondió con un error (${status ?? 'sin código'}).`,
} as const;

const describeFailure = (failure: unknown): string => {
  if (failure instanceof Anthropic.AuthenticationError) return MODEL_FAILURE.credentials;
  if (failure instanceof Anthropic.RateLimitError) return MODEL_FAILURE.busy;
  if (failure instanceof Anthropic.APIConnectionError) return MODEL_FAILURE.unreachable;
  if (failure instanceof Anthropic.APIError) return MODEL_FAILURE.status(failure.status);
  return MODEL_FAILURE.silent;
};

export function createClaudeModel(config: AgentModelConfig): AgentModel {
  const client = new Anthropic({
    apiKey: config.apiKey ?? (config.authToken ? null : PROXY_PLACEHOLDER_KEY),
    authToken: config.authToken ?? null,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });

  return {
    async decide(request) {
      let response;
      try {
        response = await client.messages.parse({
          model: config.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: request.system,
          messages: [{ role: 'user', content: request.prompt }],
          output_config: { effort: 'low', format: zodOutputFormat(request.schema) },
        });
      } catch (failure) {
        if (failure instanceof Anthropic.APIError) console.error('Agent model call failed.', failure.status, failure.message);
        throw new AgentModelError(describeFailure(failure));
      }
      request.onUsage?.({ inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, measured: true });
      if (response.stop_reason === 'refusal') throw new AgentModelError('El modelo no quiso responder ese pedido.');
      if (response.stop_reason === 'max_tokens' || response.parsed_output === null) throw new AgentModelError(MODEL_FAILURE.incomplete);
      return response.parsed_output;
    },
  };
}
