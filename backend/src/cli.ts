import { openStore } from './db.js';

const [command, ...args] = process.argv.slice(2);
const name = args.join(' ').trim();

if (command !== 'add-person' || !name) {
  console.error('Uso: npm run add-person -- "Nombre"');
  process.exit(1);
}

const person = openStore().addPerson(name);
console.log(`Persona creada: ${person.name}`);
console.log(`Página de conexión: /conectar/${person.token}`);
console.log(`Envío de Apple Health: POST /api/ingest/health/${person.token}`);
