import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as z from 'zod/v4';
import { CLAUDE_CLI_MAX_PARALLEL, CLAUDE_CLI_MODEL, claudeCliConfigFrom, createClaudeCliModel, type CliRunner } from '../src/agents/claudeCli.js';
import { jsonSchemaOf } from '../src/agents/fiftyx.js';
import { AgentModelError, MODEL_FAILURE } from '../src/agents/model.js';

const Reply = z.object({ help: z.string(), message: z.string() });
const VALID = { help: 'si', message: 'Puede ayudar.' };
const REQUEST = { system: 'Eres un agente.', prompt: 'Decide.', schema: Reply };
const answered = (structured: unknown, isError = false) => JSON.stringify({ is_error: isError, structured_output: structured });

const failureOf = async (work: Promise<unknown>) => {
  try {
    await work;
  } catch (failure) {
    assert.ok(failure instanceof AgentModelError);
    return failure.message;
  }
  throw new Error('Expected a model failure.');
};

test('the local Claude is used only when asked for, with Sonnet unless another model is named', () => {
  assert.equal(claudeCliConfigFrom({}), null);
  assert.equal(claudeCliConfigFrom({ AGENT_CLI: 'otro' }), null);
  assert.deepEqual(claudeCliConfigFrom({ AGENT_CLI: 'claude' }), { model: CLAUDE_CLI_MODEL });
  assert.deepEqual(claudeCliConfigFrom({ AGENT_CLI: 'claude', AGENT_CLI_MODEL: 'claude-opus-5-5' }), { model: 'claude-opus-5-5' });
});

test('a decision goes to the command line with the schema, no tools and the prompt on standard input', async () => {
  const calls: Array<{ args: string[]; prompt: string }> = [];
  const run: CliRunner = async (args, prompt) => {
    calls.push({ args, prompt });
    return answered(VALID);
  };
  assert.deepEqual(await createClaudeCliModel({ model: CLAUDE_CLI_MODEL }, run).decide(REQUEST), VALID);
  const [call] = calls;
  const valueOf = (flag: string) => call?.args[(call?.args.indexOf(flag) ?? -1) + 1];
  assert.equal(call?.prompt, 'Decide.');
  assert.equal(valueOf('--model'), CLAUDE_CLI_MODEL);
  assert.equal(valueOf('--tools'), '');
  assert.equal(valueOf('--system-prompt'), 'Eres un agente.');
  assert.deepEqual(JSON.parse(valueOf('--json-schema') ?? '{}'), jsonSchemaOf(Reply));
  assert.ok(!(valueOf('--json-schema') ?? '').includes('$schema'));
});

test('an answer outside the schema, an error from the command and a crash each become a model failure', async () => {
  const withRun = (run: CliRunner) => createClaudeCliModel({ model: CLAUDE_CLI_MODEL }, run).decide(REQUEST);
  assert.equal(await failureOf(withRun(async () => answered({ help: 'si' }))), MODEL_FAILURE.incomplete);
  assert.equal(await failureOf(withRun(async () => answered(VALID, true))), MODEL_FAILURE.incomplete);
  assert.equal(await failureOf(withRun(async () => 'no es json')), MODEL_FAILURE.incomplete);
  assert.equal(
    await failureOf(
      withRun(async () => {
        throw new Error('spawn claude ENOENT');
      }),
    ),
    MODEL_FAILURE.silent,
  );
});

test('no more than three commands run at the same time', async () => {
  let active = 0;
  let peak = 0;
  const run: CliRunner = async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return answered(VALID);
  };
  const model = createClaudeCliModel({ model: CLAUDE_CLI_MODEL }, run);
  await Promise.all(Array.from({ length: 9 }, () => model.decide(REQUEST)));
  assert.equal(peak, CLAUDE_CLI_MAX_PARALLEL);
});
