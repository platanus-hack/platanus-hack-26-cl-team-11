import type { DatabaseSync } from '../pg/database.js';
import * as z from 'zod/v4';
import type { RepoDigest } from '../agents/digest.js';
import type { AgentModel } from '../agents/model.js';
import type { FileDraft } from '../repo/store.js';

export const MAX_SIM_PEOPLE = 60;
export const MIN_SIM_PEOPLE = 2;
export const SIM_AUTHOR = 'Simulación';
const BATCH_SIZE = 4;
const MAX_ROLE_LENGTH = 60;
const MAX_STATEMENT_LENGTH = 240;
const MAX_TOPIC_LENGTH = 80;
const MAX_EXPERTISE = 4;

export const SIM_NAMES = [
  'Camila', 'Benjamín', 'Sofía', 'Matías', 'Valentina', 'Tomás', 'Isidora', 'Vicente', 'Florencia', 'Agustín',
  'Josefa', 'Martín', 'Antonia', 'Joaquín', 'Catalina', 'Lucas', 'Fernanda', 'Diego', 'Trinidad', 'Maximiliano',
  'Javiera', 'Cristóbal', 'Emilia', 'Felipe', 'Constanza', 'Ignacio', 'Amanda', 'Nicolás', 'Paz', 'Sebastián',
  'Renata', 'Gaspar', 'Macarena', 'Rodrigo', 'Daniela', 'Pablo', 'Carolina', 'Andrés', 'Francisca', 'Gonzalo',
  'Bárbara', 'Esteban', 'Pilar', 'Raimundo', 'Loreto', 'Simón', 'Elisa', 'Bruno', 'Rocío', 'Alonso',
  'Magdalena', 'Franco', 'Josefina', 'Emilio', 'Violeta', 'Damián', 'Ámbar', 'León', 'Rafaela', 'Clemente',
] as const;

export const SimTeam = z.object({
  people: z.array(
    z.object({
      id: z.string().describe('El mismo id que viene en la lista.'),
      role: z.string().describe('Su rol, en dos a cuatro palabras.'),
      workingOn: z.string().describe('Una frase: en qué trabaja esta semana.'),
      needTopic: z.string().describe('El tema en que necesita ayuda, en pocas palabras. Vacío si no necesita.'),
      needStatement: z.string().describe('Una frase: qué ayuda necesita y para qué. Vacío si no necesita.'),
      expertise: z.array(z.string()).describe('De dos a cuatro temas que domina, de una a tres palabras cada uno.'),
    }),
  ),
});

export interface SimPersona {
  name: string;
  role: string;
  digest: RepoDigest;
  files: FileDraft[];
}

export interface SimStore {
  mark(personToken: string): void;
  isSynthetic(personToken: string): boolean;
}

export function openSimStore(db: DatabaseSync): SimStore {
  db.exec('CREATE TABLE IF NOT EXISTS sim_people (person_token TEXT PRIMARY KEY REFERENCES people (token));');
  return {
    mark(personToken) {
      db.prepare('INSERT OR IGNORE INTO sim_people (person_token) VALUES (?)').run(personToken);
    },
    isSynthetic(personToken) {
      return db.prepare('SELECT 1 FROM sim_people WHERE person_token = ?').get(personToken) !== undefined;
    },
  };
}

const SYSTEM = [
  'Inventas personas de trabajo verosímiles para simular una organización en Montu. Todas son ficticias.',
  'Escribe en español de Chile, breve y concreto, sin signos de exclamación ni emojis.',
  'No uses las palabras «paciente», «cita» ni «consulta».',
].join('\n');

const promptFor = (organization: string, batch: Array<{ id: string; nombre: string }>) =>
  [
    `La organización se llama «${organization}». Inventa el contexto de trabajo de estas personas:`,
    JSON.stringify(batch, null, 2),
    'Para cada una: su rol, en qué trabaja esta semana, una necesidad de ayuda concreta y los temas que domina.',
    'Más o menos la mitad necesita ayuda; en el resto deja «needTopic» y «needStatement» vacíos.',
    'Haz que varias necesidades se puedan resolver con lo que domina otra persona de esta misma lista.',
    'Devuelve una entrada por persona, con el mismo id.',
  ].join('\n\n');

const filesOf = (name: string, role: string, digest: RepoDigest): FileDraft[] => {
  const need = digest.needs[0];
  return [
    { path: 'README.md', share: 'siempre', content: `# ${name}\n\n${role}.` },
    { path: 'ahora.md', share: 'siempre', content: [...digest.workingOn.map((line) => `- ${line}`), ...(need ? [`- Necesita ayuda: ${need.statement}`] : [])].join('\n') },
    { path: 'sabe.md', share: 'siempre', content: digest.expertise.map((topic) => `- ${topic}`).join('\n') },
  ];
};

const chunksOf = <Item>(items: Item[], size: number): Item[][] => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

export async function inventPersonas(model: AgentModel, organization: string, names: string[]): Promise<SimPersona[]> {
  const listed = names.map((nombre, index) => ({ id: `s${index + 1}`, nombre }));
  const settled = await Promise.allSettled(chunksOf(listed, BATCH_SIZE).map((batch) => model.decide({ system: SYSTEM, prompt: promptFor(organization, batch), schema: SimTeam })));
  const batches = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  const failed = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (batches.length === 0 && failed) throw failed.reason;
  const invented = new Map(batches.flatMap((batch) => batch.people).map((person) => [person.id, person]));
  return listed.flatMap(({ id, nombre }) => {
    const person = invented.get(id);
    const role = person?.role.trim().slice(0, MAX_ROLE_LENGTH);
    const workingOn = person?.workingOn.trim().slice(0, MAX_STATEMENT_LENGTH);
    if (!person || !role || !workingOn) return [];
    const topic = person.needTopic.trim().slice(0, MAX_TOPIC_LENGTH);
    const statement = person.needStatement.trim().slice(0, MAX_STATEMENT_LENGTH);
    const expertise = [...new Set(person.expertise.map((item) => item.trim().slice(0, MAX_TOPIC_LENGTH)).filter(Boolean))].slice(0, MAX_EXPERTISE);
    const digest: RepoDigest = { workingOn: [workingOn], needs: topic && statement ? [{ topic, statement }] : [], expertise };
    return [{ name: nombre, role, digest, files: filesOf(nombre, role, digest) }];
  });
}
