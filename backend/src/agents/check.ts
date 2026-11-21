import { createContext } from '../context.js';
import { openPolicyStore } from '../policy/store.js';
import { seedDemo } from '../seed.js';
import { cardFor, runRound } from './round.js';

const NOT_CONFIGURED = 'Faltan las credenciales del modelo. Define FIFTYX_API_KEY (o ANTHROPIC_API_KEY o ANTHROPIC_BASE_URL) y vuelve a correr este comando.';

async function main(): Promise<number> {
  const ctx = createContext({ location: ':memory:' });
  if (!ctx.model) {
    console.error(NOT_CONFIGURED);
    return 1;
  }

  const policies = openPolicyStore(ctx.db);
  const deps = { store: ctx.store, teams: ctx.teams, agents: ctx.agents, policies, model: ctx.model };
  const team = ctx.teams.createTeam('Equipo demo');
  const people = seedDemo(ctx);
  for (const person of people) ctx.teams.addMember(team.id, person.token);
  for (const person of people) for (const ask of cardFor(deps, person, new Date()).pendingAsks) ctx.agents.decideTopic(person.token, ask.topic, true);

  const round = ctx.agents.startRound(team.id, null);
  if (!round) return 1;
  console.log('Los agentes están conversando. Puede tardar un minuto.');
  await runRound(deps, round);

  const finished = ctx.agents.latestRound(team.id);
  for (const thread of ctx.agents.threadsOf(round.id)) {
    console.log(`\n${thread.requesterName} → ${thread.helperName} · ${thread.topic} · ${thread.help ?? 'sin respuesta'}`);
    for (const message of thread.messages) console.log(`  Agente de ${message.fromName}: ${message.text}`);
  }
  const proposals = ctx.agents.proposalsOf(team.id);
  console.log(`\nPropuestas: ${proposals.length}`);
  for (const proposal of proposals) console.log(`  ${proposal.text} (${proposal.parties.map((party) => party.name).join(', ')})`);
  console.log(`\nRonda ${finished?.status ?? 'sin estado'}${finished?.problem ? `: ${finished.problem}` : ''}`);
  return finished?.status === 'lista' && !finished.problem ? 0 : 1;
}

process.exitCode = await main();
