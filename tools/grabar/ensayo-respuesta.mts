// Sonda de respuestas de la demo «Diez personas, sus fuentes y sus agentes». Antes de grabar, mide qué responden los agentes
// de Catalina y de Felipe cuando su ficha dice «disponibilidad: baja». Llama al modelo real (claude por la terminal):
// solo la corre quien dirige la grabación. No cambia ningún prompt: usa los del producto.
//
//   npx tsx tools/grabar/ensayo-respuesta.mts --veces 6
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AgentCard, Need } from '../../backend/src/agents/cards.js';
import { CLAUDE_CLI_MAX_PARALLEL } from '../../backend/src/agents/claudeCli.js';
import { cardDepsFrom } from '../../backend/src/agents/deps.js';
import { refreshDigests } from '../../backend/src/agents/digest.js';
import { AgentModelError, type AgentModel } from '../../backend/src/agents/model.js';
import { HELP_ANSWERS, HelpReply, isHelpAnswer, replyPrompt, systemFor, type HelpAnswer } from '../../backend/src/agents/prompts.js';
import { cardFor } from '../../backend/src/agents/round.js';
import { porId } from './elenco2.mjs';
import { conReintento, crearServidorDemo, type Llamadas } from './servidor-demo.mjs';

type Persona = any;
type Pedido = { metodo?: string; cuerpo?: unknown; cabeceras?: Record<string, string> };
type Respuesta = { ayuda: HelpAnswer | null; texto: string };

const VECES = 6;
const MAX_VECES = 12;
const ORIGEN = 'http://ronda.invalid';
const DESDE_SU_PAGINA = { 'sec-fetch-site': 'same-origin' };
const DISPONIBILIDAD_ESPERADA = 'baja';
const SIN_RESPUESTA = 'sin respuesta';
const REVISA_EL_ELENCO = 'No se llamó al modelo. Revisa el elenco con tools/grabar/proveedor-demo.test.mts.';
const RESPUESTAS = [...HELP_ANSWERS].reverse();
const ELENCO_DEL_ENSAYO = ['ignacio', 'javiera', 'catalina', 'felipe'];
const SONDAS = [
  {
    ayuda: 'catalina',
    pide: 'ignacio',
    tema: 'Conciliación de cobros con el banco',
    mensaje: 'Ignacio lleva cuatro días sin avances en la conciliación de cobros con el banco y te escribo porque Catalina sabe de conciliación y cobros.',
  },
  {
    ayuda: 'felipe',
    pide: 'javiera',
    tema: 'animación en canvas',
    mensaje: 'Javiera busca a alguien que sepa de animación en canvas para que los arcos del mapa de la sala se muevan sin trabarse, y te escribo porque Felipe conoce ese tema.',
  },
];

const USO = `Sonda de respuestas de la demo 2. Llama al modelo real (claude por la terminal): solo la corre quien dirige la grabación.

  npx tsx tools/grabar/ensayo-respuesta.mts [--veces N]

  --veces N   respuestas por persona, de 1 a ${MAX_VECES}. Por defecto ${VECES}.
  --ayuda     muestra este texto y no llama al modelo.

Arma en memoria a Ignacio, Javiera, Catalina y Felipe con el proveedor simulado y las rutas del producto. Lee con el modelo
los repos de Catalina y de Felipe (2 llamadas), como al empezar una ronda, y le pide N veces a cada agente la respuesta
que daría en la ronda (2 × N llamadas). Nunca hay más de ${CLAUDE_CLI_MAX_PARALLEL} llamadas a la vez. Con --veces ${VECES} son ${SONDAS.length + SONDAS.length * VECES} llamadas.
Usa systemFor, replyPrompt y HelpReply del producto, sin cambiarlos. Termina siempre con código 0.`;

export function leerOpciones(argumentos: string[]): { ayuda: boolean; veces: number; problema: string | null } {
  let veces = VECES;
  for (let posicion = 0; posicion < argumentos.length; posicion += 1) {
    const opcion = argumentos[posicion];
    if (opcion === '--ayuda') return { ayuda: true, veces, problema: null };
    if (opcion !== '--veces') return { ayuda: false, veces, problema: `No conozco la opción «${opcion}».` };
    posicion += 1;
    veces = Number(argumentos[posicion]);
    if (!Number.isInteger(veces) || veces < 1 || veces > MAX_VECES) return { ayuda: false, veces: VECES, problema: `--veces va con un número entero de 1 a ${MAX_VECES}.` };
  }
  return { ayuda: false, veces, problema: null };
}

async function deATantas<Tarea, Salida>(tareas: Tarea[], aLaVez: number, hacer: (tarea: Tarea) => Promise<Salida>): Promise<Salida[]> {
  const salidas = new Array<Salida>(tareas.length);
  let proxima = 0;
  const atender = async () => {
    while (proxima < tareas.length) {
      const posicion = proxima;
      proxima += 1;
      salidas[posicion] = await hacer(tareas[posicion] as Tarea);
    }
  };
  await Promise.all(Array.from({ length: Math.min(aLaVez, tareas.length) }, atender));
  return salidas;
}

const columnas = (filas: string[][]) => {
  const anchos = (filas[0] ?? []).map((_, columna) => Math.max(...filas.map((fila) => (fila[columna] ?? '').length)));
  return filas.map((fila) => fila.map((celda, columna) => celda.padEnd(anchos[columna] ?? 0)).join('   ').trimEnd()).join('\n');
};

export async function ensayar(veces: number, opciones: { modelo?: AgentModel; escribir?: (linea: string) => void } = {}): Promise<void> {
  const escribir = opciones.escribir ?? ((linea: string) => console.log(linea));
  const propias: Llamadas = { total: 0, fallidas: 0, reintentos: 0, segundos: 0 };
  const servidor = crearServidorDemo({ location: ':memory:', ...(opciones.modelo ? { modelo: conReintento(opciones.modelo, propias) } : {}) });
  const { app, ctx } = servidor;
  const llamadas = opciones.modelo ? propias : servidor.llamadas;
  const modelo = ctx.model;
  if (!modelo) throw new Error('El ensayo no tiene modelo.');

  const enviar = async (persona: Persona, paso: string, ruta: string, { metodo = 'GET', cuerpo, cabeceras = {} }: Pedido = {}, esperado = [200, 201]) => {
    const respuesta = await app.request(ruta, {
      method: metodo,
      headers: { ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }), ...cabeceras },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    if (!esperado.includes(respuesta.status)) throw new Error(`${persona.nombre} · ${paso} respondió ${respuesta.status}.`);
    return respuesta;
  };

  const conectar = async (persona: Persona, ficha: string) => {
    for (const cuerpo of persona.salud) await enviar(persona, 'Apple Health', `/api/ingest/health/${ficha}`, { metodo: 'POST', cuerpo });
    for (const proveedor of persona.oauth) {
      const inicio = await enviar(persona, `el inicio de ${proveedor}`, `/api/people/${ficha}/oauth/${proveedor}/start`, { cabeceras: DESDE_SU_PAGINA }, [302]);
      const estado = new URL(inicio.headers.get('location') ?? '/', ORIGEN).searchParams.get('state') ?? '';
      const galleta = (inicio.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
      const vuelta = await enviar(persona, `la vuelta de ${proveedor}`, `/api/oauth/${proveedor}/callback?${new URLSearchParams({ code: `demo-${persona.id}`, state: estado })}`, { cabeceras: { cookie: galleta } }, [302]);
      if (new URL(vuelta.headers.get('location') ?? '/', ORIGEN).searchParams.has('aviso')) throw new Error(`${persona.nombre} · ${proveedor} volvió con un aviso.`);
    }
    if (persona.granola) await enviar(persona, 'Granola', `/api/people/${ficha}/connections/granola`, { metodo: 'POST', cuerpo: { secret: `grn_demo_${persona.id}` } });
    if (persona.checkin) await enviar(persona, 'el check-in', `/api/people/${ficha}/checkins`, { metodo: 'POST', cuerpo: persona.checkin });
    if (persona.asistente?.puerta === 'pegado') {
      const pegado = (await (await enviar(persona, 'el texto pegado', `/api/people/${ficha}/repo/paste`, { metodo: 'POST', cuerpo: { kind: persona.asistente.tipo, content: persona.repo.pegado } })).json()) as { path: string };
      if (persona.asistente.comparte) await enviar(persona, 'el permiso del texto', `/api/people/${ficha}/repo/file`, { metodo: 'PATCH', cuerpo: { path: pegado.path, share: 'siempre' } });
    }
    if (persona.asistente?.puerta === 'link') {
      const enlace = (await (await enviar(persona, 'la línea del asistente', `/api/people/${ficha}/assistants/pairings`, { metodo: 'POST', cuerpo: {} })).json()) as { code: string; path: string };
      await enviar(persona, 'el documento de ingreso', enlace.path);
      const ingreso = (await (await enviar(persona, 'el ingreso del asistente', '/api/assistants/join', { metodo: 'POST', cuerpo: { code: enlace.code, kind: persona.asistente.tipo, label: persona.asistente.etiqueta } })).json()) as { token: string };
      await enviar(persona, 'el repo', '/api/repo/commit', { metodo: 'POST', cabeceras: { authorization: `Bearer ${ingreso.token}` }, cuerpo: { message: `Primer contexto de ${persona.nombre}`, topics: [], files: persona.repo.archivos } });
    }
  };

  const fichas = new Map<string, string>();
  for (const id of ELENCO_DEL_ENSAYO) {
    const persona = porId(id);
    fichas.set(id, ctx.store.addPerson(persona.nombre).token);
    await conectar(persona, fichas.get(id) as string);
  }
  const nombreDe = (id: string) => porId(id).nombre as string;
  const miembro = (id: string) => ({ token: fichas.get(id) as string, name: nombreDe(id) });
  const fichaDe = (id: string): AgentCard => cardFor(cardDepsFrom(ctx), miembro(id), new Date());

  const fueraDeLoEsperado = SONDAS.filter(({ ayuda }) => fichaDe(ayuda).availability !== DISPONIBILIDAD_ESPERADA);
  const delPedido = fichaDe('ignacio').needs.map((pedido) => pedido.topic);
  for (const { ayuda } of fueraDeLoEsperado) escribir(`La ficha de ${nombreDe(ayuda)} dice «disponibilidad: ${fichaDe(ayuda).availability}» y el ensayo necesita «${DISPONIBILIDAD_ESPERADA}».`);
  if (!delPedido.includes(SONDAS[0]!.tema)) escribir(`El pedido de Ignacio no es «${SONDAS[0]!.tema}». Sus pedidos: ${delPedido.join(' · ') || 'ninguno'}.`);
  if (fueraDeLoEsperado.length > 0 || !delPedido.includes(SONDAS[0]!.tema)) return escribir(REVISA_EL_ELENCO);

  const partio = performance.now();
  const { modelo: idDelModelo } = (await (await app.request('/demo/estado')).json()) as { modelo: string | null };
  escribir(`Ensayo de respuestas · modelo ${idDelModelo ?? 'de prueba'} · ${veces} por persona · ${SONDAS.length + SONDAS.length * veces} llamadas, de a ${CLAUDE_CLI_MAX_PARALLEL} como máximo.`);
  const sinLeer = await refreshDigests({ repo: ctx.repo, digests: ctx.digests, model: modelo }, SONDAS.map(({ ayuda }) => miembro(ayuda)));
  if (sinLeer.length > 0) {
    escribir(`El modelo no pudo leer ${sinLeer.length === 1 ? 'un repo' : `${sinLeer.length} repos`}: ${sinLeer.map((falla) => (falla instanceof AgentModelError ? falla.message : 'error interno')).join(' · ')}`);
    return escribir(`No se pidieron respuestas. Llamadas al modelo: ${llamadas.total}, ${llamadas.fallidas} fallidas, ${llamadas.reintentos} reintentos.`);
  }

  const sondas = SONDAS.map((sonda) => ({ ...sonda, ficha: fichaDe(sonda.ayuda), pedido: { topic: sonda.tema, statement: sonda.mensaje } satisfies Need }));
  const responder = async ({ ayuda, pide, ficha, pedido, mensaje }: (typeof sondas)[number]): Promise<Respuesta> => {
    try {
      const respuesta = await modelo.decide({ system: systemFor(nombreDe(ayuda)), prompt: replyPrompt(ficha, nombreDe(pide), pedido, mensaje), schema: HelpReply });
      const dicho = respuesta.help.trim().toLowerCase();
      return isHelpAnswer(dicho) ? { ayuda: dicho, texto: respuesta.message.trim() } : { ayuda: null, texto: `El modelo respondió «${dicho}», que el producto no acepta.` };
    } catch (falla) {
      if (!(falla instanceof AgentModelError)) throw falla;
      return { ayuda: null, texto: falla.message };
    }
  };
  const turnos = Array.from({ length: veces }, () => sondas).flat();
  const respuestas = await deATantas(turnos, CLAUDE_CLI_MAX_PARALLEL, responder);
  const de = (ayuda: string) => respuestas.filter((_, posicion) => turnos[posicion]!.ayuda === ayuda);
  const cuantas = (ayuda: string, valor: HelpAnswer | null) => String(de(ayuda).filter((respuesta) => respuesta.ayuda === valor).length);

  escribir('');
  escribir(
    columnas([
      ['Persona', 'Disponibilidad', ...RESPUESTAS, SIN_RESPUESTA],
      ...sondas.map(({ ayuda, ficha }) => [nombreDe(ayuda), ficha.availability, ...RESPUESTAS.map((valor) => cuantas(ayuda, valor)), cuantas(ayuda, null)]),
    ]),
  );
  for (const { ayuda, pide, tema, mensaje, ficha } of sondas) {
    escribir('');
    escribir(`${nombreDe(ayuda)} · tema «${tema}» · le escribe el agente de ${nombreDe(pide)}: «${mensaje}»`);
    escribir(`  Su ficha · frases: ${JSON.stringify(ficha.statements)} · temas: ${JSON.stringify(ficha.expertise)} · disponibilidad: ${ficha.availability}`);
    for (const [posicion, respuesta] of de(ayuda).entries()) escribir(`  ${posicion + 1}. ${respuesta.ayuda ?? SIN_RESPUESTA} · ${respuesta.ayuda ? `«${respuesta.texto}»` : respuesta.texto}`);
  }
  escribir('');
  escribir(
    `Llamadas al modelo: ${llamadas.total} (${SONDAS.length} lecturas de repo y ${turnos.length} respuestas), ${llamadas.fallidas} fallidas, ${llamadas.reintentos} reintentos · ${Math.round(llamadas.segundos)} s de modelo en ${Math.round((performance.now() - partio) / 1000)} s de reloj.`,
  );
}

const esLaEntrada = () => {
  try {
    return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (esLaEntrada()) {
  const { ayuda, veces, problema } = leerOpciones(process.argv.slice(2));
  if (problema) console.log(`${problema}\n`);
  if (ayuda || problema) console.log(USO);
  else await ensayar(veces);
}
