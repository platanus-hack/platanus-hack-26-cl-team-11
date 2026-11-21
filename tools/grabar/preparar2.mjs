// Todo lo que el guion de «Diez personas, sus fuentes y sus agentes» hace por HTTP: abre la sala, crea y conecta al elenco,
// compara lo que el producto dice de cada persona con lo que el guion espera, corre la ronda y elige la variante que se filma.
// Sin navegador. Nada de lo que imprime, lanza o entrega lleva una ficha: las rutas salen como /api/people/… y /conectar/….
//
//   node tools/grabar/preparar2.mjs --ensayo [--base http://localhost:8797] [--parcial-vale]
//
// El ensayo necesita arriba el servidor de demo (tools/grabar/servidor-demo.mts) con un DATA_DIR nuevo. Abre una sala nueva cada vez.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ELENCO, HOY, SALA, ZONA, porId } from './elenco2.mjs';

const BASE = 'http://localhost:8797';
const OCULTO = '…';
const DESDE_SU_PAGINA = 'same-origin';
const ESPERA_RONDA_MS = 300_000;
const CADA_MS = 1500;
const ENTRE_ENTRADAS_MS = 25;
const MAX_AYUDANTES = 2;
const NOMBRE = Object.fromEntries(ELENCO.map(({ id, nombre }) => [id, nombre]));
const PIDEN = [NOMBRE.antonia, NOMBRE.ignacio, NOMBRE.javiera];
const PROVEEDOR = { google: 'Google', github: 'GitHub', linear: 'Linear' };
const TRAMOS_PRIVADOS = [/^(\/api\/people\/)[^/]+/, /^(\/api\/ingest\/[^/]+\/)[^/]+/, /^(\/a\/)[^/]+/, /^(\/conectar\/)[^/]+/];
const USO = [
  'Uso: node tools/grabar/preparar2.mjs --ensayo [--base http://localhost:8797] [--parcial-vale]',
  '',
  'Corre el guion completo sin navegador y sin video: sala nueva, elenco conectado, ronda real y variante elegida.',
  'Termina con código 1 si el producto dice algo distinto de lo esperado o si la ronda pide una retoma.',
].join('\n');

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });
const diaEnSantiago = (instante = new Date()) => formatoDia.format(instante);
const enLista = (nombres) => (nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres.join(''));

const listaDe = (fichas) => {
  if (typeof fichas === 'string') return [fichas];
  if (fichas instanceof Map) return [...fichas.values()];
  if (fichas && typeof fichas[Symbol.iterator] === 'function') return [...fichas];
  return fichas && typeof fichas === 'object' ? Object.values(fichas) : [];
};

export function sinFichas(valor, fichas) {
  const secretos = listaDe(fichas).filter((ficha) => typeof ficha === 'string' && ficha !== '').sort((una, otra) => otra.length - una.length);
  const limpiar = (texto) => secretos.reduce((limpio, secreto) => limpio.replaceAll(secreto, OCULTO), texto);
  const copias = new WeakMap();
  const copiar = (dato) => {
    if (typeof dato === 'string') return limpiar(dato);
    if (dato === null || typeof dato !== 'object') return dato;
    if (copias.has(dato)) return copias.get(dato);
    if (dato instanceof Date) return new Date(dato.getTime());
    if (dato instanceof Map) return new Map([...dato].map(([clave, interno]) => [copiar(clave), copiar(interno)]));
    if (dato instanceof Set) return new Set([...dato].map(copiar));
    const copia = Array.isArray(dato) ? [] : dato instanceof Error ? new Error(limpiar(String(dato.message))) : {};
    copias.set(dato, copia);
    if (dato instanceof Error) {
      copia.name = dato.name;
      copia.stack = limpiar(String(dato.stack ?? ''));
      if (dato.cause !== undefined) copia.cause = copiar(dato.cause);
    }
    for (const [clave, interno] of Object.entries(dato)) copia[limpiar(clave)] = copiar(interno);
    return copia;
  };
  return copiar(valor);
}

export function rutaSinFicha(ruta) {
  const [, camino, resto] = /^([^?#]*)(.*)$/s.exec(String(ruta));
  const limpio = TRAMOS_PRIVADOS.reduce((visible, tramo) => visible.replace(tramo, `$1${OCULTO}`), camino);
  return resto ? `${limpio}${resto[0]}${OCULTO}` : limpio;
}

const privadoDe = (ruta) => TRAMOS_PRIVADOS.map((tramo) => tramo.exec(String(ruta).split(/[?#]/)[0])).find(Boolean)?.[0].split('/').pop();

const imprimir = (valor, fichas = []) => console.log(sinFichas(valor, fichas));

export function crearCliente({ base, fetchImpl = fetch }) {
  const raiz = String(base).replace(/\/+$/, '');
  const secretos = new Set();
  const recordar = (secreto) => {
    if (typeof secreto === 'string' && secreto !== '') secretos.add(secreto);
  };
  const limpio = (texto) => sinFichas(String(texto), secretos);

  const detalleDe = (texto) => {
    try {
      const { error } = JSON.parse(texto);
      return typeof error === 'string' && error ? `: ${limpio(error)}` : '';
    } catch {
      return '';
    }
  };

  const enviar = async (metodo, ruta, opciones) => {
    recordar(privadoDe(ruta));
    let respuesta;
    try {
      respuesta = await fetchImpl(`${raiz}${ruta}`, { method: metodo, ...opciones });
    } catch (falla) {
      throw new Error(`${metodo} ${rutaSinFicha(ruta)} no llegó al servidor de demo en ${raiz}: ${limpio(falla?.cause?.code ?? falla?.message ?? falla)}`);
    }
    return { respuesta, texto: await respuesta.text() };
  };

  async function api(ruta, { metodo = 'GET', cuerpo, token } = {}) {
    recordar(token);
    recordar(cuerpo?.token);
    const { respuesta, texto } = await enviar(metodo, ruta, {
      headers: { ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    if (!respuesta.ok) throw Object.assign(new Error(`${metodo} ${rutaSinFicha(ruta)} respondió ${respuesta.status}${detalleDe(texto)}`), { estado: respuesta.status });
    if (!(respuesta.headers.get('content-type') ?? '').includes('json')) return texto;
    let dato;
    try {
      dato = JSON.parse(texto);
    } catch {
      throw new Error(`${metodo} ${rutaSinFicha(ruta)} respondió ${respuesta.status} con un JSON que no se puede leer.`);
    }
    recordar(dato?.token);
    return dato;
  }

  async function conectarOAuth(ficha, proveedor, id) {
    const permiso = `del permiso de ${PROVEEDOR[proveedor] ?? proveedor} para ${id}`;
    const inicio = await enviar('GET', `/api/people/${ficha}/oauth/${proveedor}/start`, { redirect: 'manual', headers: { 'sec-fetch-site': DESDE_SU_PAGINA, origin: raiz } });
    if (inicio.respuesta.status !== 302) throw new Error(`El inicio ${permiso} respondió ${inicio.respuesta.status} y se esperaba 302${detalleDe(inicio.texto)}`);
    const estado = new URL(inicio.respuesta.headers.get('location') ?? '', raiz).searchParams.get('state');
    const galletas = inicio.respuesta.headers.getSetCookie?.() ?? [];
    const galleta = (galletas[0] ?? inicio.respuesta.headers.get('set-cookie') ?? '').split(';')[0].trim();
    if (!estado || !galleta) throw new Error(`El inicio ${permiso} no entregó estado y galleta.`);

    const vuelta = await enviar('GET', `/api/oauth/${proveedor}/callback?${new URLSearchParams({ code: `demo-${id}`, state: estado })}`, { redirect: 'manual', headers: { cookie: galleta } });
    if (vuelta.respuesta.status !== 302) throw new Error(`La vuelta ${permiso} respondió ${vuelta.respuesta.status} y se esperaba 302${detalleDe(vuelta.texto)}`);
    const destino = new URL(vuelta.respuesta.headers.get('location') ?? '', raiz);
    const aviso = destino.searchParams.get('aviso');
    if (aviso !== null) throw new Error(`La vuelta ${permiso} trajo un aviso: «${limpio(aviso)}»`);
    if (destino.pathname !== `/conectar/${ficha}`) throw new Error(`La vuelta ${permiso} no terminó en la página de la persona.`);
  }

  return { base: raiz, api, conectarOAuth };
}

export async function comprobarServidor(cliente) {
  const estado = await cliente.api('/demo/estado');
  const hoy = diaEnSantiago();
  if (!estado || typeof estado !== 'object') throw new Error(`${cliente.base}/demo/estado no respondió JSON. Ahí tiene que estar el servidor de demo, no el del producto.`);
  if (estado.hoy !== hoy) throw new Error(`El servidor de demo partió el ${estado.hoy} y hoy en Santiago es ${hoy}. Reinícialo con un DATA_DIR nuevo.`);
  if (HOY !== hoy) throw new Error(`Este guion cargó su elenco el ${HOY} y hoy en Santiago es ${hoy}. Vuelve a correrlo.`);
  if (estado.rondaSola !== false) throw new Error('El servidor de demo tiene encendida la ronda automática: rondaSola no es false.');
  return estado;
}

export async function abrirSala(cliente) {
  const sala = await cliente.api('/api/rooms', { metodo: 'POST', cuerpo: { name: SALA } });
  const entrada = await cliente.api(`/api/rooms/${sala.code}/join`, { metodo: 'POST', cuerpo: { name: NOMBRE.antonia } });
  return { codigo: sala.code, ficha: entrada.token };
}

const tituloDe = (documento) => String(documento).split('\n')[0].replace(/^#\s*/, '');

async function asistentePorLink(cliente, persona, ficha, alPaso) {
  const { tipo, etiqueta } = persona.asistente;
  const { archivos } = persona.repo;
  const mensaje = `Primer contexto de ${persona.nombre}`;
  const enlace = await cliente.api(`/api/people/${ficha}/assistants/pairings`, { metodo: 'POST', cuerpo: {} });
  const documento = await cliente.api(enlace.path);
  await alPaso?.('lee', { titulo: tituloDe(documento), kb: Math.round(String(documento).length / 102.4) / 10 });
  const ingreso = await cliente.api('/api/assistants/join', { metodo: 'POST', cuerpo: { code: enlace.code, kind: tipo, label: etiqueta } });
  await alPaso?.('entra', { tipo: ingreso.assistant?.kind ?? tipo, etiqueta: ingreso.assistant?.label ?? etiqueta });
  const cambio = await cliente.api('/api/repo/commit', { metodo: 'POST', token: ingreso.token, cuerpo: { message: mensaje, topics: [], files: archivos } });
  await alPaso?.('escribe', { mensaje, archivos: archivos.map((archivo) => archivo.path), total: cambio.files });
  return { archivos: cambio.files };
}

async function asistentePegando(cliente, persona, ficha) {
  const { tipo, comparte } = persona.asistente;
  const pegado = await cliente.api(`/api/people/${ficha}/repo/paste`, { metodo: 'POST', cuerpo: { kind: tipo, content: persona.repo.pegado } });
  if (comparte) await cliente.api(`/api/people/${ficha}/repo/file`, { metodo: 'PATCH', cuerpo: { path: pegado.path, share: 'siempre' } });
  return { archivo: pegado.path, compartido: comparte };
}

const pasos = {
  async salud(cliente, persona, ficha) {
    let ultimo = null;
    for (const cuerpo of persona.salud) ultimo = await cliente.api(`/api/ingest/health/${ficha}`, { metodo: 'POST', cuerpo });
    return { envios: persona.salud.length, resumen: ultimo?.summary ?? null };
  },
  async oauth(cliente, persona, ficha) {
    for (const proveedor of persona.oauth) await cliente.conectarOAuth(ficha, proveedor, persona.id);
    return { proveedores: [...persona.oauth] };
  },
  async granola(cliente, persona, ficha) {
    if (!persona.granola) return null;
    const conectada = await cliente.api(`/api/people/${ficha}/connections/granola`, { metodo: 'POST', cuerpo: { secret: `grn_demo_${persona.id}` } });
    return { cuenta: conectada.account, registros: conectada.imported };
  },
  async checkin(cliente, persona, ficha) {
    if (!persona.checkin) return null;
    await cliente.api(`/api/people/${ficha}/checkins`, { metodo: 'POST', cuerpo: persona.checkin });
    return { ...persona.checkin };
  },
  async asistente(cliente, persona, ficha, alPaso) {
    if (!persona.asistente) return null;
    return persona.asistente.puerta === 'link' ? asistentePorLink(cliente, persona, ficha, alPaso) : asistentePegando(cliente, persona, ficha);
  },
};

const comoEntro = ({ asistente }, hecho) => {
  if (!asistente) return 'sin agente todavía';
  if (asistente.puerta === 'link') return `${asistente.etiqueta} por link · ${hecho.archivos} archivos`;
  return `${asistente.etiqueta} pegado${asistente.comparte ? ' y compartido' : ', sin compartir'}`;
};

export async function crearYConectar(cliente, persona, { anotar } = {}) {
  const { nombre } = persona;
  const { token: ficha } = await cliente.api('/api/people', { metodo: 'POST', cuerpo: { name: nombre } });
  const salud = await pasos.salud(cliente, persona, ficha);
  if (salud.envios > 0) await anotar?.(`${nombre} · Apple Health · ${salud.envios} ${salud.envios === 1 ? 'envío' : 'envíos'}`);
  const { proveedores } = await pasos.oauth(cliente, persona, ficha);
  if (proveedores.length > 0) await anotar?.(`${nombre} · permiso simulado de ${enLista(proveedores.map((proveedor) => PROVEEDOR[proveedor] ?? proveedor))}`);
  const granola = await pasos.granola(cliente, persona, ficha);
  if (granola) await anotar?.(`${nombre} · Granola con llave · ${granola.registros} registros`);
  const checkin = await pasos.checkin(cliente, persona, ficha);
  if (checkin) await anotar?.(`${nombre} · check-in ${checkin.mood}`);
  const asistente = await pasos.asistente(cliente, persona, ficha);
  await anotar?.(`${nombre} · ${comoEntro(persona, asistente)}`);
  return ficha;
}

export async function prepararElenco(cliente, { anotar, fichas = new Map() } = {}) {
  for (const persona of ELENCO.slice(1)) fichas.set(persona.id, await crearYConectar(cliente, persona, { anotar }));
  return fichas;
}

const SIN_DATO = 'sin dato';
const comoTexto = (valor) => {
  if (Array.isArray(valor)) return valor.length > 0 ? valor.join(', ') : 'nada';
  return valor === undefined ? SIN_DATO : String(valor);
};
const iguales = (esperado, real) =>
  Array.isArray(esperado) ? Array.isArray(real) && esperado.length === real.length && esperado.every((valor, posicion) => valor === real[posicion]) : esperado === real;
const bloqueoComoTexto = ({ statement, source, visibility }) => `${statement} [${source}, ${visibility}]`;

function diferenciasDe(persona, senales, pagina) {
  const { id, espera } = persona;
  const diferencias = [];
  const anotar = (campo, esperado, real) => diferencias.push(`${id} · ${campo} · esperado ${comoTexto(esperado)} · real ${comoTexto(real)}`);
  const comparar = (campo, esperado, real) => {
    if (!iguales(esperado, real)) anotar(campo, esperado, real);
  };

  for (const nivel of ['energy', 'load']) {
    if (!espera[nivel]) continue;
    for (const campo of ['level', 'statement', 'basis']) comparar(`${nivel}.${campo}`, espera[nivel][campo], senales?.[nivel]?.[campo]);
  }
  if (espera.bloqueos) comparar('bloqueos', espera.bloqueos.map(bloqueoComoTexto), (senales?.blockers ?? []).map(bloqueoComoTexto));
  const temas = senales?.expertise ?? [];
  for (const tema of espera.temas ?? []) if (!temas.includes(tema)) anotar('temas', tema, temas);

  const fuentes = pagina?.sources ?? [];
  for (const fuente of fuentes) if (fuente.connect === 'oauth') comparar(`fuentes.${fuente.id}.configured`, true, fuente.configured);
  if (!espera.conexiones) return diferencias;
  for (const [fuenteId, total] of Object.entries(espera.conexiones)) {
    const fuente = fuentes.find((una) => una.id === fuenteId);
    if (!fuente?.connection) {
      anotar(`conexiones.${fuenteId}`, 'conectada', 'sin conectar');
      continue;
    }
    comparar(`conexiones.${fuenteId}.lastError`, null, fuente.connection.lastError);
    comparar(`conexiones.${fuenteId}.total`, total, fuente.sync?.total ?? 0);
  }
  for (const fuente of fuentes) if (fuente.connection && !Object.hasOwn(espera.conexiones, fuente.id)) anotar(`conexiones.${fuente.id}`, 'sin conectar', 'conectada');
  return diferencias;
}

export async function verificar(cliente, fichas, ids = [...fichas.keys()]) {
  const diferencias = [];
  for (const id of ids) {
    const persona = porId(id);
    const ficha = fichas.get(id);
    if (!persona || !ficha) {
      diferencias.push(`${id} · persona · esperado en el elenco y con ficha · real ${persona ? 'sin ficha' : 'fuera del elenco'}`);
      continue;
    }
    const { signals } = await cliente.api(`/api/people/${ficha}/signals`);
    diferencias.push(...diferenciasDe(persona, signals, await cliente.api(`/api/people/${ficha}`)));
  }
  return diferencias;
}

export async function entrar(cliente, codigo, ficha) {
  const entrada = await cliente.api(`/api/rooms/${codigo}/join`, { metodo: 'POST', cuerpo: { token: ficha } });
  return { nombre: entrada.name, sala: entrada.room?.name ?? null };
}

export async function verificarSala(cliente, codigo) {
  const estado = await cliente.api(`/api/rooms/${codigo}/state`);
  const diferencias = [];
  const anotar = (quien, campo, esperado, real) => diferencias.push(`${quien} · ${campo} · esperado ${comoTexto(esperado)} · real ${comoTexto(real)}`);
  const adentro = estado.people.map((persona) => persona.name);
  const elenco = ELENCO.map((persona) => persona.nombre);
  if (!iguales(elenco, adentro)) anotar('sala', 'orden de entrada', elenco, adentro);
  for (const persona of ELENCO) {
    const suya = estado.people.find((una) => una.name === persona.nombre);
    const asistentes = persona.asistente ? [persona.asistente.tipo] : [];
    if (suya && !iguales(asistentes, suya.assistants)) anotar(persona.id, 'asistentes', asistentes, suya.assistants);
  }
  if (estado.round !== null) anotar('sala', 'ronda', 'ninguna', estado.round?.status);
  return diferencias;
}

export async function equipoDe(cliente, ficha) {
  const { teams } = await cliente.api(`/api/people/${ficha}/teams`);
  if (!teams?.[0]) throw new Error('Esa persona todavía no está en una sala.');
  return teams[0].id;
}

const vistaDeAgentes = (cliente, ficha, equipo) => cliente.api(`/api/people/${ficha}/teams/${equipo}/agents`);

export const pasosDeAntonia = {
  asistente: (cliente, ficha, { alPaso } = {}) => pasos.asistente(cliente, porId('antonia'), ficha, alPaso),
  salud: (cliente, ficha) => pasos.salud(cliente, porId('antonia'), ficha),
  google: (cliente, ficha) => cliente.conectarOAuth(ficha, 'google', 'antonia'),
  granola: (cliente, ficha) => pasos.granola(cliente, porId('antonia'), ficha),
  checkin: (cliente, ficha) => pasos.checkin(cliente, porId('antonia'), ficha),
  async permitir(cliente, ficha) {
    const tema = porId('antonia').checkin.blocker;
    const { asks } = await vistaDeAgentes(cliente, ficha, await equipoDe(cliente, ficha));
    if (!asks.some((pregunta) => pregunta.topic === tema)) throw new Error(`El agente de ${NOMBRE.antonia} no preguntó por «${tema}».`);
    await cliente.api(`/api/people/${ficha}/agents/asks`, { metodo: 'POST', cuerpo: { topic: tema, allow: true } });
    return { tema };
  },
};

export async function dosGuardados(cliente, ficha) {
  const { events } = await cliente.api(`/api/people/${ficha}/events`);
  const hoy = diaEnSantiago();
  const reuniones = events.filter((evento) => evento.source === 'google_calendar');
  const reunion = reuniones.find((evento) => diaEnSantiago(new Date(evento.occurredAt)) === hoy) ?? reuniones[0];
  const correo = events.find((evento) => evento.source === 'gmail');
  if (!correo || !reunion) throw new Error('No quedó guardado un correo y una reunión para mostrar.');
  return { correo: correo.summary, reunion: reunion.summary };
}

export async function iniciarRonda(cliente, ficha) {
  const { teams } = await cliente.api(`/api/people/${ficha}/teams`);
  const equipo = teams?.[0];
  if (!equipo?.roomCode) throw new Error('Quien inicia la ronda todavía no está en una sala.');
  const estado = await cliente.api(`/api/rooms/${equipo.roomCode}/state`);
  if (estado.round !== null) throw new Error(`La sala ya tiene una ronda (${estado.round?.status}). El guion solo inicia la primera.`);
  const ronda = await cliente.api(`/api/people/${ficha}/teams/${equipo.id}/agents/rounds`, { metodo: 'POST' });
  return { id: ronda.id, estado: ronda.status };
}

export async function esperarRonda(cliente, codigo, { limiteMs = ESPERA_RONDA_MS, cadaMs = CADA_MS, alEvento } = {}) {
  const inicio = Date.now();
  const marcas = { ronda_empieza: null, ronda_termina: null };
  let cursor = 0;
  let enRonda = false;

  const repartir = async (nombres) => {
    for (;;) {
      const { events } = await cliente.api(`/api/rooms/${codigo}/events?since=${cursor}`);
      if (events.length === 0) return;
      cursor = events.at(-1).id;
      const parte = events.findLastIndex((evento) => evento.type === 'ronda_empieza');
      if (parte !== -1) enRonda = true;
      if (!enRonda) continue;
      for (const evento of parte === -1 ? events : events.slice(parte)) {
        if (Object.hasOwn(marcas, evento.type)) marcas[evento.type] = evento.createdAt;
        await alEvento?.(evento, nombres);
      }
    }
  };

  for (;;) {
    const estado = await cliente.api(`/api/rooms/${codigo}/state`);
    await repartir(new Map(estado.people.map((persona) => [persona.id, persona.name])));
    const termino = estado.round !== null && estado.round.status !== 'en_curso';
    const vencio = !termino && Date.now() - inicio >= limiteMs;
    if (termino || vencio) {
      const medidos = (Date.parse(marcas.ronda_termina) - Date.parse(marcas.ronda_empieza)) / 1000;
      const segundos = Number.isFinite(medidos) && medidos >= 0 ? medidos : (Date.now() - inicio) / 1000;
      return { estado, segundos: Math.round(segundos * 10) / 10, vencio };
    }
    await pausa(cadaMs);
  }
}

export async function leerResultado(cliente, codigo, fichas) {
  const estado = await cliente.api(`/api/rooms/${codigo}/state`);
  const nombreDe = new Map(estado.people.map((persona) => [persona.id, persona.name]));
  const fichaDe = new Map([...fichas].map(([id, ficha]) => [NOMBRE[id] ?? id, ficha]));
  const equipo = await equipoDe(cliente, fichas.values().next().value);
  const vistas = new Map();
  const vistaDe = async (nombre) => {
    if (!vistas.has(nombre)) vistas.set(nombre, fichaDe.has(nombre) ? await vistaDeAgentes(cliente, fichaDe.get(nombre), equipo) : null);
    return vistas.get(nombre);
  };

  const pedidos = [];
  for (const hilo of estado.threads) {
    const pide = nombreDe.get(hilo.from) ?? hilo.from;
    let pedido = pedidos.find((uno) => uno.pide === pide && uno.tema === hilo.topic);
    if (!pedido) pedidos.push((pedido = { pide, tema: hilo.topic, hilos: [], propuesta: null }));
    const propio = (await vistaDe(pide))?.threads.find((uno) => uno.id === hilo.id);
    pedido.hilos.push({ ayuda: nombreDe.get(hilo.to) ?? hilo.to, help: hilo.help ?? null, mensajes: (propio?.messages ?? []).map((mensaje) => ({ de: mensaje.fromName, texto: mensaje.text })) });
  }
  for (const pedido of pedidos) {
    const propuesta = (await vistaDe(pedido.pide))?.proposals.find((una) => una.topic === pedido.tema && una.parties.some((parte) => parte.role === 'pide' && parte.me));
    if (!propuesta) continue;
    pedido.propuesta = { id: propuesta.id, texto: propuesta.text, estado: propuesta.status, ayudantes: propuesta.parties.filter((parte) => parte.role === 'ayuda').map((parte) => parte.name) };
  }

  const general = await vistaDe(fichaDe.keys().next().value);
  return { ronda: { status: estado.round?.status ?? 'sin_ronda', problem: general?.round?.problem ?? null }, hilos: estado.threads.length, pedidos };
}

export function elegirVariante(resultado, { parcialVale = false } = {}) {
  const pedidosDe = (nombre) => resultado.pedidos.filter((pedido) => pedido.pide === nombre);
  const respuestaDe = (pide, ayuda) => pedidosDe(pide).flatMap((pedido) => pedido.hilos).find((hilo) => hilo.ayuda === ayuda)?.help;
  const piden = resultado.pedidos.map((pedido) => pedido.pide);
  const sinRespuesta = resultado.pedidos.flatMap((pedido) => pedido.hilos).filter((hilo) => hilo.help === null).length;
  const conAyuda = pedidosDe(NOMBRE.antonia).find((pedido) => pedido.propuesta !== null && pedido.hilos.some((hilo) => hilo.help === 'si'));
  const ayudantesDeAntonia = Math.min(MAX_AYUDANTES, conAyuda?.propuesta.ayudantes.length ?? 0);
  const deCatalina = respuestaDe(NOMBRE.ignacio, NOMBRE.catalina);
  const deFelipe = respuestaDe(NOMBRE.javiera, NOMBRE.felipe);

  const v1 = deCatalina === 'no';
  const v2 = !v1 && deFelipe === 'no';
  const soloOrienta = !v1 && !v2 && deCatalina === 'parcial';
  const v3 = soloOrienta && parcialVale;
  const puertas = {
    G0: piden.length === PIDEN.length && PIDEN.every((nombre) => piden.filter((uno) => uno === nombre).length === 1),
    G1: resultado.ronda.status === 'lista' && resultado.ronda.problem === null && sinRespuesta === 0,
    G2: conAyuda !== undefined,
    G2b: ayudantesDeAntonia === MAX_AYUDANTES,
    G3: v1 || v2 || v3,
  };
  const variante = puertas.G0 && puertas.G1 && puertas.G2 && puertas.G3 ? (v1 ? 'V1' : v2 ? 'V2' : 'V3') : 'retoma';

  const motivoDe = () => {
    if (!puertas.G0) return `G0: los pedidos son de ${enLista(piden) || 'nadie'}; se esperaba uno de ${enLista(PIDEN)}.`;
    if (resultado.ronda.status !== 'lista') return `G1: la ronda quedó «${resultado.ronda.status}»${resultado.ronda.problem ? `: ${resultado.ronda.problem}` : '.'}`;
    if (resultado.ronda.problem !== null) return `G1: la ronda terminó con un problema: ${resultado.ronda.problem}`;
    if (sinRespuesta > 0) return `G1: ${sinRespuesta === 1 ? 'una conversación quedó' : `${sinRespuesta} conversaciones quedaron`} sin respuesta.`;
    if (!puertas.G2) return `G2: ${NOMBRE.antonia} no tiene un «si» con propuesta.`;
    if (v1) return `El agente de ${NOMBRE.catalina} le respondió «no» al de ${NOMBRE.ignacio}.`;
    if (v2) return `${NOMBRE.catalina} no respondió «no»; el agente de ${NOMBRE.felipe} le respondió «no» al de ${NOMBRE.javiera}.`;
    if (v3) return `Nadie respondió «no»; el agente de ${NOMBRE.catalina} le respondió «parcial» al de ${NOMBRE.ignacio} y esta toma lo acepta.`;
    if (soloOrienta) return `G3: nadie respondió «no» y el agente de ${NOMBRE.catalina} respondió «parcial»; eso solo vale con --parcial-vale.`;
    return `G3: ni el agente de ${NOMBRE.catalina} ni el de ${NOMBRE.felipe} respondieron «no».`;
  };

  const conCatalina = pedidosDe(NOMBRE.ignacio).find((pedido) => pedido.propuesta?.ayudantes.includes(NOMBRE.catalina));
  return {
    variante,
    motivo: motivoDe(),
    quien: variante === 'retoma' ? null : variante === 'V2' ? 'felipe' : 'catalina',
    pide: variante === 'retoma' ? null : variante === 'V2' ? 'javiera' : 'ignacio',
    ayudantesDeAntonia,
    propuestaDeIgnacio: variante === 'V3' ? (conCatalina?.propuesta.id ?? null) : null,
    puertas,
  };
}

export async function aceptarPendientes(cliente, fichas, { excepto = [], alAceptar } = {}) {
  const fuera = new Set(excepto);
  const aceptadas = [];
  let equipo = null;
  for (const [id, ficha] of fichas) {
    const nombre = NOMBRE[id] ?? id;
    if (fuera.has(id) || fuera.has(nombre)) continue;
    equipo ??= await equipoDe(cliente, ficha);
    const { proposals } = await vistaDeAgentes(cliente, ficha, equipo);
    for (const propuesta of proposals) {
      if (propuesta.status !== 'por_aprobar' || propuesta.myAnswer !== 'pendiente' || fuera.has(propuesta.id)) continue;
      const despues = await cliente.api(`/api/people/${ficha}/agents/proposals/${propuesta.id}/answer`, { metodo: 'POST', cuerpo: { answer: 'acepta' } });
      const aceptada = { nombre, propuesta: propuesta.id, tema: propuesta.topic, estado: despues.status };
      aceptadas.push(aceptada);
      await alAceptar?.(nombre, aceptada);
    }
  }
  return aceptadas;
}

export async function rechazar(cliente, ficha, propuestaId) {
  const despues = await cliente.api(`/api/people/${ficha}/agents/proposals/${propuestaId}/answer`, { metodo: 'POST', cuerpo: { answer: 'rechaza' } });
  return { propuesta: despues.id, estado: despues.status };
}

const lineaDeEvento = ({ type, payload }, nombres) => {
  const de = (id) => nombres.get(id) ?? 'alguien';
  if (type === 'ronda_empieza') return 'ronda › empieza: cada agente lee lo compartido de su persona';
  if (type === 'hilo_abre') return `hilo › ${de(payload.from)} → ${de(payload.to)} · ${payload.topic}`;
  if (type === 'hilo_responde') return `respuesta › ${de(payload.to)} a ${de(payload.from)} · ${payload.help}`;
  if (type === 'propuesta_nace') return `propuesta › ${de(payload.from)} con ${enLista((payload.helpers ?? []).map(de))}`;
  if (type === 'ronda_termina') return `ronda › termina · ${payload.status}`;
  return null;
};

async function correrEnsayo({ base = BASE, parcialVale = false, fetchImpl, cadaMs, limiteMs, entreEntradasMs = ENTRE_ENTRADAS_MS, decir }, fichas) {
  const contar = decir ? (valor) => decir(sinFichas(valor, fichas)) : (valor) => imprimir(valor, fichas);
  const cliente = crearCliente({ base, ...(fetchImpl ? { fetchImpl } : {}) });

  const servidor = await comprobarServidor(cliente);
  contar(`Ensayo sobre ${cliente.base} · commit ${servidor.commit ?? 'sin anotar'} · modelo ${servidor.modelo ?? 'sin anotar'} · hoy ${servidor.hoy}`);
  const { codigo, ficha } = await abrirSala(cliente);
  fichas.set('antonia', ficha);
  contar(`Sala «${SALA}» ${codigo} · ${NOMBRE.antonia} adentro, sin agente todavía`);

  await prepararElenco(cliente, { anotar: (linea) => contar(`  ${linea}`), fichas });
  const delElenco = await verificar(cliente, fichas, ELENCO.slice(1).map((persona) => persona.id));
  contar(`Diferencias de las nueve: ${delElenco.length === 0 ? 'ninguna' : delElenco.length}`);
  for (const diferencia of delElenco) contar(`  ${diferencia}`);
  if (delElenco.length > 0) return { codigo: 1, diferencias: delElenco, eleccion: null, resultado: null };

  const asistente = await pasosDeAntonia.asistente(cliente, ficha, { alPaso: (paso, detalle) => contar(`  guion como Claude Code › ${paso} · ${JSON.stringify(detalle)}`) });
  const salud = await pasosDeAntonia.salud(cliente, ficha);
  await pasosDeAntonia.google(cliente, ficha);
  const granola = await pasosDeAntonia.granola(cliente, ficha);
  const guardados = await dosGuardados(cliente, ficha);
  await pasosDeAntonia.checkin(cliente, ficha);
  const { tema } = await pasosDeAntonia.permitir(cliente, ficha);
  contar(`${NOMBRE.antonia} · ${asistente.archivos} archivos · ${salud.resumen} · Google · Granola ${granola.registros} registros · check-in · permite «${tema}»`);
  contar(`  guardado › ${guardados.correo}`);
  contar(`  guardado › ${guardados.reunion}`);

  for (const persona of ELENCO.slice(1)) {
    await pausa(entreEntradasMs);
    await entrar(cliente, codigo, fichas.get(persona.id));
    contar(`  ${persona.enRegistro}`);
  }
  const deAntonia = [...(await verificar(cliente, fichas, ['antonia'])), ...(await verificarSala(cliente, codigo))];
  contar(`Diferencias de ${NOMBRE.antonia} y de la sala: ${deAntonia.length === 0 ? 'ninguna' : deAntonia.length}`);
  for (const diferencia of deAntonia) contar(`  ${diferencia}`);
  if (deAntonia.length > 0) return { codigo: 1, diferencias: deAntonia, eleccion: null, resultado: null };

  const antes = (await cliente.api('/demo/estado')).llamadas ?? {};
  await iniciarRonda(cliente, ficha);
  const espera = await esperarRonda(cliente, codigo, {
    ...(cadaMs === undefined ? {} : { cadaMs }),
    ...(limiteMs === undefined ? {} : { limiteMs }),
    alEvento: (evento, nombres) => {
      const linea = lineaDeEvento(evento, nombres);
      if (linea) contar(`  ${linea}`);
    },
  });
  const despues = (await cliente.api('/demo/estado')).llamadas ?? {};
  const llamadas = (despues.total ?? 0) - (antes.total ?? 0);
  contar(`Montu ${espera.vencio ? 'sin terminar' : espera.estado.round.status} · ${espera.segundos} s reales · ${llamadas} llamadas al modelo en la ronda`);
  contar(`Servidor desde que partió: ${despues.total ?? 0} llamadas, ${despues.fallidas ?? 0} fallidas, ${despues.reintentos ?? 0} reintentos, ${despues.segundos ?? 0} s de modelo`);

  const resultado = await leerResultado(cliente, codigo, fichas);
  const eleccion = elegirVariante(resultado, { parcialVale });
  contar(`Conversaciones: ${resultado.hilos}`);
  for (const pedido of resultado.pedidos) for (const hilo of pedido.hilos) contar(`  ${pedido.pide} → ${hilo.ayuda} · ${pedido.tema} · ${hilo.help ?? 'sin respuesta'}`);
  const conPropuesta = resultado.pedidos.filter((pedido) => pedido.propuesta);
  contar(`Propuestas: ${conPropuesta.length}`);
  for (const { pide, propuesta } of conPropuesta) contar(`  ${pide} con ${enLista(propuesta.ayudantes)} · ${propuesta.estado} · «${propuesta.texto}»`);

  const candidatos = eleccion.variante === 'retoma' ? [[NOMBRE.ignacio, NOMBRE.catalina], [NOMBRE.javiera, NOMBRE.felipe]] : [[NOMBRE[eleccion.pide], NOMBRE[eleccion.quien]]];
  for (const [pide, ayuda] of candidatos) {
    const hilo = resultado.pedidos.filter((pedido) => pedido.pide === pide).flatMap((pedido) => pedido.hilos).find((uno) => uno.ayuda === ayuda);
    contar(`${eleccion.variante === 'retoma' ? 'Hilo candidato' : 'Hilo elegido'}: ${pide} → ${ayuda}${hilo ? '' : ' · no existe'}`);
    for (const mensaje of hilo?.mensajes ?? []) contar(`  ${mensaje.de}: «${mensaje.texto}»`);
  }
  contar(`Puertas: ${Object.entries(eleccion.puertas).map(([puerta, pasa]) => `${puerta} ${pasa ? 'pasa' : 'falla'}`).join(' · ')}`);
  contar(`Variante: ${eleccion.variante} · ${eleccion.motivo}`);
  return { codigo: eleccion.variante === 'retoma' ? 1 : 0, diferencias: [], eleccion, resultado };
}

export async function ensayo(opciones = {}) {
  const fichas = new Map();
  try {
    return await correrEnsayo(opciones, fichas);
  } catch (falla) {
    throw sinFichas(falla, fichas);
  }
}

async function main() {
  const opciones = process.argv.slice(2);
  const valorDe = (nombre, porDefecto) => (opciones.includes(`--${nombre}`) ? opciones[opciones.indexOf(`--${nombre}`) + 1] : porDefecto);
  const base = valorDe('base', BASE);
  if (!opciones.includes('--ensayo') || !/^https?:\/\//.test(base ?? '')) {
    imprimir(USO);
    process.exitCode = opciones.includes('--ayuda') ? 0 : 1;
    return;
  }
  const { codigo } = await ensayo({ base, parcialVale: opciones.includes('--parcial-vale') });
  process.exitCode = codigo;
}

const esLaEntrada = () => {
  try {
    return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (esLaEntrada()) {
  main().catch((falla) => {
    console.error(falla instanceof Error ? falla.message : String(falla));
    process.exitCode = 1;
  });
}
