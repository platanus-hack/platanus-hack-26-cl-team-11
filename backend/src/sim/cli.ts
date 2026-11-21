import { createContext } from '../context.js';
import { clampPeople, populateRoom, startSimRound } from './run.js';

const USAGE = 'Uso: npm run sim -- --people 30 [--sala CÓDIGO]';
const NOT_CONFIGURED = 'Faltan las credenciales del modelo. Define FIFTYX_API_KEY y vuelve a correr este comando.';
const DEFAULT_ROOM_NAME = 'Organización simulada';

const optionOf = (name: string): string | undefined => {
  const position = process.argv.indexOf(`--${name}`);
  return position === -1 ? undefined : process.argv[position + 1];
};

async function main(): Promise<number> {
  const people = Number(optionOf('people'));
  if (!Number.isInteger(people)) {
    console.error(USAGE);
    return 1;
  }
  const ctx = createContext();
  if (!ctx.model) {
    console.error(NOT_CONFIGURED);
    return 1;
  }
  const code = optionOf('sala');
  const room = code ? ctx.rooms.findRoom(code) : ctx.rooms.createRoom(ctx.teams.createTeam(DEFAULT_ROOM_NAME).id);
  if (!room) {
    console.error('Esa sala no existe.');
    return 1;
  }

  console.log(`Sala ${room.code}. Inventando ${clampPeople(people)} personas…`);
  const added = await populateRoom(ctx, ctx.model, room, clampPeople(people));
  console.log(`${added} personas entraron. Los agentes están conversando.`);
  const started = startSimRound(ctx, ctx.model, room);
  if (!started) {
    console.error('Ya hay una ronda en curso en esta sala.');
    return 1;
  }
  await started.done;

  for (const thread of ctx.agents.threadsOf(started.round.id)) {
    console.log(`\n${thread.requesterName} → ${thread.helperName} · ${thread.topic} · ${thread.help ?? 'sin respuesta'}`);
    for (const message of thread.messages) console.log(`  Agente de ${message.fromName}: ${message.text}`);
  }
  const proposals = ctx.agents.proposalsOf(room.teamId, 100).filter((proposal) => proposal.roundId === started.round.id);
  console.log(`\nPropuestas: ${proposals.length}`);
  for (const proposal of proposals) console.log(`  ${proposal.text}`);
  const finished = ctx.agents.latestRound(room.teamId);
  console.log(`\nRonda ${finished?.status ?? 'sin estado'}${finished?.problem ? `: ${finished.problem}` : ''}. Pantalla: /sala/${room.code}`);
  return finished?.status === 'lista' ? 0 : 1;
}

process.exitCode = await main();
