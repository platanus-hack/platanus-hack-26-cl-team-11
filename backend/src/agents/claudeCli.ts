import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createLimiter, jsonSchemaOf } from './fiftyx.js';
import { AgentModelError, MODEL_FAILURE, type AgentModel } from './model.js';

export const CLAUDE_CLI_MODEL = 'claude-sonnet-5-5';
export const CLAUDE_CLI_MAX_PARALLEL = 3;
const COMMAND = 'claude';
const TIMEOUT_MS = 90_000;

export interface ClaudeCliConfig {
  model: string;
}

export type CliRunner = (args: string[], prompt: string) => Promise<string>;

export function claudeCliConfigFrom(env: NodeJS.ProcessEnv): ClaudeCliConfig | null {
  return env.AGENT_CLI === COMMAND ? { model: env.AGENT_CLI_MODEL || CLAUDE_CLI_MODEL } : null;
}

const runClaude: CliRunner = (args, prompt) =>
  new Promise((resolve, reject) => {
    const child = spawn(COMMAND, args, { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'ignore'], timeout: TIMEOUT_MS });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(output) : reject(new Error(`claude exited with ${code ?? 'a signal'}`))));
    child.stdin.end(prompt);
  });

const answerOf = (output: string): unknown => {
  try {
    const result = JSON.parse(output) as { is_error?: boolean; structured_output?: unknown };
    return result.is_error ? undefined : result.structured_output;
  } catch {
    return undefined;
  }
};

export function createClaudeCliModel(config: ClaudeCliConfig, run: CliRunner = runClaude): AgentModel {
  const limit = createLimiter(CLAUDE_CLI_MAX_PARALLEL);

  return {
    async decide(request) {
      const args = [
        '-p',
        '--model',
        config.model,
        '--tools',
        '',
        '--strict-mcp-config',
        '--no-session-persistence',
        '--disable-slash-commands',
        '--output-format',
        'json',
        '--json-schema',
        JSON.stringify(jsonSchemaOf(request.schema)),
        '--system-prompt',
        request.system,
      ];
      let output: string;
      try {
        output = await limit(() => run(args, request.prompt));
      } catch (failure) {
        console.error('Claude CLI call failed.', failure instanceof Error ? failure.message : failure);
        throw new AgentModelError(MODEL_FAILURE.silent);
      }
      const parsed = request.schema.safeParse(answerOf(output));
      if (!parsed.success) throw new AgentModelError(MODEL_FAILURE.incomplete);
      return parsed.data;
    },
  };
}
