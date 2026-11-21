// Pruebas de preparar2.mjs contra un servidor de mentira escrito a mano, que responde con las formas del producto.
// Sin puerto, sin red y sin modelo: el fetch global queda reemplazado por uno que falla si alguien lo llama.
//
//   node --test tools/grabar/preparar2.test.mjs
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ELENCO, HOY, SALA, idDe, porId } from './elenco2.mjs';
import {
  abrirSala,
  aceptarPendientes,
  comprobarServidor,
  crearCliente,
  crearYConectar,
  dosGuardados,
  elegirVariante,
  ensayo,
  entrar,
  equipoDe,
  esperarRonda,
  iniciarRonda,
  leerResultado,
  pasosDeAntonia,
  prepararElenco,
  rechazar,
  rutaSinFicha,
  sinFichas,
  verificar,
  verificarSala,
} from './preparar2.mjs';

const BASE = 'http://localhost:8797';
const GUION = fileURLToPath(new URL('./preparar2.mjs', import.meta.url));
const IDS = ELENCO.map((persona) => persona.id);
const TEMA = { Antonia: 'guion y ensayo del pitch', Ignacio: 'Conciliación de cobros con el banco', Javiera: 'animación en canvas' };
const LIBRETO = {
  contactos: { Antonia: ['Fernanda', 'Nicolás'], Ignacio: ['Catalina'], Javiera: ['Cristóbal', 'Felipe'] },
  respuestas: { 'Antonia>Fernanda': 'si', 'Antonia>Nicolás': 'si', 'Ignacio>Catalina': 'no', 'Javiera>Cristóbal': 'si', 'Javiera>Felipe': 'no' },
};
const FUENTES = [
  { id: 'apple_health', label: 'Apple Health', connect: 'push', provider: null },
  { id: 'google_calendar', label: 'Google Calendar', connect: 'oauth', provider: 'google' },
  { id: 'gmail', label: 'Gmail', connect: 'oauth', provider: 'google' },
  { id: 'github', label: 'GitHub', connect: 'oauth', provider: 'github' },
  { id: 'linear', label: 'Linear', connect: 'oauth', provider: 'linear' },
  { id: 'granola', label: 'Granola', connect: 'key', provider: null },
];
const PRIMER_EVENTO_MS = Date.parse(`${HOY}T15:00:00.000Z`);
const ENTRE_EVENTOS_MS = 200;
const EVENTOS_POR_LECTURA = 4;

let salidasALaRed = 0;
globalThis.fetch = async () => {
  salidasALaRed += 1;
  throw new Error('Esta prueba no sale a la red.');
};

const enLista = (nombres) => (nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres.join(''));
const diaMas = (dia, cuantos) => new Date(Date.parse(`${dia}T12:00:00Z`) + cuantos * 86_400_000).toISOString().slice(0, 10);

function servidorDeMentira(opciones = {}) {
  const libreto = { ...LIBRETO, ...opciones.libreto };
  const pedidos = [];
  const secretos = [];
  const personas = new Map();
  const asistentes = new Map();
  const enlaces = new Map();
  const sellos = new Map();
  const eventos = [];
  const hilos = [];
  const propuestas = [];
  const sala = { code: 'QLL4Y7', equipo: 'team_quillay', abierta: false, miembros: [] };
  const llamadas = { total: 1, fallidas: 0, reintentos: 0, segundos: 2.5 };
  let ronda = null;
  let fase = 0;

  const secreto = (clase) => {
    const valor = `${clase}-${String(secretos.length + 1).padStart(3, '0')}-Zx9qLm4Tn7Rb`;
    secretos.push(valor);
    return valor;
  };
  const visible = (texto) => secretos.reduce((limpio, valor) => limpio.replaceAll(valor, '…'), String(texto));
  const json = (estado, cuerpo, cabeceras = []) => new Response(JSON.stringify(cuerpo), { status: estado, headers: [['content-type', 'application/json; charset=UTF-8'], ...cabeceras] });
  const error = (estado, texto) => json(estado, { error: texto });
  const noValido = () => error(404, 'Link no válido.');
  const anotar = (type, payload) => eventos.push({ id: eventos.length + 1, type, payload, createdAt: new Date(PRIMER_EVENTO_MS + eventos.length * ENTRE_EVENTOS_MS).toISOString() });
  const porNombre = (nombre) => [...personas.values()].find((persona) => persona.nombre === nombre);

  const crear = (nombre) => {
    const ficha = secreto('ficha');
    const persona = { ficha, nombre, id: idDe(nombre), publico: `publico${personas.size + 1}`, noches: 0, conexiones: new Map(), checkin: null, asistentes: [], archivos: new Map(), permitidos: new Set() };
    personas.set(ficha, persona);
    return persona;
  };

  const senalesDe = (persona) => {
    const { espera, checkin } = porId(persona.id);
    const propias = {
      energy: { level: espera.energy.level, statement: espera.energy.statement, basis: [...espera.energy.basis], visibility: 'preguntar' },
      load: { level: espera.load.level, statement: espera.load.statement, basis: [...espera.load.basis], visibility: 'preguntar' },
      blockers: espera.bloqueos.map((bloqueo) => ({ topic: bloqueo.source === 'checkin' ? checkin.blocker : TEMA.Ignacio, ...bloqueo })),
      expertise: [...espera.temas, 'otro tema'],
    };
    return opciones.senales?.(persona.id, propias) ?? propias;
  };

  const paginaDe = (persona) => {
    const { espera } = porId(persona.id);
    const propia = {
      name: persona.nombre,
      healthIngestPath: `/api/ingest/health/${persona.ficha}`,
      publicBaseUrl: null,
      sources: FUENTES.map((fuente) => {
        const cuenta = persona.conexiones.get(fuente.id);
        const total = fuente.id === 'apple_health' ? persona.noches : cuenta ? (espera.conexiones[fuente.id] ?? 0) : 0;
        return {
          ...fuente,
          how: '',
          configured: true,
          sync: total > 0 ? { last: `${HOY}T15:00:00.000Z`, total } : null,
          connection: cuenta ? { account: cuenta, lastSyncedAt: `${HOY}T15:00:00.000Z`, lastError: null } : null,
        };
      }),
      events: [],
    };
    return opciones.pagina?.(persona.id, propia) ?? propia;
  };

  const guardadosDe = (persona) => {
    if (!persona.conexiones.has('gmail')) return [];
    const guardado = (id, source, occurredAt, summary) => ({ id, source, type: source === 'gmail' ? 'email' : 'meeting', occurredAt, summary, raw: {}, receivedAt: `${HOY}T15:00:00.000Z` });
    return [
      guardado(5, 'google_calendar', `${diaMas(HOY, 1)}T15:00:00.000Z`, 'Uno a uno con ingeniería · 30 min · 2 asistentes'),
      guardado(8, 'granola', `${HOY}T20:00:00.000Z`, 'Ensayo del pitch con ventas · 45 min · 3 asistentes'),
      guardado(3, 'google_calendar', `${HOY}T18:00:00.000Z`, 'Comité de producto · 90 min · 4 asistentes'),
      guardado(1, 'google_calendar', `${HOY}T12:30:00.000Z`, 'Planificación del lanzamiento · 60 min · 3 asistentes'),
      guardado(6, 'gmail', `${HOY}T11:15:00.000Z`, 'Agenda del comité de producto · de Elisa Carrasco'),
      guardado(7, 'gmail', `${diaMas(HOY, -1)}T21:05:00.000Z`, 'Invitación: ensayo general · de Matías Lagos'),
    ];
  };

  const estadoDe = ({ partes }) => (partes.some((parte) => parte.answer === 'rechaza') ? 'descartada' : partes.every((parte) => parte.answer === 'acepta') ? 'acordada' : 'por_aprobar');
  const verPropuesta = (propuesta, persona) => ({
    id: propuesta.id,
    topic: propuesta.tema,
    text: propuesta.texto,
    createdAt: `${HOY}T15:00:00.000Z`,
    status: estadoDe(propuesta),
    parties: propuesta.partes.map((parte) => ({ name: parte.persona.nombre, role: parte.role, answer: parte.answer, me: parte.persona === persona })),
    myAnswer: propuesta.partes.find((parte) => parte.persona === persona)?.answer ?? null,
  });

  const vistaDe = (persona) => ({
    configured: true,
    round: ronda ? { id: ronda.id, status: ronda.status, startedAt: `${HOY}T15:00:00.000Z`, finishedAt: null, problem: ronda.problem } : null,
    asks: persona.checkin?.blocker && !persona.permitidos.has(persona.checkin.blocker) ? [{ topic: persona.checkin.blocker, statement: `Bloqueo en «${persona.checkin.blocker}» desde hoy` }] : [],
    threads: hilos.map((hilo) => {
      const mine = hilo.pide === persona || hilo.ayuda === persona;
      return {
        id: hilo.id,
        topic: hilo.tema,
        requesterName: hilo.pide.nombre,
        helperName: hilo.ayuda.nombre,
        help: hilo.help,
        mine,
        messages: mine ? hilo.mensajes.map((mensaje) => ({ fromName: mensaje.de, text: mensaje.texto, createdAt: `${HOY}T15:00:00.000Z` })) : null,
      };
    }),
    proposals: propuestas.filter((propuesta) => estadoDe(propuesta) === 'acordada' || propuesta.partes.some((parte) => parte.persona === persona)).map((propuesta) => verPropuesta(propuesta, persona)),
  });

  const estadoDeLaSala = () => ({
    code: sala.code,
    name: SALA,
    people: sala.miembros.map((persona) => ({ id: persona.publico, name: persona.nombre, assistants: [...persona.asistentes], synthetic: false })),
    round: ronda ? { id: ronda.id, status: ronda.status } : null,
    threads: hilos.map((hilo) => ({ id: hilo.id, from: hilo.pide.publico, to: hilo.ayuda.publico, topic: hilo.tema, help: hilo.help, messages: null })),
    lastEventId: eventos.length,
  });

  const avanzar = () => {
    if (ronda?.status !== 'en_curso') return;
    fase += 1;
    if (fase === 1) {
      for (const [pide, ayudantes] of Object.entries(libreto.contactos)) {
        for (const ayuda of ayudantes) {
          const hilo = { id: `hilo-${hilos.length + 1}`, tema: libreto.temas?.[pide] ?? TEMA[pide], pide: porNombre(pide), ayuda: porNombre(ayuda), help: null, mensajes: [{ de: pide, texto: `Mensaje del agente de ${pide} al de ${ayuda}.` }] };
          hilos.push(hilo);
          anotar('hilo_abre', { thread: hilo.id, from: hilo.pide.publico, to: hilo.ayuda.publico, topic: hilo.tema });
        }
      }
    } else if (fase === 2) {
      for (const hilo of hilos) {
        const help = libreto.respuestas[`${hilo.pide.nombre}>${hilo.ayuda.nombre}`];
        if (!help) continue;
        hilo.help = help;
        hilo.mensajes.push({ de: hilo.ayuda.nombre, texto: `Respuesta del agente de ${hilo.ayuda.nombre} al de ${hilo.pide.nombre}.` });
        anotar('hilo_responde', { thread: hilo.id, from: hilo.pide.publico, to: hilo.ayuda.publico, topic: hilo.tema, help });
      }
      for (const pide of Object.keys(libreto.contactos)) {
        const dispuestos = hilos.filter((hilo) => hilo.pide.nombre === pide && hilo.help !== null && hilo.help !== 'no');
        const conSi = dispuestos.filter((hilo) => hilo.help === 'si');
        const elegidos = (conSi.length > 0 ? conSi : dispuestos).slice(0, 2).map((hilo) => hilo.ayuda);
        if (elegidos.length === 0) continue;
        const partes = [{ persona: porNombre(pide), role: 'pide', answer: 'pendiente' }, ...elegidos.map((persona) => ({ persona, role: 'ayuda', answer: 'pendiente' }))];
        propuestas.push({ id: `prop-${propuestas.length + 1}`, tema: dispuestos[0].tema, texto: `${enLista(elegidos.map((persona) => persona.nombre))} con ${pide}.`, partes });
        anotar('propuesta_nace', { from: porNombre(pide).publico, helpers: elegidos.map((persona) => persona.publico), topic: dispuestos[0].tema });
      }
    } else if (!libreto.sinFin) {
      ronda.status = libreto.estado ?? 'lista';
      ronda.problem = libreto.problema ?? null;
      anotar('ronda_termina', { round: ronda.id, status: ronda.status });
    }
  };

  const conectar = (persona, proveedor) => {
    const cuenta = proveedor === 'github' ? `${persona.id}-demo` : `${persona.id}@ronda.example`;
    for (const fuente of FUENTES) if (fuente.provider === proveedor) persona.conexiones.set(fuente.id, cuenta);
  };

  const rutas = [
    ['GET', /^\/demo\/estado$/, () => (opciones.sinDemo ? new Response('<!doctype html><title>Montu</title>', { status: 200, headers: { 'content-type': 'text/html' } }) : json(200, { commit: 'abc1234', arrancoEn: `${HOY}T14:00:00.000Z`, hoy: opciones.hoy ?? HOY, sala: SALA, modelo: 'guionado', rondaSola: opciones.rondaSola ?? false, llamadas: { ...llamadas } }))],
    ['POST', /^\/api\/rooms$/, ({ cuerpo }) => {
      if (cuerpo?.name !== SALA) return error(400, 'Falta el nombre.');
      sala.abierta = true;
      return json(201, { code: sala.code, name: SALA });
    }],
    ['POST', /^\/api\/rooms\/([^/]+)\/join$/, ({ partes: [codigo], cuerpo }) => {
      if (!sala.abierta || codigo !== sala.code) return error(404, 'Esa sala no existe.');
      const conocida = typeof cuerpo?.token === 'string' ? personas.get(cuerpo.token) : undefined;
      if (typeof cuerpo?.token === 'string' && !conocida) return noValido();
      if (!conocida && !cuerpo?.name) return error(400, 'Falta el nombre.');
      const persona = conocida ?? crear(cuerpo.name);
      const yaEstaba = sala.miembros.includes(persona);
      if (!yaEstaba) {
        sala.miembros.push(persona);
        anotar('persona_entra', { person: persona.publico, name: persona.nombre });
      }
      return json(yaEstaba ? 200 : 201, { token: persona.ficha, name: persona.nombre, room: { code: sala.code, name: SALA } });
    }],
    ['GET', /^\/api\/rooms\/([^/]+)\/state$/, ({ partes: [codigo] }) => {
      if (codigo !== sala.code) return error(404, 'Esa sala no existe.');
      avanzar();
      return json(200, estadoDeLaSala());
    }],
    ['GET', /^\/api\/rooms\/([^/]+)\/events$/, ({ consulta }) => {
      const nuevos = eventos.filter((evento) => evento.id > Number(consulta.since ?? 0)).slice(0, EVENTOS_POR_LECTURA);
      return json(200, { events: nuevos, lastEventId: nuevos.at(-1)?.id ?? eventos.length });
    }],
    ['POST', /^\/api\/people$/, ({ cuerpo }) => {
      if (!cuerpo?.name) return error(400, 'Falta el nombre.');
      const persona = crear(cuerpo.name);
      return json(201, { token: persona.ficha, name: persona.nombre });
    }],
    ['GET', /^\/api\/people\/([^/]+)$/, ({ persona }) => json(200, paginaDe(persona))],
    ['GET', /^\/api\/people\/([^/]+)\/signals$/, ({ persona }) => json(200, { name: persona.nombre, signals: senalesDe(persona) })],
    ['GET', /^\/api\/people\/([^/]+)\/events$/, ({ persona }) => json(200, { name: persona.nombre, events: guardadosDe(persona) })],
    ['GET', /^\/api\/people\/([^/]+)\/teams$/, ({ persona }) =>
      json(200, { teams: sala.miembros.includes(persona) ? [{ id: sala.equipo, name: SALA, joinCode: 'codigo-de-equipo', roomCode: sala.code, members: sala.miembros.map((una) => una.nombre), requests: [] }] : [], pending: [] })],
    ['POST', /^\/api\/ingest\/health\/([^/]+)$/, ({ persona, cuerpo }) => {
      if (cuerpo?.sleep_hours === undefined) return error(400, 'Falta el sueño.');
      persona.noches += 1;
      return json(201, { ok: true, id: persona.noches, summary: cuerpo.sleep_hours === '23040,5' ? 'sueño 6.4 h' : `sueño ${cuerpo.sleep_hours} h` });
    }],
    ['GET', /^\/api\/people\/([^/]+)\/oauth\/([^/]+)\/start$/, ({ persona, partes: [, proveedor], cabeceras, redirect }) => {
      if (opciones.sinPagina || cabeceras['sec-fetch-site'] !== 'same-origin' || cabeceras.origin !== BASE || redirect !== 'manual') return error(403, 'Abre la conexión desde tu página de Montu.');
      if (!FUENTES.some((fuente) => fuente.provider === proveedor)) return error(400, 'Ese proveedor no existe.');
      const sello = secreto('sello');
      const galleta = secreto('galleta');
      sellos.set(sello, { persona, proveedor, galleta });
      return new Response(null, {
        status: 302,
        headers: [
          ['location', `/demo/permiso/${proveedor}?${new URLSearchParams({ client_id: 'demo', redirect_uri: `${BASE}/api/oauth/${proveedor}/callback`, state: sello })}`],
          ['set-cookie', `ronda_oauth_${proveedor}=${galleta}; Max-Age=600; Path=/api/oauth/${proveedor}/callback; HttpOnly; SameSite=Lax`],
          ['set-cookie', 'otra=galleta-ajena; Path=/'],
        ],
      });
    }],
    ['GET', /^\/api\/oauth\/([^/]+)\/callback$/, ({ partes: [proveedor], consulta, cabeceras }) => {
      const sello = sellos.get(consulta.state);
      if (!sello || sello.proveedor !== proveedor || cabeceras.cookie !== `ronda_oauth_${proveedor}=${sello.galleta}`) return error(400, 'El enlace de conexión venció o no es válido. Vuelve a intentarlo desde tu página.');
      sellos.delete(consulta.state);
      const pagina = `/conectar/${sello.persona.ficha}`;
      const aviso = opciones.aviso ?? (consulta.code === `demo-${sello.persona.id}` ? null : 'El proveedor no aceptó la autorización. Vuelve a conectar tu cuenta.');
      if (aviso === null) conectar(sello.persona, proveedor);
      return new Response(null, { status: 302, headers: [['location', aviso === null ? pagina : `${pagina}?aviso=${encodeURIComponent(aviso.replace('{ficha}', sello.persona.ficha))}`]] });
    }],
    ['POST', /^\/api\/people\/([^/]+)\/connections\/granola$/, ({ persona, cuerpo }) => {
      if (cuerpo?.secret !== `grn_demo_${persona.id}`) return error(400, 'Granola rechazó la llave.');
      persona.conexiones.set('granola', `${persona.id}@ronda.example`);
      return json(201, { ok: true, account: `${persona.id}@ronda.example`, imported: porId(persona.id).espera.conexiones.granola });
    }],
    ['POST', /^\/api\/people\/([^/]+)\/checkins$/, ({ persona, cuerpo }) => {
      if (!['bien', 'normal', 'cansada', 'mal'].includes(cuerpo?.mood)) return error(400, 'El ánimo debe ser uno de: bien, normal, cansada, mal.');
      persona.checkin = cuerpo;
      return json(201, { ok: true, signals: senalesDe(persona) });
    }],
    ['POST', /^\/api\/people\/([^/]+)\/assistants\/pairings$/, ({ persona }) => {
      const codigo = secreto('enlace');
      enlaces.set(codigo, persona);
      return json(201, { code: codigo, path: `/a/${codigo}`, expiresAt: `${HOY}T23:00:00.000Z`, minutes: 15 });
    }],
    ['GET', /^\/a\/([^/]+)$/, ({ partes: [codigo] }) => {
      const persona = enlaces.get(codigo);
      if (!persona) return new Response('# Montu: this link is not valid', { status: 404, headers: { 'content-type': 'text/markdown; charset=utf-8' } });
      return new Response(`# Montu: join as ${persona.nombre}'s assistant\n\nPOST /api/assistants/join with the code ${codigo}.\n`, { status: 200, headers: { 'content-type': 'text/markdown; charset=utf-8' } });
    }],
    ['POST', /^\/api\/assistants\/join$/, ({ cuerpo }) => {
      const persona = enlaces.get(cuerpo?.code);
      if (!persona) return error(404, 'Ese código no existe. Pide un link nuevo a tu persona.');
      enlaces.delete(cuerpo.code);
      const acceso = secreto('asistente');
      asistentes.set(acceso, { persona, etiqueta: cuerpo.label });
      persona.asistentes.push(cuerpo.kind);
      anotar('asistente_conecta', { person: persona.publico, kind: cuerpo.kind });
      return json(201, { token: acceso, assistant: { id: `asistente-${asistentes.size}`, kind: cuerpo.kind, label: cuerpo.label, createdAt: `${HOY}T15:00:00.000Z`, lastSeenAt: null }, person: { name: persona.nombre } });
    }],
    ['POST', /^\/api\/repo\/commit$/, ({ cuerpo, cabeceras }) => {
      const asistente = asistentes.get((cabeceras.authorization ?? '').replace(/^Bearer /, ''));
      if (!asistente) return error(401, 'Ese asistente no existe.');
      if (!cuerpo?.message || !Array.isArray(cuerpo.topics) || !Array.isArray(cuerpo.files)) return error(422, 'Falta el mensaje o los archivos.');
      for (const archivo of cuerpo.files) asistente.persona.archivos.set(archivo.path, archivo.share ?? 'preguntar');
      anotar('repo_cambia', { person: asistente.persona.publico, files: asistente.persona.archivos.size });
      return json(201, { commit: { id: `cambio-${eventos.length}`, message: cuerpo.message }, files: asistente.persona.archivos.size });
    }],
    ['POST', /^\/api\/people\/([^/]+)\/repo\/paste$/, ({ persona, cuerpo }) => {
      if (!cuerpo?.kind) return error(400, 'Ese asistente no existe.');
      if (!cuerpo.content) return error(400, 'Falta la respuesta de tu asistente.');
      const ruta = `fuentes/${cuerpo.kind}/resumen.md`;
      persona.archivos.set(ruta, 'preguntar');
      persona.asistentes.push(cuerpo.kind);
      anotar('asistente_conecta', { person: persona.publico, kind: cuerpo.kind });
      return json(201, { commit: { id: `cambio-${eventos.length}` }, path: ruta });
    }],
    ['PATCH', /^\/api\/people\/([^/]+)\/repo\/file$/, ({ persona, cuerpo }) => {
      if (!persona.archivos.has(cuerpo?.path)) return error(404, 'Ese archivo no existe.');
      persona.archivos.set(cuerpo.path, cuerpo.share);
      return json(200, { path: cuerpo.path, share: cuerpo.share });
    }],
    ['GET', /^\/api\/people\/([^/]+)\/teams\/([^/]+)\/agents$/, ({ persona, partes: [, equipo] }) => (equipo === sala.equipo && sala.miembros.includes(persona) ? json(200, vistaDe(persona)) : error(403, 'No perteneces a ese equipo.'))],
    ['POST', /^\/api\/people\/([^/]+)\/teams\/([^/]+)\/agents\/rounds$/, ({ persona, partes: [, equipo], cuerpo }) => {
      if (equipo !== sala.equipo || !sala.miembros.includes(persona)) return error(403, 'No perteneces a ese equipo.');
      if (cuerpo !== undefined) return error(400, 'La ronda no lleva cuerpo.');
      if (opciones.sinModelo) return error(503, 'Faltan las credenciales del modelo en el servidor.');
      if (ronda?.status === 'en_curso') return error(409, 'Ya hay una ronda en curso en este equipo.');
      ronda = { id: 'ronda-1', status: 'en_curso', problem: null };
      fase = 0;
      llamadas.total += 18;
      llamadas.segundos += 40;
      anotar('ronda_empieza', { round: ronda.id });
      return json(202, { id: ronda.id, status: ronda.status, startedAt: `${HOY}T15:00:00.000Z` });
    }],
    ['POST', /^\/api\/people\/([^/]+)\/agents\/asks$/, ({ persona, cuerpo }) => {
      if (!cuerpo?.topic) return error(400, 'Falta el tema.');
      if (typeof cuerpo.allow !== 'boolean') return error(400, 'El permiso debe ser verdadero o falso.');
      if (cuerpo.allow) persona.permitidos.add(cuerpo.topic);
      return json(200, { topic: cuerpo.topic, allow: cuerpo.allow });
    }],
    ['POST', /^\/api\/people\/([^/]+)\/agents\/proposals\/([^/]+)\/answer$/, ({ persona, partes: [, id], cuerpo }) => {
      const propuesta = propuestas.find((una) => una.id === id);
      if (!propuesta) return error(404, 'Esa propuesta no existe.');
      const parte = propuesta.partes.find((una) => una.persona === persona);
      if (!parte) return error(403, 'Esa propuesta no es para ti.');
      if (!['acepta', 'rechaza'].includes(cuerpo?.answer)) return error(400, 'La respuesta debe ser acepta o rechaza.');
      if (estadoDe(propuesta) !== 'por_aprobar') return error(409, 'Esa propuesta ya está cerrada.');
      parte.answer = cuerpo.answer;
      return json(200, verPropuesta(propuesta, persona));
    }],
  ];

  const fetchImpl = async (direccion, init = {}) => {
    const { pathname, searchParams } = new URL(direccion);
    const metodo = init.method ?? 'GET';
    const cabeceras = Object.fromEntries(new Headers(init.headers ?? {}));
    const cuerpo = init.body === undefined ? undefined : JSON.parse(init.body);
    pedidos.push({ metodo, ruta: pathname, consulta: Object.fromEntries(searchParams), cabeceras, cuerpo, redirect: init.redirect });
    if (opciones.caido) throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    for (const [suyo, patron, responder] of rutas) {
      const partes = metodo === suyo ? patron.exec(pathname)?.slice(1) : undefined;
      if (!partes) continue;
      const deUnaPersona = pathname.startsWith('/api/people/') || pathname.startsWith('/api/ingest/');
      const persona = deUnaPersona ? personas.get(partes[0]) : undefined;
      if (deUnaPersona && !persona) return noValido();
      return responder({ partes, persona, cuerpo, cabeceras, consulta: Object.fromEntries(searchParams), redirect: init.redirect });
    }
    return new Response('<!doctype html><title>Montu</title>', { status: metodo === 'GET' ? 200 : 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  };

  const recorrido = (desde = 0) => pedidos.slice(desde).map((pedido) => `${pedido.metodo} ${visible(pedido.ruta)}`);
  const sinSecretos = (valor) => {
    const texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
    for (const uno of secretos) assert.ok(!texto.includes(uno), `Quedó un secreto a la vista en: ${visible(texto).slice(0, 200)}`);
  };
  return { fetchImpl, cliente: crearCliente({ base: `${BASE}/`, fetchImpl }), pedidos, secretos, personas, sala, eventos, propuestas, llamadas, porNombre, recorrido, sinSecretos, visible, estadoDe };
}

async function salaLlena(opciones = {}) {
  const demo = servidorDeMentira(opciones);
  const { cliente } = demo;
  const { codigo, ficha } = await abrirSala(cliente);
  const fichas = new Map([['antonia', ficha]]);
  await prepararElenco(cliente, { fichas });
  for (const paso of ['asistente', 'salud', 'google', 'granola', 'checkin', 'permitir']) await pasosDeAntonia[paso](cliente, ficha);
  for (const id of IDS.slice(1)) await entrar(cliente, codigo, fichas.get(id));
  return { ...demo, codigo, ficha, fichas };
}

async function conRonda(opciones = {}) {
  const demo = await salaLlena(opciones);
  await iniciarRonda(demo.cliente, demo.ficha);
  const espera = await esperarRonda(demo.cliente, demo.codigo, { cadaMs: 0 });
  return { ...demo, espera };
}

const fallaDe = async (promesa) => {
  try {
    await promesa;
  } catch (falla) {
    return falla;
  }
  return assert.fail('Tenía que fallar.');
};

test('el cliente habla JSON, entrega el texto que no es JSON y nunca deja una ficha en un error', async () => {
  const demo = servidorDeMentira();
  const { cliente } = demo;
  assert.deepEqual(Object.keys(cliente), ['base', 'api', 'conectarOAuth']);
  assert.equal(cliente.base, BASE);

  const { token: ficha } = await cliente.api('/api/people', { metodo: 'POST', cuerpo: { name: 'Antonia' } });
  assert.deepEqual(demo.pedidos.at(-1), { metodo: 'POST', ruta: '/api/people', consulta: {}, cabeceras: { 'content-type': 'application/json' }, cuerpo: { name: 'Antonia' }, redirect: undefined });
  assert.equal((await cliente.api(`/api/people/${ficha}/signals`)).name, 'Antonia');
  assert.deepEqual(demo.pedidos.at(-1).cabeceras, {});

  const enlace = await cliente.api(`/api/people/${ficha}/assistants/pairings`, { metodo: 'POST', cuerpo: {} });
  assert.match(await cliente.api(enlace.path), /^# Montu: join as Antonia's assistant/);
  const ingreso = await cliente.api('/api/assistants/join', { metodo: 'POST', cuerpo: { code: enlace.code, kind: 'claude-code', label: 'Claude Code en el MacBook' } });
  await cliente.api('/api/repo/commit', { metodo: 'POST', token: ingreso.token, cuerpo: { message: 'Primer contexto', topics: [], files: [] } });
  assert.equal(demo.pedidos.at(-1).cabeceras.authorization, `Bearer ${ingreso.token}`);

  const fallas = [
    await fallaDe(cliente.api(`/api/people/${ficha}/checkins`, { metodo: 'POST', cuerpo: { mood: 'eufórica' } })),
    await fallaDe(cliente.api(`/api/people/${ficha}x/signals?desde=${ficha}`)),
    await fallaDe(cliente.api(`/api/ingest/health/${ficha}`, { metodo: 'POST', cuerpo: {} })),
    await fallaDe(cliente.api(enlace.path.replace('/a/', '/a/x'))),
    await fallaDe(cliente.api('/api/repo/commit', { metodo: 'POST', token: `${ingreso.token}x`, cuerpo: {} })),
    await fallaDe(cliente.api(`/api/rooms/NADIE1/join`, { metodo: 'POST', cuerpo: { token: ficha } })),
  ];
  assert.deepEqual(fallas.map((falla) => [falla.message, falla.estado]), [
    ['POST /api/people/…/checkins respondió 400: El ánimo debe ser uno de: bien, normal, cansada, mal.', 400],
    ['GET /api/people/…/signals?… respondió 404: Link no válido.', 404],
    ['POST /api/ingest/health/… respondió 400: Falta el sueño.', 400],
    ['GET /a/… respondió 404', 404],
    ['POST /api/repo/commit respondió 401: Ese asistente no existe.', 401],
    ['POST /api/rooms/NADIE1/join respondió 404: Esa sala no existe.', 404],
  ]);
  for (const falla of fallas) demo.sinSecretos(`${falla.message}\n${falla.stack}`);

  const caido = servidorDeMentira({ caido: true });
  const sinServidor = await fallaDe(caido.cliente.api(`/api/people/${ficha}/signals`));
  assert.equal(sinServidor.message, `GET /api/people/…/signals no llegó al servidor de demo en ${BASE}: ECONNREFUSED`);

  assert.deepEqual(
    ['/api/people', `/api/people/${ficha}`, `/api/people/${ficha}/teams/team_1/agents`, `/api/ingest/health/${ficha}`, `/a/${enlace.code}`, `/conectar/${ficha}#tu`, '/api/rooms/QLL4Y7/events?since=3', `/api/oauth/google/callback?code=demo-antonia&state=${ficha}`].map(rutaSinFicha),
    ['/api/people', '/api/people/…', '/api/people/…/teams/team_1/agents', '/api/ingest/health/…', '/a/…', '/conectar/…#…', '/api/rooms/QLL4Y7/events?…', '/api/oauth/google/callback?…'],
  );
});

test('conectarOAuth manda las dos cabeceras, no sigue la redirección, devuelve la galleta y no nombra la ficha si vuelve con aviso', async () => {
  const demo = servidorDeMentira();
  const { cliente } = demo;
  const { token: ficha } = await cliente.api('/api/people', { metodo: 'POST', cuerpo: { name: 'Antonia' } });
  const desde = demo.pedidos.length;
  assert.equal(await cliente.conectarOAuth(ficha, 'google', 'antonia'), undefined);

  const [inicio, vuelta] = demo.pedidos.slice(desde);
  assert.equal(demo.pedidos.length, desde + 2);
  assert.deepEqual([inicio.metodo, inicio.ruta, inicio.redirect], ['GET', `/api/people/${ficha}/oauth/google/start`, 'manual']);
  assert.deepEqual(inicio.cabeceras, { 'sec-fetch-site': 'same-origin', origin: BASE });
  assert.deepEqual([vuelta.metodo, vuelta.ruta, vuelta.redirect], ['GET', '/api/oauth/google/callback', 'manual']);
  assert.deepEqual(Object.keys(vuelta.consulta), ['code', 'state']);
  assert.equal(vuelta.consulta.code, 'demo-antonia');
  assert.match(vuelta.consulta.state, /^sello-/);
  assert.match(vuelta.cabeceras.cookie, /^ronda_oauth_google=galleta-[\w-]+$/);
  assert.deepEqual(Object.keys(vuelta.cabeceras), ['cookie']);
  assert.deepEqual([...demo.personas.get(ficha).conexiones], [['google_calendar', 'antonia@ronda.example'], ['gmail', 'antonia@ronda.example']]);

  const conAviso = servidorDeMentira({ aviso: 'Google no aceptó la autorización de {ficha}. Vuelve a conectar tu cuenta.' });
  const { token: otra } = await conAviso.cliente.api('/api/people', { metodo: 'POST', cuerpo: { name: 'Antonia' } });
  const avisada = await fallaDe(conAviso.cliente.conectarOAuth(otra, 'google', 'antonia'));
  assert.equal(avisada.message, 'La vuelta del permiso de Google para antonia trajo un aviso: «Google no aceptó la autorización de …. Vuelve a conectar tu cuenta.»');
  conAviso.sinSecretos(`${avisada.message}\n${avisada.stack}`);
  assert.equal(conAviso.personas.get(otra).conexiones.size, 0);

  const codigoAjeno = await fallaDe(cliente.conectarOAuth(ficha, 'linear', 'nadie'));
  assert.equal(codigoAjeno.message, 'La vuelta del permiso de Linear para nadie trajo un aviso: «El proveedor no aceptó la autorización. Vuelve a conectar tu cuenta.»');

  const sinPagina = servidorDeMentira({ sinPagina: true });
  const { token: tercera } = await sinPagina.cliente.api('/api/people', { metodo: 'POST', cuerpo: { name: 'Ignacio' } });
  const rechazada = await fallaDe(sinPagina.cliente.conectarOAuth(tercera, 'github', 'ignacio'));
  assert.equal(rechazada.message, 'El inicio del permiso de GitHub para ignacio respondió 403 y se esperaba 302: Abre la conexión desde tu página de Montu.');
  assert.equal(sinPagina.pedidos.length, 2);

  const fallas = [
    await fallaDe(cliente.conectarOAuth(`${ficha}x`, 'google', 'antonia')),
    await fallaDe(cliente.conectarOAuth(ficha, 'gitlab', 'antonia')),
    await fallaDe(servidorDeMentira({ caido: true }).cliente.conectarOAuth(ficha, 'google', 'antonia')),
  ];
  assert.deepEqual(fallas.map((falla) => falla.message), [
    'El inicio del permiso de Google para antonia respondió 404 y se esperaba 302: Link no válido.',
    'El inicio del permiso de gitlab para antonia respondió 400 y se esperaba 302: Ese proveedor no existe.',
    `GET /api/people/…/oauth/google/start no llegó al servidor de demo en ${BASE}: ECONNREFUSED`,
  ]);
  for (const falla of [avisada, codigoAjeno, rechazada, ...fallas]) demo.sinSecretos(`${falla.message}\n${falla.stack}`);

  const sinEstado = crearCliente({ base: BASE, fetchImpl: async () => new Response(null, { status: 302, headers: { location: '/demo/permiso/google' } }) });
  assert.equal((await fallaDe(sinEstado.conectarOAuth(ficha, 'google', 'antonia'))).message, 'El inicio del permiso de Google para antonia no entregó estado y galleta.');
  const aOtraPagina = crearCliente({
    base: BASE,
    fetchImpl: async (direccion) => new Response(null, { status: 302, headers: String(direccion).includes('/start') ? [['location', 'https://cuentas.example/permiso?state=sello'], ['set-cookie', 'ronda_oauth_google=galleta; Path=/']] : [['location', '/conectar/otra-persona']] }),
  });
  assert.equal((await fallaDe(aOtraPagina.conectarOAuth(ficha, 'google', 'antonia'))).message, 'La vuelta del permiso de Google para antonia no terminó en la página de la persona.');
});

test('crearYConectar llama las rutas en el orden del contrato y deja a la persona fuera de la sala', async () => {
  const demo = servidorDeMentira();
  const { cliente } = demo;
  await abrirSala(cliente);
  const lineas = [];
  const anotar = (linea) => void lineas.push(linea);
  const conectar = async (id) => {
    const desde = demo.pedidos.length;
    const ficha = await crearYConectar(cliente, porId(id), { anotar });
    return { ficha, persona: demo.personas.get(ficha), recorrido: demo.recorrido(desde), pedidos: demo.pedidos.slice(desde) };
  };

  const catalina = await conectar('catalina');
  assert.deepEqual(catalina.recorrido, [
    'POST /api/people',
    ...Array.from({ length: 11 }, () => 'POST /api/ingest/health/…'),
    'GET /api/people/…/oauth/google/start',
    'GET /api/oauth/google/callback',
    'GET /api/people/…/oauth/linear/start',
    'GET /api/oauth/linear/callback',
    'POST /api/people/…/connections/granola',
    'POST /api/people/…/assistants/pairings',
    'GET /a/…',
    'POST /api/assistants/join',
    'POST /api/repo/commit',
  ]);
  assert.deepEqual(catalina.pedidos[0].cuerpo, { name: 'Catalina' });
  assert.deepEqual(catalina.pedidos.slice(1, 12).map((pedido) => pedido.cuerpo), porId('catalina').salud);
  assert.deepEqual(catalina.pedidos[13].consulta.code, 'demo-catalina');
  assert.deepEqual(catalina.pedidos[16].cuerpo, { secret: 'grn_demo_catalina' });
  assert.deepEqual(catalina.pedidos[17].cuerpo, {});
  assert.deepEqual(Object.keys(catalina.pedidos[19].cuerpo), ['code', 'kind', 'label']);
  assert.deepEqual([catalina.pedidos[19].cuerpo.kind, catalina.pedidos[19].cuerpo.label], ['cursor', 'Cursor']);
  assert.match(catalina.pedidos[20].cabeceras.authorization, /^Bearer asistente-/);
  assert.deepEqual(catalina.pedidos[20].cuerpo, { message: 'Primer contexto de Catalina', topics: [], files: JSON.parse(JSON.stringify(porId('catalina').repo.archivos)) });
  assert.deepEqual([...catalina.persona.archivos], [['README.md', 'siempre'], ['ahora.md', 'siempre'], ['sabe.md', 'siempre'], ['estado.md', 'preguntar']]);
  assert.deepEqual([...catalina.persona.conexiones.keys()], ['google_calendar', 'gmail', 'linear', 'granola']);

  const felipe = await conectar('felipe');
  assert.deepEqual(felipe.recorrido, ['POST /api/people', 'POST /api/people/…/checkins', 'POST /api/people/…/assistants/pairings', 'GET /a/…', 'POST /api/assistants/join', 'POST /api/repo/commit']);
  assert.deepEqual(felipe.pedidos[1].cuerpo, { mood: 'cansada' });

  const fernanda = await conectar('fernanda');
  assert.deepEqual(fernanda.recorrido, ['POST /api/people', 'POST /api/people/…/checkins', 'POST /api/people/…/repo/paste', 'PATCH /api/people/…/repo/file']);
  assert.deepEqual(fernanda.pedidos[2].cuerpo, { kind: 'grok', content: porId('fernanda').repo.pegado });
  assert.deepEqual(fernanda.pedidos[3].cuerpo, { path: 'fuentes/grok/resumen.md', share: 'siempre' });

  const martina = await conectar('martina');
  assert.deepEqual(martina.recorrido, ['POST /api/people', 'POST /api/people/…/repo/paste']);
  assert.deepEqual([...martina.persona.archivos], [['fuentes/gemini/resumen.md', 'preguntar']]);

  const sebastian = await conectar('sebastian');
  assert.deepEqual(sebastian.recorrido, ['POST /api/people', 'POST /api/people/…/checkins']);
  const ignacio = await conectar('ignacio');
  assert.deepEqual(ignacio.recorrido.slice(0, 5), ['POST /api/people', 'GET /api/people/…/oauth/github/start', 'GET /api/oauth/github/callback', 'GET /api/people/…/oauth/linear/start', 'GET /api/oauth/linear/callback']);

  assert.deepEqual(demo.sala.miembros.map((persona) => persona.nombre), ['Antonia']);
  assert.deepEqual(lineas, [
    'Catalina · Apple Health · 11 envíos',
    'Catalina · permiso simulado de Google y Linear',
    'Catalina · Granola con llave · 2 registros',
    'Catalina · Cursor por link · 4 archivos',
    'Felipe · check-in cansada',
    'Felipe · OpenClaw por link · 4 archivos',
    'Fernanda · check-in bien',
    'Fernanda · Grok pegado y compartido',
    'Martina · Gemini pegado, sin compartir',
    'Sebastián · check-in normal',
    'Sebastián · sin agente todavía',
    'Ignacio · permiso simulado de GitHub y Linear',
    'Ignacio · Codex por link · 4 archivos',
  ]);
  demo.sinSecretos(lineas);
  assert.equal(await crearYConectar(cliente, porId('cristobal')), [...demo.personas.keys()].at(-1));
});

test('abrirSala y prepararElenco dejan a Antonia adentro y a las otras nueve creadas, conectadas y afuera', async () => {
  const demo = servidorDeMentira();
  const { cliente } = demo;
  const { codigo, ficha } = await abrirSala(cliente);
  assert.deepEqual(demo.recorrido(), ['POST /api/rooms', 'POST /api/rooms/QLL4Y7/join']);
  assert.deepEqual(demo.pedidos.map((pedido) => pedido.cuerpo), [{ name: SALA }, { name: 'Antonia' }]);
  assert.deepEqual([codigo, demo.personas.get(ficha).nombre], ['QLL4Y7', 'Antonia']);

  const fichas = await prepararElenco(cliente);
  assert.deepEqual([...fichas.keys()], IDS.slice(1));
  assert.deepEqual([...fichas.values()].map((una) => demo.personas.get(una).nombre), ELENCO.slice(1).map((persona) => persona.nombre));
  assert.deepEqual(demo.sala.miembros.map((persona) => persona.nombre), ['Antonia']);
  assert.deepEqual(await verificar(cliente, fichas), []);
  assert.deepEqual(await verificar(cliente, fichas, ['catalina', 'ignacio']), []);

  const propias = new Map([['antonia', ficha]]);
  assert.equal(await prepararElenco(cliente, { fichas: propias }), propias);
  assert.deepEqual([...propias.keys()], IDS);

  for (const paso of ['asistente', 'salud', 'google', 'granola', 'checkin', 'permitir']) await pasosDeAntonia[paso](cliente, ficha);
  fichas.set('antonia', ficha);
  assert.deepEqual(await verificar(cliente, fichas, IDS), []);

  assert.deepEqual((await verificarSala(cliente, codigo)).map((linea) => linea.split(' · ').slice(0, 2).join(' · ')), ['sala · orden de entrada']);
  for (const id of IDS.slice(1)) assert.deepEqual(await entrar(cliente, codigo, fichas.get(id)), { nombre: porId(id).nombre, sala: SALA });
  assert.deepEqual(demo.pedidos.at(-1).cuerpo, { token: fichas.get('sebastian') });
  assert.deepEqual(demo.sala.miembros.map((persona) => persona.nombre), ELENCO.map((persona) => persona.nombre));
  assert.deepEqual(await verificarSala(cliente, codigo), []);
  assert.equal(await equipoDe(cliente, ficha), 'team_quillay');

  const { token: suelta } = await cliente.api('/api/people', { metodo: 'POST', cuerpo: { name: 'Elisa' } });
  assert.equal((await fallaDe(equipoDe(cliente, suelta))).message, 'Esa persona todavía no está en una sala.');
  assert.equal((await fallaDe(iniciarRonda(cliente, suelta))).message, 'Quien inicia la ronda todavía no está en una sala.');
  assert.equal((await fallaDe(entrar(cliente, codigo, `${suelta}x`))).message, 'POST /api/rooms/QLL4Y7/join respondió 404: Link no válido.');
});

test('verificar dice cada diferencia con su campo, lo esperado y lo real, y entrega una lista vacía cuando todo calza', async () => {
  const alterada = (cambios) => async (ids) => {
    const demo = await salaLlena(cambios);
    return verificar(demo.cliente, demo.fichas, ids);
  };
  assert.deepEqual(await alterada({})(IDS), []);

  const senales = (id, cambio) => ({ senales: (suya, propias) => (suya === id ? cambio(propias) : propias) });
  const pagina = (id, cambio) => ({ pagina: (suya, propia) => (suya === id ? cambio(propia) : propia) });
  const fuente = (propia, id) => propia.sources.find((una) => una.id === id);

  assert.deepEqual(await alterada(senales('catalina', (propias) => ({ ...propias, load: { ...propias.load, level: 'media' } })))(IDS), ['catalina · load.level · esperado alta · real media']);
  assert.deepEqual(await alterada(senales('catalina', (propias) => ({ ...propias, load: { level: 'media', statement: 'Carga media hoy', basis: ['google_calendar', 'granola'] } })))(['catalina']), [
    'catalina · load.level · esperado alta · real media',
    'catalina · load.statement · esperado Carga alta hoy · real Carga media hoy',
    'catalina · load.basis · esperado google_calendar, granola, linear · real google_calendar, granola',
  ]);
  assert.deepEqual(await alterada(senales('catalina', (propias) => ({ ...propias, energy: { level: 'baja', statement: 'Energía baja hoy', basis: [] } })))(['catalina']), [
    'catalina · energy.statement · esperado Energía baja esta semana · real Energía baja hoy',
    'catalina · energy.basis · esperado apple_health · real nada',
  ]);
  assert.deepEqual(await alterada(senales('nicolas', (propias) => ({ ...propias, load: { ...propias.load, basis: ['granola', 'google_calendar'] } })))(['nicolas']), ['nicolas · load.basis · esperado google_calendar · real granola, google_calendar']);
  assert.deepEqual(await alterada(senales('felipe', ({ energy, ...resto }) => resto))(['felipe']), [
    'felipe · energy.level · esperado baja · real sin dato',
    'felipe · energy.statement · esperado Energía baja hoy · real sin dato',
    'felipe · energy.basis · esperado checkin · real sin dato',
  ]);

  assert.deepEqual(await alterada(senales('ignacio', (propias) => ({ ...propias, blockers: [] })))(['ignacio']), [
    'ignacio · bloqueos · esperado Sin avances en «Conciliación de cobros con el banco» desde hace 4 días [linear, siempre] · real nada',
  ]);
  assert.deepEqual(await alterada(senales('ignacio', (propias) => ({ ...propias, blockers: [{ ...propias.blockers[0], statement: 'Sin avances en «Conciliación de cobros con el banco» desde hace 3 días' }] })))(['ignacio']), [
    'ignacio · bloqueos · esperado Sin avances en «Conciliación de cobros con el banco» desde hace 4 días [linear, siempre] · real Sin avances en «Conciliación de cobros con el banco» desde hace 3 días [linear, siempre]',
  ]);
  assert.deepEqual(await alterada(senales('antonia', (propias) => ({ ...propias, blockers: [{ ...propias.blockers[0], visibility: 'siempre' }] })))(['antonia']), [
    'antonia · bloqueos · esperado Bloqueo en «guion y ensayo del pitch» desde hoy [checkin, preguntar] · real Bloqueo en «guion y ensayo del pitch» desde hoy [checkin, siempre]',
  ]);
  assert.deepEqual(await alterada(senales('catalina', (propias) => ({ ...propias, blockers: [{ topic: 'x', statement: 'Bloqueo en «x» desde hoy', source: 'checkin', visibility: 'preguntar' }] })))(['catalina']), [
    'catalina · bloqueos · esperado nada · real Bloqueo en «x» desde hoy [checkin, preguntar]',
  ]);

  assert.deepEqual(await alterada(senales('ignacio', (propias) => ({ ...propias, expertise: ['pagos-api', 'alertas', 'webhooks'] })))(['ignacio']), ['ignacio · temas · esperado webhook · real pagos-api, alertas, webhooks']);
  assert.deepEqual(await alterada(senales('cristobal', ({ expertise, ...resto }) => resto))(['cristobal']), [
    'cristobal · temas · esperado globo-canvas · real nada',
    'cristobal · temas · esperado arcos · real nada',
    'cristobal · temas · esperado canvas · real nada',
  ]);

  const conTotal = (id, total) => (propia) => {
    fuente(propia, id).sync = total === 0 ? null : { last: 'antes', total };
    return propia;
  };
  assert.deepEqual(await alterada(pagina('catalina', conTotal('gmail', 5)))(IDS), ['catalina · conexiones.gmail.total · esperado 6 · real 5']);
  assert.deepEqual(await alterada(pagina('catalina', conTotal('linear', 0)))(['catalina']), ['catalina · conexiones.linear.total · esperado 3 · real 0']);
  assert.deepEqual(
    await alterada(pagina('catalina', (propia) => {
      fuente(propia, 'google_calendar').connection.lastError = 'Google dio por vencido el acceso. Vuelve a conectar tu cuenta.';
      return propia;
    }))(['catalina']),
    ['catalina · conexiones.google_calendar.lastError · esperado null · real Google dio por vencido el acceso. Vuelve a conectar tu cuenta.'],
  );
  assert.deepEqual(
    await alterada(pagina('ignacio', (propia) => {
      fuente(propia, 'github').connection = null;
      return propia;
    }))(['ignacio']),
    ['ignacio · conexiones.github · esperado conectada · real sin conectar'],
  );
  assert.deepEqual(await alterada(pagina('ignacio', (propia) => ({ ...propia, sources: propia.sources.filter((una) => una.id !== 'linear') })))(['ignacio']), ['ignacio · conexiones.linear · esperado conectada · real sin conectar']);
  assert.deepEqual(
    await alterada(pagina('nicolas', (propia) => {
      fuente(propia, 'github').connection = { account: 'nicolas-demo', lastSyncedAt: null, lastError: null };
      return propia;
    }))(['nicolas']),
    ['nicolas · conexiones.github · esperado sin conectar · real conectada'],
  );
  assert.deepEqual(
    await alterada(pagina('martina', (propia) => {
      fuente(propia, 'linear').configured = false;
      return propia;
    }))(['martina']),
    ['martina · fuentes.linear.configured · esperado true · real false'],
  );

  const demo = await salaLlena();
  assert.deepEqual(await verificar(demo.cliente, new Map([['catalina', demo.fichas.get('catalina')]]), ['catalina', 'ignacio', 'elisa']), [
    'ignacio · persona · esperado en el elenco y con ficha · real sin ficha',
    'elisa · persona · esperado en el elenco y con ficha · real fuera del elenco',
  ]);
  const cruzadas = new Map([['catalina', demo.fichas.get('felipe')]]);
  const deOtra = await verificar(demo.cliente, cruzadas, ['catalina']);
  assert.ok(deOtra.includes('catalina · energy.statement · esperado Energía baja esta semana · real Energía baja hoy') && deOtra.includes('catalina · conexiones.gmail · esperado conectada · real sin conectar'));
  demo.sinSecretos(deOtra);

  const desordenada = servidorDeMentira();
  const { codigo, ficha } = await abrirSala(desordenada.cliente);
  const fichas = await prepararElenco(desordenada.cliente);
  for (const id of ['javiera', 'ignacio']) await entrar(desordenada.cliente, codigo, fichas.get(id));
  desordenada.porNombre('Ignacio').asistentes.push('claude');
  await pasosDeAntonia.asistente(desordenada.cliente, ficha);
  assert.deepEqual(await verificarSala(desordenada.cliente, codigo), [
    `sala · orden de entrada · esperado ${ELENCO.map((persona) => persona.nombre).join(', ')} · real Antonia, Javiera, Ignacio`,
    'ignacio · asistentes · esperado codex · real codex, claude',
  ]);
  await iniciarRonda(desordenada.cliente, ficha);
  assert.equal((await verificarSala(desordenada.cliente, codigo)).at(-1), 'sala · ronda · esperado ninguna · real en_curso');
});

test('comprobarServidor exige el día de Santiago y la ronda automática apagada', async () => {
  const estado = await comprobarServidor(servidorDeMentira().cliente);
  assert.deepEqual([estado.hoy, estado.rondaSola, estado.commit, estado.llamadas.total], [HOY, false, 'abc1234', 1]);
  const ayer = diaMas(HOY, -1);
  assert.equal((await fallaDe(comprobarServidor(servidorDeMentira({ hoy: ayer }).cliente))).message, `El servidor de demo partió el ${ayer} y hoy en Santiago es ${HOY}. Reinícialo con un DATA_DIR nuevo.`);
  assert.equal((await fallaDe(comprobarServidor(servidorDeMentira({ rondaSola: true }).cliente))).message, 'El servidor de demo tiene encendida la ronda automática: rondaSola no es false.');
  assert.equal((await fallaDe(comprobarServidor(servidorDeMentira({ sinDemo: true }).cliente))).message, `${BASE}/demo/estado no respondió JSON. Ahí tiene que estar el servidor de demo, no el del producto.`);
  assert.match((await fallaDe(comprobarServidor(servidorDeMentira({ caido: true }).cliente))).message, /^GET \/demo\/estado no llegó al servidor de demo/);
});

test('los pasos de Antonia por API: asistente, sueño, Google, Granola, check-in y permiso, en ese orden', async () => {
  const demo = servidorDeMentira();
  const { cliente } = demo;
  const { ficha } = await abrirSala(cliente);
  const antonia = demo.personas.get(ficha);
  const desde = demo.pedidos.length;
  const vistos = [];

  assert.deepEqual(Object.keys(pasosDeAntonia), ['asistente', 'salud', 'google', 'granola', 'checkin', 'permitir']);
  assert.deepEqual(await pasosDeAntonia.asistente(cliente, ficha, { alPaso: (paso, detalle) => void vistos.push([paso, detalle]) }), { archivos: 4 });
  assert.deepEqual(vistos, [
    ['lee', { titulo: "Montu: join as Antonia's assistant", kb: 0.1 }],
    ['entra', { tipo: 'claude-code', etiqueta: 'Claude Code en el MacBook' }],
    ['escribe', { mensaje: 'Primer contexto de Antonia', archivos: ['README.md', 'ahora.md', 'sabe.md', 'estado.md'], total: 4 }],
  ]);
  demo.sinSecretos(vistos);
  assert.deepEqual(await pasosDeAntonia.salud(cliente, ficha), { envios: 1, resumen: 'sueño 6.4 h' });
  assert.deepEqual(demo.pedidos.at(-1).cuerpo, { sleep_hours: '23040,5' });
  assert.equal((await fallaDe(dosGuardados(cliente, ficha))).message, 'No quedó guardado un correo y una reunión para mostrar.');
  assert.equal(await pasosDeAntonia.google(cliente, ficha), undefined);
  assert.deepEqual(await dosGuardados(cliente, ficha), { correo: 'Agenda del comité de producto · de Elisa Carrasco', reunion: 'Comité de producto · 90 min · 4 asistentes' });
  assert.deepEqual(await pasosDeAntonia.granola(cliente, ficha), { cuenta: 'antonia@ronda.example', registros: 2 });
  assert.equal((await fallaDe(pasosDeAntonia.permitir(cliente, ficha))).message, 'El agente de Antonia no preguntó por «guion y ensayo del pitch».');
  assert.deepEqual(await pasosDeAntonia.checkin(cliente, ficha), { mood: 'normal', blocker: 'guion y ensayo del pitch' });
  assert.deepEqual(await pasosDeAntonia.permitir(cliente, ficha), { tema: 'guion y ensayo del pitch' });
  assert.deepEqual(demo.pedidos.at(-1).cuerpo, { topic: 'guion y ensayo del pitch', allow: true });
  assert.deepEqual([...antonia.permitidos], ['guion y ensayo del pitch']);
  assert.equal((await fallaDe(pasosDeAntonia.permitir(cliente, ficha))).message, 'El agente de Antonia no preguntó por «guion y ensayo del pitch».');

  assert.deepEqual(demo.recorrido(desde).filter((linea) => !/\/events$|\/teams$|\/agents$/.test(linea)), [
    'POST /api/people/…/assistants/pairings',
    'GET /a/…',
    'POST /api/assistants/join',
    'POST /api/repo/commit',
    'POST /api/ingest/health/…',
    'GET /api/people/…/oauth/google/start',
    'GET /api/oauth/google/callback',
    'POST /api/people/…/connections/granola',
    'POST /api/people/…/checkins',
    'POST /api/people/…/agents/asks',
  ]);
  assert.deepEqual(await verificar(cliente, new Map([['antonia', ficha]]), ['antonia']), []);
});

test('iniciarRonda solo parte la primera ronda y esperarRonda reparte sus eventos hasta que termina', async () => {
  const demo = await salaLlena();
  const { cliente, codigo, ficha } = demo;
  const previos = demo.eventos.length;
  assert.ok(previos > EVENTOS_POR_LECTURA * 4);

  assert.deepEqual(await iniciarRonda(cliente, ficha), { id: 'ronda-1', estado: 'en_curso' });
  assert.deepEqual(demo.recorrido(-3), ['GET /api/people/…/teams', 'GET /api/rooms/QLL4Y7/state', 'POST /api/people/…/teams/team_quillay/agents/rounds']);
  assert.equal(demo.pedidos.at(-1).cuerpo, undefined);

  const vistos = [];
  const desde = demo.pedidos.length;
  const espera = await esperarRonda(cliente, codigo, {
    cadaMs: 0,
    alEvento: async (evento, nombres) => {
      await null;
      vistos.push(`${evento.type} ${[evento.payload.from, evento.payload.to].filter(Boolean).map((id) => nombres.get(id)).join('>')}${evento.payload.help ? ` ${evento.payload.help}` : ''}`);
    },
  });
  assert.deepEqual(vistos, [
    'ronda_empieza ',
    'hilo_abre Antonia>Fernanda',
    'hilo_abre Antonia>Nicolás',
    'hilo_abre Ignacio>Catalina',
    'hilo_abre Javiera>Cristóbal',
    'hilo_abre Javiera>Felipe',
    'hilo_responde Antonia>Fernanda si',
    'hilo_responde Antonia>Nicolás si',
    'hilo_responde Ignacio>Catalina no',
    'hilo_responde Javiera>Cristóbal si',
    'hilo_responde Javiera>Felipe no',
    'propuesta_nace Antonia',
    'propuesta_nace Javiera',
    'ronda_termina ',
  ]);
  assert.deepEqual([espera.estado.round, espera.estado.threads.length, espera.vencio], [{ id: 'ronda-1', status: 'lista' }, 5, false]);
  assert.equal(espera.segundos, 2.6);
  assert.equal(espera.segundos, ((vistos.length - 1) * ENTRE_EVENTOS_MS) / 1000);
  const lecturas = demo.pedidos.slice(desde);
  assert.equal(lecturas.filter((pedido) => pedido.ruta.endsWith('/state')).length, 3);
  assert.deepEqual(lecturas.filter((pedido) => pedido.ruta.endsWith('/events')).map((pedido) => Number(pedido.consulta.since)).slice(0, 3), [0, EVENTOS_POR_LECTURA, EVENTOS_POR_LECTURA * 2]);
  assert.equal(demo.eventos.length, previos + vistos.length);
  assert.equal((await fallaDe(iniciarRonda(cliente, ficha))).message, 'La sala ya tiene una ronda (lista). El guion solo inicia la primera.');

  const repetida = await esperarRonda(cliente, codigo, { cadaMs: 0 });
  assert.deepEqual([repetida.estado.round.status, repetida.segundos, repetida.vencio], ['lista', espera.segundos, false]);

  const sinFin = await salaLlena({ libreto: { sinFin: true } });
  await iniciarRonda(sinFin.cliente, sinFin.ficha);
  const vencida = await esperarRonda(sinFin.cliente, sinFin.codigo, { cadaMs: 1, limiteMs: 15 });
  assert.deepEqual([vencida.estado.round.status, vencida.vencio], ['en_curso', true]);
  assert.ok(vencida.segundos < 5);

  const sinPartir = await salaLlena();
  const quieta = await esperarRonda(sinPartir.cliente, sinPartir.codigo, { cadaMs: 1, limiteMs: 10, alEvento: () => assert.fail('Sin ronda no hay eventos que repartir.') });
  assert.deepEqual([quieta.estado.round, quieta.vencio], [null, true]);

  const sinModelo = await salaLlena({ sinModelo: true });
  assert.equal((await fallaDe(iniciarRonda(sinModelo.cliente, sinModelo.ficha))).message, 'POST /api/people/…/teams/team_quillay/agents/rounds respondió 503: Faltan las credenciales del modelo en el servidor.');
});

test('leerResultado arma pedidos, hilos y propuestas con los mensajes de la vista de cada parte', async () => {
  const demo = await conRonda();
  const { cliente, codigo, fichas } = demo;
  const desde = demo.pedidos.length;
  const resultado = await leerResultado(cliente, codigo, fichas);
  const mensajes = (pide, ayuda) => [
    { de: pide, texto: `Mensaje del agente de ${pide} al de ${ayuda}.` },
    { de: ayuda, texto: `Respuesta del agente de ${ayuda} al de ${pide}.` },
  ];
  assert.deepEqual(resultado, {
    ronda: { status: 'lista', problem: null },
    hilos: 5,
    pedidos: [
      {
        pide: 'Antonia',
        tema: TEMA.Antonia,
        hilos: [{ ayuda: 'Fernanda', help: 'si', mensajes: mensajes('Antonia', 'Fernanda') }, { ayuda: 'Nicolás', help: 'si', mensajes: mensajes('Antonia', 'Nicolás') }],
        propuesta: { id: 'prop-1', texto: 'Fernanda y Nicolás con Antonia.', estado: 'por_aprobar', ayudantes: ['Fernanda', 'Nicolás'] },
      },
      { pide: 'Ignacio', tema: TEMA.Ignacio, hilos: [{ ayuda: 'Catalina', help: 'no', mensajes: mensajes('Ignacio', 'Catalina') }], propuesta: null },
      {
        pide: 'Javiera',
        tema: TEMA.Javiera,
        hilos: [{ ayuda: 'Cristóbal', help: 'si', mensajes: mensajes('Javiera', 'Cristóbal') }, { ayuda: 'Felipe', help: 'no', mensajes: mensajes('Javiera', 'Felipe') }],
        propuesta: { id: 'prop-2', texto: 'Cristóbal con Javiera.', estado: 'por_aprobar', ayudantes: ['Cristóbal'] },
      },
    ],
  });
  assert.deepEqual(demo.recorrido(desde), ['GET /api/rooms/QLL4Y7/state', 'GET /api/people/…/teams', ...Array.from({ length: 3 }, () => 'GET /api/people/…/teams/team_quillay/agents')]);
  demo.sinSecretos(resultado);
  assert.equal(elegirVariante(resultado).variante, 'V1');

  const alReves = new Map([...fichas].reverse());
  assert.deepEqual(await leerResultado(cliente, codigo, alReves), resultado);
  const sinIgnacio = new Map([...fichas].filter(([id]) => id !== 'ignacio'));
  assert.deepEqual((await leerResultado(cliente, codigo, sinIgnacio)).pedidos[1], { pide: 'Ignacio', tema: TEMA.Ignacio, hilos: [{ ayuda: 'Catalina', help: 'no', mensajes: [] }], propuesta: null });

  const fallida = await conRonda({ libreto: { estado: 'fallida', problema: 'El modelo no respondió.', respuestas: { ...LIBRETO.respuestas, 'Javiera>Felipe': undefined } } });
  const conProblema = await leerResultado(fallida.cliente, fallida.codigo, fallida.fichas);
  assert.deepEqual(conProblema.ronda, { status: 'fallida', problem: 'El modelo no respondió.' });
  assert.deepEqual(conProblema.pedidos[2].hilos[1], { ayuda: 'Felipe', help: null, mensajes: [{ de: 'Javiera', texto: 'Mensaje del agente de Javiera al de Felipe.' }] });
  assert.deepEqual([elegirVariante(conProblema).variante, elegirVariante(conProblema).motivo], ['retoma', 'G1: la ronda quedó «fallida»: El modelo no respondió.']);

  const sinRonda = await salaLlena();
  assert.deepEqual(await leerResultado(sinRonda.cliente, sinRonda.codigo, sinRonda.fichas), { ronda: { status: 'sin_ronda', problem: null }, hilos: 0, pedidos: [] });
  assert.deepEqual([elegirVariante({ ronda: { status: 'sin_ronda', problem: null }, hilos: 0, pedidos: [] }).variante, elegirVariante({ ronda: { status: 'sin_ronda', problem: null }, hilos: 0, pedidos: [] }).motivo], [
    'retoma',
    'G0: los pedidos son de nadie; se esperaba uno de Antonia, Ignacio y Javiera.',
  ]);
});

const hilo = (ayuda, help, textos = ['Hola.', 'Listo.']) => ({ ayuda, help, mensajes: [{ de: 'quien pide', texto: textos[0] }, ...(help === null ? [] : [{ de: ayuda, texto: textos[1] }])] });
const propuesta = (id, ayudantes) => ({ id, texto: `${enLista(ayudantes)} ayudan.`, estado: 'por_aprobar', ayudantes });
const SIN_HILO = 'sin hilo';

function resultadoCon({ catalina = 'no', felipe = 'no', fernanda = 'si', nicolas = 'si', deAntonia = undefined, deIgnacio = null, otros = [], ronda = { status: 'lista', problem: null } } = {}) {
  const ayudan = [fernanda === 'si' ? 'Fernanda' : null, nicolas === 'si' ? 'Nicolás' : null].filter(Boolean);
  const pedidos = [
    { pide: 'Antonia', tema: TEMA.Antonia, hilos: [hilo('Fernanda', fernanda), hilo('Nicolás', nicolas)], propuesta: deAntonia === undefined ? (ayudan.length > 0 ? propuesta('prop-antonia', ayudan) : null) : deAntonia },
    { pide: 'Ignacio', tema: TEMA.Ignacio, hilos: catalina === SIN_HILO ? [hilo('Nicolás', 'no')] : [hilo('Catalina', catalina)], propuesta: deIgnacio },
    { pide: 'Javiera', tema: TEMA.Javiera, hilos: [hilo('Cristóbal', 'si'), ...(felipe === SIN_HILO ? [] : [hilo('Felipe', felipe)])], propuesta: propuesta('prop-javiera', ['Cristóbal']) },
    ...otros,
  ];
  return { ronda, hilos: pedidos.reduce((total, pedido) => total + pedido.hilos.length, 0), pedidos };
}

const PASAN = { G0: true, G1: true, G2: true, G2b: true, G3: true };

test('elegirVariante: las ocho situaciones del guion, solo con comparaciones exactas', () => {
  assert.deepEqual(elegirVariante(resultadoCon()), {
    variante: 'V1',
    motivo: 'El agente de Catalina le respondió «no» al de Ignacio.',
    quien: 'catalina',
    pide: 'ignacio',
    ayudantesDeAntonia: 2,
    propuestaDeIgnacio: null,
    puertas: PASAN,
  });

  assert.deepEqual(elegirVariante(resultadoCon({ catalina: 'parcial', deIgnacio: propuesta('prop-ignacio', ['Catalina']) })), {
    variante: 'V2',
    motivo: 'Catalina no respondió «no»; el agente de Felipe le respondió «no» al de Javiera.',
    quien: 'felipe',
    pide: 'javiera',
    ayudantesDeAntonia: 2,
    propuestaDeIgnacio: null,
    puertas: PASAN,
  });

  const soloOrientan = resultadoCon({ catalina: 'parcial', felipe: 'parcial', deIgnacio: propuesta('prop-ignacio', ['Catalina']) });
  assert.deepEqual(elegirVariante(soloOrientan, { parcialVale: true }), {
    variante: 'V3',
    motivo: 'Nadie respondió «no»; el agente de Catalina le respondió «parcial» al de Ignacio y esta toma lo acepta.',
    quien: 'catalina',
    pide: 'ignacio',
    ayudantesDeAntonia: 2,
    propuestaDeIgnacio: 'prop-ignacio',
    puertas: PASAN,
  });
  assert.deepEqual(elegirVariante(soloOrientan), {
    variante: 'retoma',
    motivo: 'G3: nadie respondió «no» y el agente de Catalina respondió «parcial»; eso solo vale con --parcial-vale.',
    quien: null,
    pide: null,
    ayudantesDeAntonia: 2,
    propuestaDeIgnacio: null,
    puertas: { ...PASAN, G3: false },
  });
  assert.deepEqual(elegirVariante(soloOrientan, {}), elegirVariante(soloOrientan, { parcialVale: false }));

  const conCuarta = elegirVariante(resultadoCon({ otros: [{ pide: 'Fernanda', tema: 'fotos de la campaña', hilos: [hilo('Nicolás', 'si')], propuesta: propuesta('prop-fernanda', ['Nicolás']) }] }));
  assert.deepEqual([conCuarta.variante, conCuarta.motivo, conCuarta.quien, conCuarta.pide, conCuarta.puertas], [
    'retoma',
    'G0: los pedidos son de Antonia, Ignacio, Javiera y Fernanda; se esperaba uno de Antonia, Ignacio y Javiera.',
    null,
    null,
    { ...PASAN, G0: false },
  ]);

  const sinRespuesta = elegirVariante(resultadoCon({ felipe: null }));
  assert.deepEqual([sinRespuesta.variante, sinRespuesta.motivo, sinRespuesta.puertas], ['retoma', 'G1: una conversación quedó sin respuesta.', { ...PASAN, G1: false }]);

  const sinPropuesta = elegirVariante(resultadoCon({ deAntonia: null }));
  assert.deepEqual([sinPropuesta.variante, sinPropuesta.motivo, sinPropuesta.ayudantesDeAntonia, sinPropuesta.puertas], ['retoma', 'G2: Antonia no tiene un «si» con propuesta.', 0, { ...PASAN, G2: false, G2b: false }]);

  const unaAyudante = elegirVariante(resultadoCon({ nicolas: 'no' }));
  assert.deepEqual([unaAyudante.variante, unaAyudante.quien, unaAyudante.pide, unaAyudante.ayudantesDeAntonia, unaAyudante.puertas], ['V1', 'catalina', 'ignacio', 1, { ...PASAN, G2b: false }]);
});

test('elegirVariante: los bordes de cada puerta y ninguna lectura de los textos', () => {
  const de = (cambios, opciones) => elegirVariante(resultadoCon(cambios), opciones);
  const resumen = (eleccion) => [eleccion.variante, Object.entries(eleccion.puertas).filter(([, pasa]) => !pasa).map(([puerta]) => puerta).join(' ')];

  assert.deepEqual(resumen(de({ catalina: 'no', felipe: 'no' })), ['V1', '']);
  assert.deepEqual(resumen(de({ catalina: 'no', felipe: 'si' })), ['V1', '']);
  assert.deepEqual(resumen(de({ catalina: 'no', felipe: SIN_HILO })), ['V1', '']);
  assert.deepEqual(resumen(de({ catalina: 'si', felipe: 'no' })), ['V2', '']);
  assert.deepEqual(resumen(de({ catalina: SIN_HILO, felipe: 'no' })), ['V2', '']);
  assert.deepEqual(resumen(de({ catalina: 'parcial', felipe: 'si' }, { parcialVale: true })), ['V3', '']);
  assert.equal(de({ catalina: 'parcial', felipe: 'si' }, { parcialVale: true }).propuestaDeIgnacio, null);
  assert.equal(de({ catalina: 'parcial', felipe: 'si', deIgnacio: propuesta('prop-otra', ['Nicolás']) }, { parcialVale: true }).propuestaDeIgnacio, null);
  assert.deepEqual(resumen(de({ catalina: 'parcial', felipe: SIN_HILO }, { parcialVale: true })), ['V3', '']);
  assert.deepEqual(resumen(de({ catalina: 'si', felipe: 'si' }, { parcialVale: true })), ['retoma', 'G3']);
  assert.deepEqual(resumen(de({ catalina: 'si', felipe: 'parcial' }, { parcialVale: true })), ['retoma', 'G3']);
  assert.deepEqual(resumen(de({ catalina: SIN_HILO, felipe: SIN_HILO }, { parcialVale: true })), ['retoma', 'G3']);
  assert.equal(de({ catalina: 'si', felipe: 'si' }).motivo, 'G3: ni el agente de Catalina ni el de Felipe respondieron «no».');

  const pedido = (pide, hilos, suya = null) => ({ pide, tema: `tema de ${pide}`, hilos, propuesta: suya });
  const tres = resultadoCon().pedidos;
  const con = (pedidos) => elegirVariante({ ronda: { status: 'lista', problem: null }, hilos: 0, pedidos });
  assert.deepEqual(resumen(con(tres.slice(0, 2))), ['retoma', 'G0']);
  assert.deepEqual(resumen(con([tres[0], tres[1], pedido('Martina', [hilo('Felipe', 'no')])])), ['retoma', 'G0']);
  assert.deepEqual(resumen(con([...tres, pedido('Antonia', [hilo('Sebastián', 'no')])])), ['retoma', 'G0']);
  assert.deepEqual(resumen(con([tres[0], tres[1], pedido('javiera', [hilo('Felipe', 'no')])])), ['retoma', 'G0']);
  assert.deepEqual(resumen(con([tres[2], tres[0], tres[1]])), ['V1', '']);
  assert.deepEqual(resumen(con([tres[0], pedido('Ignacio', [hilo('catalina', 'no')]), tres[2]])), ['V2', '']);
  assert.deepEqual(resumen(con([tres[0], pedido('Ignacio', [hilo('Catalina', 'NO')]), pedido('Javiera', [hilo('Felipe', 'no ')])])), ['retoma', 'G3']);

  assert.deepEqual(resumen(de({ ronda: { status: 'fallida', problem: null } })), ['retoma', 'G1']);
  assert.equal(de({ ronda: { status: 'en_curso', problem: null } }).motivo, 'G1: la ronda quedó «en_curso».');
  assert.deepEqual(resumen(de({ ronda: { status: 'lista', problem: 'El modelo entregó una respuesta incompleta.' } })), ['retoma', 'G1']);
  assert.equal(de({ ronda: { status: 'lista', problem: 'El modelo entregó una respuesta incompleta.' } }).motivo, 'G1: la ronda terminó con un problema: El modelo entregó una respuesta incompleta.');
  assert.equal(de({ felipe: null, catalina: null }).motivo, 'G1: 2 conversaciones quedaron sin respuesta.');
  assert.deepEqual(resumen(de({ fernanda: null })), ['retoma', 'G1 G2b']);

  assert.deepEqual(resumen(de({ fernanda: 'parcial', nicolas: 'parcial', deAntonia: propuesta('prop-antonia', ['Fernanda', 'Nicolás']) })), ['retoma', 'G2 G2b']);
  assert.deepEqual(resumen(de({ fernanda: 'no', nicolas: 'no' })), ['retoma', 'G2 G2b']);
  assert.deepEqual(resumen(de({ fernanda: 'si', nicolas: 'parcial', deAntonia: propuesta('prop-antonia', ['Fernanda', 'Nicolás']) })), ['V1', '']);
  assert.equal(de({ deAntonia: propuesta('prop-antonia', ['Fernanda', 'Nicolás', 'Sebastián']) }).ayudantesDeAntonia, 2);

  const enganosos = resultadoCon({ catalina: 'si', felipe: 'si' });
  enganosos.pedidos[1].hilos[0].mensajes[1].texto = 'No puede, no tiene disponibilidad esta semana: durmió poco y tiene la agenda llena.';
  enganosos.pedidos[2].hilos[1].mensajes[1].texto = 'No puedo ayudar con eso.';
  enganosos.pedidos[0].hilos[0].mensajes[1].texto = 'No.';
  assert.deepEqual(resumen(elegirVariante(enganosos, { parcialVale: true })), ['retoma', 'G3']);
  const alReves = resultadoCon({ catalina: 'no' });
  alReves.pedidos[1].hilos[0].mensajes[1].texto = 'Sí, puede ayudar con gusto y solo puede orientar.';
  alReves.pedidos[1].hilos[0].mensajes = [];
  assert.deepEqual(resumen(elegirVariante(alReves)), ['V1', '']);

  const intacto = resultadoCon({ catalina: 'parcial', felipe: 'parcial' });
  const copia = structuredClone(intacto);
  elegirVariante(intacto, { parcialVale: true });
  assert.deepEqual(intacto, copia);
});

test('aceptarPendientes acepta por quien no está en cámara, avisa de cada una y respeta las excepciones; rechazar descarta', async () => {
  const demo = await conRonda({ libreto: { respuestas: { ...LIBRETO.respuestas, 'Ignacio>Catalina': 'parcial', 'Javiera>Felipe': 'parcial' } } });
  const { cliente, codigo, ficha, fichas } = demo;
  const resultado = await leerResultado(cliente, codigo, fichas);
  const eleccion = elegirVariante(resultado, { parcialVale: true });
  assert.deepEqual([eleccion.variante, eleccion.propuestaDeIgnacio], ['V3', 'prop-2']);
  assert.deepEqual(resultado.pedidos.map((pedido) => [pedido.pide, pedido.propuesta.id, pedido.propuesta.ayudantes]), [['Antonia', 'prop-1', ['Fernanda', 'Nicolás']], ['Ignacio', 'prop-2', ['Catalina']], ['Javiera', 'prop-3', ['Cristóbal']]]);

  const avisos = [];
  const desde = demo.pedidos.length;
  const aceptadas = await aceptarPendientes(cliente, fichas, { excepto: ['antonia', eleccion.propuestaDeIgnacio], alAceptar: (nombre, aceptada) => void avisos.push(`el guion acepta por ${nombre} · ${aceptada.tema}`) });
  assert.deepEqual(aceptadas, [
    { nombre: 'Javiera', propuesta: 'prop-3', tema: TEMA.Javiera, estado: 'por_aprobar' },
    { nombre: 'Cristóbal', propuesta: 'prop-3', tema: TEMA.Javiera, estado: 'acordada' },
    { nombre: 'Fernanda', propuesta: 'prop-1', tema: TEMA.Antonia, estado: 'por_aprobar' },
    { nombre: 'Nicolás', propuesta: 'prop-1', tema: TEMA.Antonia, estado: 'por_aprobar' },
  ]);
  assert.deepEqual(avisos, ['Javiera', 'Cristóbal', 'Fernanda', 'Nicolás'].map((nombre, posicion) => `el guion acepta por ${nombre} · ${posicion < 2 ? TEMA.Javiera : TEMA.Antonia}`));
  const respuestas = demo.pedidos.slice(desde).filter((pedido) => pedido.metodo === 'POST');
  assert.deepEqual(respuestas.map((pedido) => [demo.visible(pedido.ruta), pedido.cuerpo]), [
    ['/api/people/…/agents/proposals/prop-3/answer', { answer: 'acepta' }],
    ['/api/people/…/agents/proposals/prop-3/answer', { answer: 'acepta' }],
    ['/api/people/…/agents/proposals/prop-1/answer', { answer: 'acepta' }],
    ['/api/people/…/agents/proposals/prop-1/answer', { answer: 'acepta' }],
  ]);
  assert.ok(!demo.pedidos.slice(desde).some((pedido) => pedido.ruta.startsWith(`/api/people/${ficha}/`)));
  demo.sinSecretos([aceptadas, avisos]);

  assert.deepEqual(await rechazar(cliente, fichas.get('catalina'), eleccion.propuestaDeIgnacio), { propuesta: 'prop-2', estado: 'descartada' });
  assert.deepEqual(demo.pedidos.at(-1).cuerpo, { answer: 'rechaza' });
  assert.equal((await fallaDe(rechazar(cliente, fichas.get('ignacio'), 'prop-2'))).message, 'POST /api/people/…/agents/proposals/prop-2/answer respondió 409: Esa propuesta ya está cerrada.');
  assert.equal((await fallaDe(rechazar(cliente, fichas.get('martina'), 'prop-1'))).message, 'POST /api/people/…/agents/proposals/prop-1/answer respondió 403: Esa propuesta no es para ti.');

  assert.deepEqual(await aceptarPendientes(cliente, fichas, { excepto: ['Antonia'] }), []);
  assert.deepEqual(await aceptarPendientes(cliente, fichas), [{ nombre: 'Antonia', propuesta: 'prop-1', tema: TEMA.Antonia, estado: 'acordada' }]);
  assert.deepEqual(await aceptarPendientes(cliente, fichas), []);
  assert.deepEqual((await leerResultado(cliente, codigo, fichas)).pedidos.map((pedido) => pedido.propuesta.estado), ['acordada', 'descartada', 'acordada']);
});

test('sinFichas no deja ninguna ficha en un texto, en un objeto anidado ni en un error, y no toca el original', () => {
  const fichas = new Map([['antonia', 'ficha-A1b2C3d4E5f6G7h8'], ['ignacio', 'ficha-A1b2C3d4E5f6G7h8-larga'], ['javiera', 'Zx9_qLm-4Tn7Rb2K']]);
  const [corta, larga, otra] = [...fichas.values()];
  const original = {
    enlace: `${BASE}/conectar/${corta}#agente`,
    ingesta: `POST /api/ingest/health/${larga} y otra vez ${larga}`,
    lista: [otra, { adentro: [`Bearer ${otra}`, 7, null, true, undefined] }],
    [`clave-${corta}`]: corta,
    mapa: new Map([[corta, new Set([otra, 'limpio'])]]),
    cuando: new Date('2026-11-21T15:00:00.000Z'),
    numero: 45,
    nada: null,
  };
  const copiaDelOriginal = structuredClone(original);
  const limpio = sinFichas(original, fichas);
  assert.deepEqual(limpio, {
    enlace: `${BASE}/conectar/…#agente`,
    ingesta: 'POST /api/ingest/health/… y otra vez …',
    lista: ['…', { adentro: ['Bearer …', 7, null, true, undefined] }],
    'clave-…': '…',
    mapa: new Map([['…', new Set(['…', 'limpio'])]]),
    cuando: new Date('2026-11-21T15:00:00.000Z'),
    numero: 45,
    nada: null,
  });
  assert.deepEqual(original, copiaDelOriginal);
  assert.notEqual(limpio.lista, original.lista);
  assert.notEqual(limpio.cuando, original.cuando);
  for (const ficha of fichas.values()) assert.ok(!JSON.stringify([limpio, [...limpio.mapa], [...limpio.mapa.get('…')]]).includes(ficha));

  assert.equal(sinFichas(`/conectar/${larga}`, fichas), '/conectar/…');
  assert.equal(sinFichas(`${corta}${corta}`, [corta]), '……');
  assert.equal(sinFichas(`a ${corta} b`, corta), 'a … b');
  assert.equal(sinFichas(`a ${corta} b`, new Set([corta])), 'a … b');
  assert.equal(sinFichas(`a ${corta} b`, { antonia: corta }), 'a … b');
  assert.equal(sinFichas('sin nada que ocultar', ['', null, undefined, 7]), 'sin nada que ocultar');
  assert.equal(sinFichas('sin fichas', undefined), 'sin fichas');
  assert.deepEqual([sinFichas(7, fichas), sinFichas(null, fichas), sinFichas(undefined, fichas), sinFichas(false, fichas)], [7, null, undefined, false]);

  const falla = Object.assign(new Error(`GET /api/people/${corta}/signals respondió 500`, { cause: new Error(`causa con ${otra}`) }), { estado: 500, ruta: `/conectar/${larga}` });
  const sinNada = sinFichas(falla, fichas);
  assert.ok(sinNada instanceof Error && sinNada !== falla);
  assert.deepEqual([sinNada.message, sinNada.estado, sinNada.ruta, sinNada.cause.message], ['GET /api/people/…/signals respondió 500', 500, '/conectar/…', 'causa con …']);
  for (const ficha of fichas.values()) assert.ok(!`${sinNada.stack}${sinNada.cause.stack}`.includes(ficha));

  const circular = { nombre: corta };
  circular.yo = circular;
  const sinCiclo = sinFichas(circular, fichas);
  assert.deepEqual([sinCiclo.nombre, sinCiclo.yo === sinCiclo], ['…', true]);
});

test('el ensayo completo: imprime sin fichas y termina con 0, o con 1 si hay diferencias o retoma', async () => {
  const correr = async (opciones = {}, { parcialVale = false } = {}) => {
    const demo = servidorDeMentira(opciones);
    const lineas = [];
    const salida = await ensayo({ base: BASE, parcialVale, fetchImpl: demo.fetchImpl, cadaMs: 0, entreEntradasMs: 0, decir: (linea) => lineas.push(linea) });
    demo.sinSecretos(lineas);
    demo.sinSecretos(salida);
    return { demo, lineas, salida };
  };

  const { demo, lineas, salida } = await correr();
  assert.deepEqual([salida.codigo, salida.diferencias, salida.eleccion.variante, salida.resultado.hilos], [0, [], 'V1', 5]);
  assert.deepEqual(lineas.slice(0, 2), [`Ensayo sobre ${BASE} · commit abc1234 · modelo guionado · hoy ${HOY}`, 'Sala «Equipo Quillay» QLL4Y7 · Antonia adentro, sin agente todavía']);
  assert.deepEqual(lineas.slice(lineas.indexOf('Diferencias de Antonia y de la sala: ninguna')), [
    'Diferencias de Antonia y de la sala: ninguna',
    '  ronda › empieza: cada agente lee lo compartido de su persona',
    '  hilo › Antonia → Fernanda · guion y ensayo del pitch',
    '  hilo › Antonia → Nicolás · guion y ensayo del pitch',
    '  hilo › Ignacio → Catalina · Conciliación de cobros con el banco',
    '  hilo › Javiera → Cristóbal · animación en canvas',
    '  hilo › Javiera → Felipe · animación en canvas',
    '  respuesta › Fernanda a Antonia · si',
    '  respuesta › Nicolás a Antonia · si',
    '  respuesta › Catalina a Ignacio · no',
    '  respuesta › Cristóbal a Javiera · si',
    '  respuesta › Felipe a Javiera · no',
    '  propuesta › Antonia con Fernanda y Nicolás',
    '  propuesta › Javiera con Cristóbal',
    '  ronda › termina · lista',
    'Montu lista · 2.6 s reales · 18 llamadas al modelo en la ronda',
    'Servidor desde que partió: 19 llamadas, 0 fallidas, 0 reintentos, 42.5 s de modelo',
    'Conversaciones: 5',
    '  Antonia → Fernanda · guion y ensayo del pitch · si',
    '  Antonia → Nicolás · guion y ensayo del pitch · si',
    '  Ignacio → Catalina · Conciliación de cobros con el banco · no',
    '  Javiera → Cristóbal · animación en canvas · si',
    '  Javiera → Felipe · animación en canvas · no',
    'Propuestas: 2',
    '  Antonia con Fernanda y Nicolás · por_aprobar · «Fernanda y Nicolás con Antonia.»',
    '  Javiera con Cristóbal · por_aprobar · «Cristóbal con Javiera.»',
    'Hilo elegido: Ignacio → Catalina',
    '  Ignacio: «Mensaje del agente de Ignacio al de Catalina.»',
    '  Catalina: «Respuesta del agente de Catalina al de Ignacio.»',
    'Puertas: G0 pasa · G1 pasa · G2 pasa · G2b pasa · G3 pasa',
    'Variante: V1 · El agente de Catalina le respondió «no» al de Ignacio.',
  ]);
  for (const persona of ELENCO.slice(1)) assert.ok(lineas.includes(`  ${persona.enRegistro}`), persona.id);
  assert.deepEqual(demo.sala.miembros.map((persona) => persona.nombre), ELENCO.map((persona) => persona.nombre));
  assert.deepEqual(demo.propuestas.map((una) => demo.estadoDe(una)), ['por_aprobar', 'por_aprobar']);
  const orden = demo.recorrido().filter((linea) => /^POST \/api\/rooms|\/agents\/(asks|rounds)$|^GET \/demo\/estado$/.test(linea));
  assert.deepEqual(orden, [
    'GET /demo/estado',
    'POST /api/rooms',
    'POST /api/rooms/QLL4Y7/join',
    'POST /api/people/…/agents/asks',
    ...Array.from({ length: 9 }, () => 'POST /api/rooms/QLL4Y7/join'),
    'GET /demo/estado',
    'POST /api/people/…/teams/team_quillay/agents/rounds',
    'GET /demo/estado',
  ]);

  const v2 = await correr({ libreto: { respuestas: { ...LIBRETO.respuestas, 'Ignacio>Catalina': 'si' } } });
  assert.deepEqual([v2.salida.codigo, v2.salida.eleccion.variante, v2.lineas.at(-5)], [0, 'V2', 'Hilo elegido: Javiera → Felipe']);

  const libretoV3 = { libreto: { respuestas: { ...LIBRETO.respuestas, 'Ignacio>Catalina': 'parcial', 'Javiera>Felipe': 'parcial' } } };
  const conPermiso = await correr(libretoV3, { parcialVale: true });
  assert.deepEqual([conPermiso.salida.codigo, conPermiso.salida.eleccion.variante, conPermiso.salida.eleccion.propuestaDeIgnacio], [0, 'V3', 'prop-2']);
  const retoma = await correr(libretoV3);
  assert.deepEqual([retoma.salida.codigo, retoma.salida.eleccion.variante], [1, 'retoma']);
  assert.deepEqual(retoma.lineas.slice(-8), [
    'Hilo candidato: Ignacio → Catalina',
    '  Ignacio: «Mensaje del agente de Ignacio al de Catalina.»',
    '  Catalina: «Respuesta del agente de Catalina al de Ignacio.»',
    'Hilo candidato: Javiera → Felipe',
    '  Javiera: «Mensaje del agente de Javiera al de Felipe.»',
    '  Felipe: «Respuesta del agente de Felipe al de Javiera.»',
    'Puertas: G0 pasa · G1 pasa · G2 pasa · G2b pasa · G3 falla',
    'Variante: retoma · G3: nadie respondió «no» y el agente de Catalina respondió «parcial»; eso solo vale con --parcial-vale.',
  ]);

  const distinta = await correr({ senales: (id, propias) => (id === 'catalina' ? { ...propias, load: { ...propias.load, level: 'media' } } : propias) });
  assert.deepEqual([distinta.salida.codigo, distinta.salida.diferencias, distinta.salida.eleccion], [1, ['catalina · load.level · esperado alta · real media'], null]);
  assert.deepEqual(distinta.lineas.slice(-2), ['Diferencias de las nueve: 1', '  catalina · load.level · esperado alta · real media']);
  assert.deepEqual(distinta.demo.sala.miembros.map((persona) => persona.nombre), ['Antonia']);
  assert.ok(!distinta.demo.recorrido().some((linea) => linea.endsWith('/agents/rounds')));

  const deAntonia = await correr({ senales: (id, propias) => (id === 'antonia' ? { ...propias, load: { ...propias.load, level: 'media', statement: 'Carga media hoy' } } : propias) });
  assert.deepEqual([deAntonia.salida.codigo, deAntonia.salida.diferencias], [1, ['antonia · load.level · esperado alta · real media', 'antonia · load.statement · esperado Carga alta hoy · real Carga media hoy']]);
  assert.ok(!deAntonia.demo.recorrido().some((linea) => linea.endsWith('/agents/rounds')));

  const caida = servidorDeMentira({ aviso: 'Google no aceptó la autorización de {ficha}.' });
  const lineasDeCaida = [];
  const falla = await fallaDe(ensayo({ base: BASE, fetchImpl: caida.fetchImpl, cadaMs: 0, entreEntradasMs: 0, decir: (linea) => lineasDeCaida.push(linea) }));
  assert.equal(falla.message, 'La vuelta del permiso de GitHub para ignacio trajo un aviso: «Google no aceptó la autorización de ….»');
  caida.sinSecretos(`${falla.message}\n${falla.stack}\n${lineasDeCaida.join('\n')}`);
  assert.match((await fallaDe(ensayo({ base: BASE, fetchImpl: servidorDeMentira({ hoy: diaMas(HOY, -1) }).fetchImpl, decir: () => {} }))).message, /^El servidor de demo partió el /);
});

test('el archivo se puede importar sin que corra nada, y como entrada solo ensaya cuando se le pide', async () => {
  const ejecutar = promisify(execFile);
  const importado = await ejecutar(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('./preparar2.mjs', import.meta.url).href)});`]);
  assert.deepEqual([importado.stdout, importado.stderr], ['', '']);

  const ayuda = await ejecutar(process.execPath, [GUION, '--ayuda']);
  assert.match(ayuda.stdout, /^Uso: node tools\/grabar\/preparar2\.mjs --ensayo \[--base http:\/\/localhost:8797\] \[--parcial-vale\]\n/);
  const sinPedirlo = await ejecutar(process.execPath, [GUION]).then(() => assert.fail('Sin --ensayo termina con código 1.'), (falla) => falla);
  assert.deepEqual([sinPedirlo.code, sinPedirlo.stdout, sinPedirlo.stderr], [1, ayuda.stdout, '']);

  const enlace = join(await mkdtemp(join(tmpdir(), 'ronda-preparar2-')), 'grabar');
  await symlink(dirname(GUION), enlace);
  const porEnlace = await ejecutar(process.execPath, [join(enlace, 'preparar2.mjs'), '--ayuda']);
  assert.equal(porEnlace.stdout, ayuda.stdout, 'Llamado por una ruta con enlace simbólico (una copia en /tmp, por ejemplo) también tiene que correr.');

  const fuente = await readFile(GUION, 'utf8');
  assert.deepEqual([...fuente.matchAll(/^import .* from '([^']+)';$/gm)].map((hallazgo) => hallazgo[1]), ['node:fs', 'node:url', './elenco2.mjs']);
  assert.equal(fuente.match(/\bimport\(/g), null);
  assert.deepEqual(fuente.split('\n').filter((linea) => linea.includes('console.log')), ['const imprimir = (valor, fichas = []) => console.log(sinFichas(valor, fichas));']);
  assert.equal(fuente.match(/playwright|chromium|ffmpeg|\.env\b/gi), null);
  const eleccion = fuente.slice(fuente.indexOf('export function elegirVariante'), fuente.indexOf('export async function aceptarPendientes'));
  assert.ok(eleccion.length > 500);
  assert.equal(eleccion.match(/\.texto|mensajes|\.includes\((?!NOMBRE\.catalina\))|\.match\(|\.test\(|\.search\(|\.indexOf\(|\.startsWith\(|\.endsWith\(|toLowerCase|RegExp|\/[a-z]*\.test/g), null);
});

test('ninguna prueba salió a la red', () => {
  assert.equal(salidasALaRed, 0);
});
