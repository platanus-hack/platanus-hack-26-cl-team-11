import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as z from 'zod/v4';
import { cardDepsFrom, roundDepsFrom } from '../src/agents/deps.js';
import { estimateRound } from '../src/agents/estimate.js';
import type { AgentModel, AgentRequest, ModelUsage } from '../src/agents/model.js';
import { ContactPlan, HelpReply, MAX_CONTACTS, ProposalDraft } from '../src/agents/prompts.js';
import { runRound } from '../src/agents/round.js';
import { createContext } from '../src/context.js';
import { seedDemo } from '../src/seed.js';

const TOPIC = 'integración de pagos';

function fakeModel(spent?: ModelUsage) {
  const model: AgentModel = {
    async decide<Schema extends z.ZodType>(request: AgentRequest<Schema>): Promise<z.infer<Schema>> {
      if (spent) request.onUsage?.(spent);
      const schema: z.ZodType = request.schema;
      if (schema === ContactPlan) return request.schema.parse({ contacts: [{ teammate: 'p1', message: 'Ana necesita ayuda con pagos.' }] });
      if (schema === HelpReply) return request.schema.parse({ help: 'si', message: 'Puede ayudar con eso.' });
      if (schema === ProposalDraft) return request.schema.parse({ helpers: ['p1'], text: 'Tomás ayuda a Ana con la integración de pagos.' });
      throw new Error('Unexpected schema.');
    },
  };
  return model;
}

function setup(model: AgentModel) {
  const ctx = createContext({ location: ':memory:', model });
  const people = seedDemo(ctx);
  const team = ctx.teams.createTeam('Producto');
  for (const person of people) ctx.teams.addMember(team.id, person.token);
  const ana = people.find((person) => person.name === 'Ana')?.token ?? '';
  return { ctx, team, people, ana };
}

test('with nothing to ask, a round is estimated at zero tokens', () => {
  const { ctx, team, people } = setup(fakeModel());
  const estimate = estimateRound(cardDepsFrom(ctx), team.id);
  assert.equal(estimate.people, people.length);
  assert.equal(estimate.needs, 0);
  assert.deepEqual(estimate.calls, { min: 0, likely: 0, max: 0 });
  assert.equal(estimate.tokens.total, 0);
});

test('an open need is estimated before the round, and the round lands inside the estimate', async () => {
  const model = fakeModel();
  const { ctx, team, ana } = setup(model);
  ctx.agents.decideTopic(ana, TOPIC, true);

  const estimate = estimateRound(cardDepsFrom(ctx), team.id);
  assert.equal(estimate.needs, 1);
  assert.equal(estimate.measured, false);
  assert.deepEqual(estimate.calls, { min: 1, likely: 4, max: 2 + MAX_CONTACTS });
  assert.ok(estimate.tokens.input > 0 && estimate.tokens.output > 0);
  assert.equal(estimate.tokens.total, estimate.tokens.input + estimate.tokens.output);
  assert.ok(estimate.tokens.max >= estimate.tokens.total);

  const round = ctx.agents.startRound(team.id, null);
  assert.ok(round);
  await runRound(roundDepsFrom(ctx, model), round);
  const spent = ctx.agents.usageOfRound(round.id);
  assert.ok(spent);
  assert.ok(spent.calls >= estimate.calls.min && spent.calls <= estimate.calls.max);
  assert.ok(spent.inputTokens + spent.outputTokens <= estimate.tokens.max);

  assert.equal(estimateRound(cardDepsFrom(ctx), team.id).needs, 0);
});

test('measured rounds replace the default guesses: tokens per character, output per call and calls per need', async () => {
  const model = fakeModel({ inputTokens: 1000, outputTokens: 40, measured: true });
  const first = setup(model);
  first.ctx.agents.decideTopic(first.ana, TOPIC, true);
  const guessed = estimateRound(cardDepsFrom(first.ctx), first.team.id);

  const round = first.ctx.agents.startRound(first.team.id, null);
  assert.ok(round);
  await runRound(roundDepsFrom(first.ctx, model), round);

  const second = first.ctx.teams.createTeam('Soporte');
  for (const member of first.people) first.ctx.teams.addMember(second.id, member.token);
  const measured = estimateRound(cardDepsFrom(first.ctx), second.id);
  assert.equal(measured.measured, true);
  assert.equal(measured.needs, 1);
  assert.equal(measured.calls.likely, 3);
  assert.equal(measured.tokens.output, 3 * 40);
  assert.notEqual(measured.tokens.input, guessed.tokens.input);
});
