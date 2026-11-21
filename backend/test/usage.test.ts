import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as z from 'zod/v4';
import { roundDepsFrom } from '../src/agents/deps.js';
import type { AgentModel, AgentRequest, ModelUsage } from '../src/agents/model.js';
import { ContactPlan, HelpReply, ProposalDraft } from '../src/agents/prompts.js';
import { runRound } from '../src/agents/round.js';
import { createContext } from '../src/context.js';
import { seedDemo } from '../src/seed.js';

const TOPIC = 'integración de pagos';
const LONG_AGO = '2000-01-01T00:00:00.000Z';

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

async function roundWith(model: AgentModel) {
  const ctx = createContext({ location: ':memory:', model });
  const people = seedDemo(ctx);
  const team = ctx.teams.createTeam('Producto');
  for (const person of people) ctx.teams.addMember(team.id, person.token);
  ctx.agents.decideTopic(people.find((person) => person.name === 'Ana')?.token ?? '', TOPIC, true);
  const round = ctx.agents.startRound(team.id, null);
  assert.ok(round);
  await runRound(roundDepsFrom(ctx, model), round);
  return { ctx, team, round };
}

test('a round stores the tokens its model reported: one plan, one reply and one proposal', async () => {
  const { ctx, team, round } = await roundWith(fakeModel({ inputTokens: 100, outputTokens: 10, measured: true }));
  const usage = ctx.agents.usageOfRound(round.id);
  assert.equal(usage?.needs, 1);
  assert.equal(usage?.calls, 3);
  assert.equal(usage?.inputTokens, 300);
  assert.equal(usage?.outputTokens, 30);
  assert.equal(usage?.measured, true);
  assert.ok((usage?.inputChars ?? 0) > 0);

  const sinceEver = ctx.agents.usageSince(team.id, LONG_AGO);
  assert.equal(sinceEver.rounds, 1);
  assert.equal(sinceEver.inputTokens + sinceEver.outputTokens, 330);
  assert.equal(ctx.agents.usageSince(team.id, '2999-01-01T00:00:00.000Z').rounds, 0);
  assert.equal(ctx.agents.measuredUsage().calls, 3);
});

test('a model that reports nothing is still counted, by characters, and marked as not measured', async () => {
  const { ctx, round } = await roundWith(fakeModel());
  const usage = ctx.agents.usageOfRound(round.id);
  assert.equal(usage?.calls, 3);
  assert.equal(usage?.measured, false);
  assert.ok((usage?.inputTokens ?? 0) > 0);
  assert.ok((usage?.outputTokens ?? 0) > 0);
  assert.equal(ctx.agents.measuredUsage().rounds, 0);
});
