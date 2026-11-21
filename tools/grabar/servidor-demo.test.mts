// Prueba del servidor de demo, en el mismo proceso: sin puerto, sin red y sin modelo.
//
//   npx tsx --test tools/grabar/servidor-demo.test.mts
//
// Por defecto la pantalla de permiso es un texto de prueba con las tres marcas. Con PERMISO_REAL=1 lee design/demo/permiso.html.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as z from 'zod/v4';
import { CLAUDE_CLI_MODEL } from '../../backend/src/agents/claudeCli.js';
import { AgentModelError, type AgentModel } from '../../backend/src/agents/model.js';
import { HelpReply, systemFor } from '../../backend/src/agents/prompts.js';
import { google } from '../../backend/src/oauth/google.js';
import { OAUTH_PROVIDERS } from '../../backend/src/oauth/registry.js';
import { HOY, SALA, ZONA } from './elenco2.mjs';
import { ensayar, leerOpciones } from './ensayo-respuesta.mjs';
import { conReintento, crearServidorDemo, type Llamadas } from './servidor-demo.mjs';

type Json = any;

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const DESDE_SU_PAGINA = { 'sec-fetch-site': 'same-origin' };
const PERMISO_INVALIDO = 'Permiso de prueba no válido.';
const PAGINA_DE_PRUEBA = '<p>Cuenta de prueba: {{CUENTA}}</p><a href="{{PERMITIR}}">Permitir</a><a href="{{CANCELAR}}">Cancelar</a>';
const paginaPermiso = process.env.PERMISO_REAL ? undefined : PAGINA_DE_PRUEBA;
const Dato = z.object({ listo: z.boolean() });
const PEDIDO = { system: 'prueba', prompt: 'prueba', schema: Dato };

let salidasALaRed = 0;
globalThis.fetch = (async () => {
  salidasALaRed += 1;
  throw new Error('Esta prueba no sale a la red.');
}) as typeof fetch;

let llamadasAlModelo = 0;
const modeloDePrueba: AgentModel = {
  async decide() {
    llamadasAlModelo += 1;
    throw new Error('Esta prueba no llama al modelo.');
  },
};

const hoyEnSantiago = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const sinEscapes = (texto: string) => texto.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const enlaceDe = (html: string, nombre: string) => sinEscapes(new RegExp(`href="([^"]*)"[^>]*>${nombre}<`).exec(html)?.[1] ?? '');

function montar() {
  const { app, ctx, llamadas } = crearServidorDemo({ location: ':memory:', modelo: modeloDePrueba, paginaPermiso });
  const fichaDe = (nombre: string) => ctx.store.addPerson(nombre).token;
  const pedir = (ruta: string, cabeceras: Record<string, string> = {}) => app.request(ruta, { headers: cabeceras });

  const fuentesDe = async (ficha: string): Promise<Record<string, Json>> => {
    const { sources } = (await (await pedir(`/api/people/${ficha}`)).json()) as Json;
    return Object.fromEntries(sources.map((fuente: Json) => [fuente.id, fuente]));
  };

  const iniciar = async (ficha: string, proveedor: string) => {
    const inicio = await pedir(`/api/people/${ficha}/oauth/${proveedor}/start`, DESDE_SU_PAGINA);
    assert.equal(inicio.status, 302, `El inicio de ${proveedor} respondió ${inicio.status}`);
    const destino = inicio.headers.get('location') ?? '';
    const galleta = (inicio.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    assert.ok(destino.startsWith(`/demo/permiso/${proveedor}?`), `El inicio de ${proveedor} no lleva a la pantalla de permiso de prueba.`);
    assert.ok(galleta.startsWith(`ronda_oauth_${proveedor}=`), `El inicio de ${proveedor} no dejó su galleta.`);
    return { destino, galleta };
  };

  const volver = async (ficha: string, enlace: string, galleta: string) => {
    const vuelta = await pedir(enlace, { cookie: galleta });
    const llegada = new URL(vuelta.headers.get('location') ?? '/', 'http://ronda.invalid');
    return { estado: vuelta.status, pagina: llegada.pathname.replace(ficha, '…'), aviso: llegada.searchParams.get('aviso') };
  };

  return { app, ctx, llamadas, fichaDe, pedir, fuentesDe, iniciar, volver };
}

test('el estado de la demo dice el día de Santiago y que ninguna ronda parte sola', async () => {
  const demo = montar();
  const respuesta = await demo.pedir('/demo/estado');
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get('cache-control'), 'no-store');
  const estado = (await respuesta.json()) as Json;
  assert.deepEqual(Object.keys(estado), ['commit', 'arrancoEn', 'hoy', 'sala', 'modelo', 'rondaSola', 'llamadas']);
  assert.equal(estado.rondaSola, false);
  assert.equal(estado.hoy, hoyEnSantiago());
  assert.equal(estado.hoy, HOY);
  assert.equal(estado.sala, SALA);
  assert.equal(estado.commit, process.env.DEMO_COMMIT || null);
  assert.equal(estado.modelo, null);
  assert.ok(Math.abs(Date.parse(estado.arrancoEn) - Date.now()) < 10 * 60_000);
  assert.deepEqual(estado.llamadas, { total: 0, fallidas: 0, reintentos: 0, segundos: 0 });
  assert.equal(demo.ctx.config.agentRoundHour, null);
  assert.equal(demo.ctx.config.publicBaseUrl, null);
  assert.equal(demo.ctx.model, modeloDePrueba);
});

test('sin modelo de prueba usa Claude por la terminal, con el modelo fijo o el de AGENT_CLI_MODEL, y no lo llama', async () => {
  const antes = process.env.AGENT_CLI_MODEL;
  try {
    delete process.env.AGENT_CLI_MODEL;
    const fijo = crearServidorDemo({ location: ':memory:', paginaPermiso });
    assert.ok(fijo.ctx.model);
    assert.equal(((await (await fijo.app.request('/demo/estado')).json()) as Json).modelo, CLAUDE_CLI_MODEL);
    process.env.AGENT_CLI_MODEL = 'modelo-de-ensayo';
    const elegido = crearServidorDemo({ location: ':memory:', paginaPermiso });
    assert.equal(((await (await elegido.app.request('/demo/estado')).json()) as Json).modelo, 'modelo-de-ensayo');
    assert.deepEqual(elegido.llamadas, { total: 0, fallidas: 0, reintentos: 0, segundos: 0 });
    const sinModelo = crearServidorDemo({ location: ':memory:', modelo: null, paginaPermiso });
    assert.equal(sinModelo.ctx.model, null);
  } finally {
    if (antes === undefined) delete process.env.AGENT_CLI_MODEL;
    else process.env.AGENT_CLI_MODEL = antes;
  }
});

test('las fuentes de los tres proveedores quedan configuradas', async () => {
  const demo = montar();
  const fuentes = Object.values(await demo.fuentesDe(demo.fichaDe('Antonia')));
  const conPermiso = fuentes.filter((fuente) => fuente.connect === 'oauth');
  assert.deepEqual(conPermiso.map((fuente) => `${fuente.id} ${fuente.provider} ${fuente.configured}`).sort(), ['github github true', 'gmail google true', 'google_calendar google true', 'linear linear true']);
  assert.deepEqual(fuentes.filter((fuente) => fuente.configured !== true), []);
  assert.deepEqual(fuentes.filter((fuente) => fuente.connection !== null), []);
});

test('el permiso de Google pasa por la pantalla de prueba y deja agenda y correo conectados', async () => {
  const demo = montar();
  const ficha = demo.fichaDe('Antonia');
  const { destino, galleta } = await demo.iniciar(ficha, 'google');

  const permiso = await demo.pedir(destino);
  assert.equal(permiso.status, 200);
  assert.match(permiso.headers.get('content-type') ?? '', /^text\/html/);
  assert.equal(permiso.headers.get('cache-control'), 'no-store');
  const html = await permiso.text();
  assert.ok(html.includes('Cuenta de prueba: antonia@ronda.example'));
  assert.equal(html.includes('{{'), false);
  assert.equal(html.includes(ficha), false);
  assert.equal(destino.includes(ficha), false);

  const permitir = enlaceDe(html, 'Permitir');
  const cancelar = enlaceDe(html, 'Cancelar');
  assert.ok(html.includes('/api/oauth/google/callback?code=demo-antonia&amp;state='));
  assert.ok(permitir.startsWith('http://localhost/api/oauth/google/callback?code=demo-antonia&state='));
  assert.ok(cancelar.startsWith('http://localhost/api/oauth/google/callback?error=access_denied&state='));
  assert.equal(new URL(permitir).searchParams.get('state'), new URL(destino, 'http://ronda.invalid').searchParams.get('state'));

  assert.deepEqual(await demo.volver(ficha, permitir, galleta), { estado: 302, pagina: '/conectar/…', aviso: null });
  const fuentes = await demo.fuentesDe(ficha);
  for (const fuente of ['google_calendar', 'gmail']) {
    assert.equal(fuentes[fuente]!.connection?.lastError, null, `${fuente} · lastError`);
    assert.equal(fuentes[fuente]!.connection?.account, 'antonia@ronda.example', `${fuente} · cuenta`);
    assert.equal(fuentes[fuente]!.sync?.total, 5, `${fuente} · registros`);
  }
  assert.deepEqual([fuentes.github!.connection, fuentes.linear!.connection], [null, null]);
  assert.deepEqual(await demo.volver(ficha, permitir, galleta), { estado: 400, pagina: '/', aviso: null });
});

test('GitHub muestra el usuario, Linear el correo, y «Cancelar» vuelve sin conectar nada', async () => {
  const demo = montar();
  const ficha = demo.fichaDe('Ignacio');

  const github = await demo.iniciar(ficha, 'github');
  const paginaDeGithub = await (await demo.pedir(github.destino)).text();
  assert.ok(paginaDeGithub.includes('Cuenta de prueba: ignacio-demo'));
  assert.equal(paginaDeGithub.includes('ignacio@ronda.example'), false);
  assert.deepEqual(await demo.volver(ficha, enlaceDe(paginaDeGithub, 'Cancelar'), github.galleta), { estado: 302, pagina: '/conectar/…', aviso: null });
  assert.equal((await demo.fuentesDe(ficha)).github!.connection, null);

  const otraVez = await demo.iniciar(ficha, 'github');
  const paginaNueva = await (await demo.pedir(otraVez.destino)).text();
  assert.deepEqual(await demo.volver(ficha, enlaceDe(paginaNueva, 'Permitir'), otraVez.galleta), { estado: 302, pagina: '/conectar/…', aviso: null });
  const linear = await demo.iniciar(ficha, 'linear');
  const paginaDeLinear = await (await demo.pedir(linear.destino)).text();
  assert.ok(paginaDeLinear.includes('Cuenta de prueba: ignacio@ronda.example'));
  assert.ok(enlaceDe(paginaDeLinear, 'Permitir').startsWith('http://localhost/api/oauth/linear/callback?code=demo-ignacio&state='));
  assert.deepEqual(await demo.volver(ficha, enlaceDe(paginaDeLinear, 'Permitir'), linear.galleta), { estado: 302, pagina: '/conectar/…', aviso: null });

  const fuentes = await demo.fuentesDe(ficha);
  assert.deepEqual([fuentes.github!.connection?.account, fuentes.github!.connection?.lastError, fuentes.github!.sync?.total], ['ignacio-demo', null, 5]);
  assert.deepEqual([fuentes.linear!.connection?.account, fuentes.linear!.connection?.lastError, fuentes.linear!.sync?.total], ['ignacio@ronda.example', null, 2]);
});

test('un permiso que no viene del inicio de una persona del elenco responde 400 y no muestra nada', async () => {
  const demo = montar();
  const antonia = demo.fichaDe('Antonia');
  const ajena = demo.fichaDe('Zoe');
  const { destino } = await demo.iniciar(antonia, 'google');
  const pedido = new URL(destino, 'http://ronda.invalid').searchParams;
  const sello = pedido.get('state') ?? '';
  const con = (cambios: Record<string, string>, proveedor = 'google') => `/demo/permiso/${proveedor}?${new URLSearchParams({ ...Object.fromEntries(pedido), ...cambios })}`;

  const invalidos = [
    '/demo/permiso/google',
    con({ state: '' }),
    con({ state: 'no.es.un-estado' }),
    con({ state: `${sello.slice(0, -4)}${sello.endsWith('AAAA') ? 'BBBB' : 'AAAA'}` }),
    con({}, 'github'),
    con({}, 'otro'),
    con({ redirect_uri: 'https://otro.example/api/oauth/google/callback' }),
    con({ redirect_uri: 'http://localhost/api/oauth/github/callback' }),
    con({ redirect_uri: '' }),
    (await demo.iniciar(ajena, 'google')).destino,
  ];
  for (const [posicion, ruta] of invalidos.entries()) {
    const respuesta = await demo.pedir(ruta);
    assert.deepEqual([respuesta.status, (await respuesta.text()) === PERMISO_INVALIDO], [400, true], `caso ${posicion + 1}`);
  }
  assert.equal((await demo.pedir(con({}))).status, 200);
});

test('cambiar el registro de este proceso cambia solo la dirección de permiso, y armar dos servidores no la anida', async () => {
  montar();
  const demo = montar();
  assert.notEqual(OAUTH_PROVIDERS.google, google);
  assert.deepEqual(Object.keys(OAUTH_PROVIDERS), ['google', 'github', 'linear']);
  for (const paso of ['exchange', 'identify', 'refresh'] as const) assert.equal(OAUTH_PROVIDERS.google![paso], google[paso], paso);

  const { destino } = await demo.iniciar(demo.fichaDe('Antonia'), 'google');
  const real = new URL(google.authorizeUrl({ credentials: { clientId: 'demo', clientSecret: 'demo' }, redirectUri: 'http://localhost/api/oauth/google/callback', scopes: [], state: 'x' }));
  const simulado = new URL(destino, 'http://ronda.invalid');
  assert.equal(real.host, 'accounts.google.com');
  assert.equal(simulado.pathname, '/demo/permiso/google');
  assert.deepEqual([...simulado.searchParams.keys()], [...real.searchParams.keys()]);
  assert.equal(simulado.searchParams.get('redirect_uri'), 'http://localhost/api/oauth/google/callback');
  assert.equal(simulado.searchParams.get('client_id'), 'demo');
  assert.equal((await demo.pedir(`/api/people/${demo.fichaDe('Antonia')}/oauth/google/start`)).status, 403);
});

test('las rutas de la demo van antes que la app, y el diseño y la app se sirven como en el producto', async () => {
  const demo = montar();
  assert.match((await demo.pedir('/demo/estado')).headers.get('content-type') ?? '', /json/);
  assert.equal((await demo.pedir('/api/health')).status, 200);
  for (const ruta of ['/design/tokens.css', '/design/ronda.css', '/design/logo/montu-mark.svg', '/design/sources/gmail.svg']) assert.equal((await demo.pedir(ruta)).status, 200, ruta);
  assert.equal((await demo.app.request('/demo/estado', { method: 'POST' })).status, 404);

  const conApp = existsSync(join(RAIZ, 'frontend', 'dist', 'index.html'));
  const sala = await demo.pedir('/sala/ABCD');
  assert.equal(sala.status, conApp ? 200 : 404);
  if (conApp) assert.match(sala.headers.get('content-type') ?? '', /^text\/html/);
  const escenario = await demo.pedir('/design/demo/escenario2.html');
  if (conApp) assert.equal((await escenario.text()).includes('id="registro"'), false, 'El escenario lo responde el grabador, no el servidor.');
});

test('exige una carpeta de datos, y fuera del repo', () => {
  const antes = process.env.DATA_DIR;
  const dentro = join(AQUI, 'datos-que-no-existen');
  try {
    delete process.env.DATA_DIR;
    assert.throws(() => crearServidorDemo({ modelo: null }), { message: 'Define DATA_DIR con una carpeta nueva fuera del repo.' });
    process.env.DATA_DIR = '';
    assert.throws(() => crearServidorDemo({ modelo: null }), { message: 'Define DATA_DIR con una carpeta nueva fuera del repo.' });
    const otra = join(RAIZ, 'backend', 'data', 'datos-que-no-existen');
    for (const carpeta of [RAIZ, dentro, otra, join(AQUI, '..', 'grabar', 'datos-que-no-existen'), relative(process.cwd(), dentro) || '.']) {
      assert.throws(() => crearServidorDemo({ location: carpeta, modelo: null }), { message: 'DATA_DIR apunta dentro del repo. Usa una carpeta nueva fuera del repo.' }, carpeta);
    }
    process.env.DATA_DIR = dentro;
    assert.throws(() => crearServidorDemo({ modelo: null }), { message: 'DATA_DIR apunta dentro del repo. Usa una carpeta nueva fuera del repo.' });
    assert.deepEqual([existsSync(dentro), existsSync(otra)], [false, false]);

    process.env.DATA_DIR = ':memory:';
    assert.equal(crearServidorDemo({ modelo: null, paginaPermiso }).ctx.model, null);
  } finally {
    if (antes === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = antes;
  }
});

test('con una carpeta nueva fuera del repo guarda la base ahí y el permiso sigue funcionando', async () => {
  const carpeta = join(mkdtempSync(join(tmpdir(), 'ronda-demo-prueba-')), 'datos');
  const { app, ctx } = crearServidorDemo({ location: carpeta, modelo: modeloDePrueba, paginaPermiso });
  try {
    assert.ok(existsSync(join(carpeta, 'ronda.db')));
    const ficha = ctx.store.addPerson('Catalina').token;
    const inicio = await app.request(`/api/people/${ficha}/oauth/linear/start`, { headers: DESDE_SU_PAGINA });
    const permiso = await app.request(inicio.headers.get('location') ?? '/');
    assert.equal(permiso.status, 200);
    assert.ok((await permiso.text()).includes('Cuenta de prueba: catalina@ronda.example'));
  } finally {
    ctx.db.close();
  }
});

test('el reintento: una falla del modelo se reintenta una vez y dos fallas se lanzan', async () => {
  const cuenta = (): Llamadas => ({ total: 0, fallidas: 0, reintentos: 0, segundos: 0 });
  const modeloQue = (fallas: unknown[]) => {
    let intentos = 0;
    const modelo: AgentModel = {
      async decide(pedido) {
        intentos += 1;
        const falla = fallas.shift();
        if (falla !== undefined) throw falla;
        return pedido.schema.parse({ listo: true });
      },
    };
    return { modelo, intentos: () => intentos };
  };

  const sana = modeloQue([]);
  const deSana = cuenta();
  assert.deepEqual(await conReintento(sana.modelo, deSana).decide(PEDIDO), { listo: true });
  assert.deepEqual([sana.intentos(), deSana.total, deSana.reintentos, deSana.fallidas], [1, 1, 0, 0]);

  const unaFalla = modeloQue([new AgentModelError('El modelo no respondió.')]);
  const deUna = cuenta();
  assert.deepEqual(await conReintento(unaFalla.modelo, deUna).decide(PEDIDO), { listo: true });
  assert.deepEqual([unaFalla.intentos(), deUna.total, deUna.reintentos, deUna.fallidas], [2, 1, 1, 0]);
  assert.ok(deUna.segundos >= 0);

  const dosFallas = modeloQue([new AgentModelError('El modelo no respondió.'), new AgentModelError('El modelo entregó una respuesta incompleta.')]);
  const deDos = cuenta();
  await assert.rejects(conReintento(dosFallas.modelo, deDos).decide(PEDIDO), (falla) => falla instanceof AgentModelError && falla.message === 'El modelo entregó una respuesta incompleta.');
  assert.deepEqual([dosFallas.intentos(), deDos.total, deDos.reintentos, deDos.fallidas], [2, 1, 1, 1]);

  const otraFalla = modeloQue([new TypeError('otra cosa')]);
  const deOtra = cuenta();
  await assert.rejects(conReintento(otraFalla.modelo, deOtra).decide(PEDIDO), TypeError);
  assert.deepEqual([otraFalla.intentos(), deOtra.total, deOtra.reintentos, deOtra.fallidas], [1, 1, 0, 1]);

  const compartida = cuenta();
  const lenta: AgentModel = {
    decide: async (pedido) => {
      await new Promise((seguir) => setTimeout(seguir, 30));
      return pedido.schema.parse({ listo: true });
    },
  };
  const envuelta = conReintento(lenta, compartida);
  await Promise.all([envuelta.decide(PEDIDO), envuelta.decide(PEDIDO), envuelta.decide(PEDIDO)]);
  assert.equal(compartida.total, 3);
  assert.ok(compartida.segundos >= 0.08, `segundos sumados: ${compartida.segundos}`);
});

test('el servidor no lee llaves de modelo ni un archivo de entorno', () => {
  const fuente = readFileSync(join(AQUI, 'servidor-demo.mts'), 'utf8');
  assert.doesNotMatch(fuente, /env-file|FIFTYX|ANTHROPIC|dotenv|loadEnvFile/);
  assert.deepEqual([...fuente.matchAll(/process\.env\.([A-Z_]+)/g)].map((hallazgo) => hallazgo[1]).filter((nombre, posicion, todos) => todos.indexOf(nombre) === posicion).sort(), ['AGENT_CLI_MODEL', 'DATA_DIR', 'DEMO_COMMIT', 'PORT']);
});

test('con llaves de Kapso en el entorno, el puente de WhatsApp sigue sin configurar', async () => {
  const LLAVES = ['KAPSO_API_KEY', 'KAPSO_PHONE_NUMBER_ID', 'KAPSO_WEBHOOK_SECRET', 'KAPSO_WHATSAPP_NUMBER'];
  const antes = LLAVES.map((llave) => process.env[llave]);
  try {
    for (const llave of LLAVES) process.env[llave] = 'de-prueba';
    const { app, ctx } = crearServidorDemo({ location: ':memory:', modelo: modeloDePrueba, paginaPermiso });
    assert.equal(ctx.whatsapp.configured, false);
    assert.equal(((await (await app.request('/demo/estado')).json()) as Json).rondaSola, false);
    const ficha = ctx.store.addPerson('Antonia').token;
    assert.deepEqual(await (await app.request(`/api/people/${ficha}/whatsapp`)).json(), { configured: false, linked: false, phoneEnding: null });
    assert.equal((await app.request(`/api/people/${ficha}/whatsapp/link`, { method: 'POST' })).status, 503);
  } finally {
    for (const [posicion, llave] of LLAVES.entries()) {
      if (antes[posicion] === undefined) delete process.env[llave];
      else process.env[llave] = antes[posicion];
    }
  }
});

test('la sonda de respuestas, con un modelo de prueba: fichas con disponibilidad baja, prompts del producto y tres llamadas a la vez como máximo', async () => {
  const CAUSA_PRIVADA = /\benerg|\bcarga\b|sueñ|dorm|durm|cansa|reuni|\bagenda|apple|granola|calendar/i;
  const UNA_FICHA = /[A-Za-z0-9_-]{24}/;
  const guion: Record<string, (string | null)[]> = { Catalina: ['no', 'no', ' Parcial '], Felipe: ['si', 'quizás', null, null] };
  const pedidos: { system: string; prompt: string; respuesta: boolean }[] = [];
  let enCurso = 0;
  let aLaVez = 0;
  const lector: AgentModel = {
    async decide(pedido) {
      const respuesta = (pedido.schema as unknown) === HelpReply;
      pedidos.push({ system: pedido.system, prompt: pedido.prompt, respuesta });
      enCurso += 1;
      aLaVez = Math.max(aLaVez, enCurso);
      await new Promise((seguir) => setTimeout(seguir, 5));
      enCurso -= 1;
      if (!respuesta) return { workingOn: ['Mantiene lo suyo al día.'], needs: [], expertise: ['Tema leído del repo'] } as never;
      const nombre = Object.keys(guion).find((persona) => pedido.system === systemFor(persona)) ?? '';
      const dicho = guion[nombre]?.shift();
      if (dicho === null || dicho === undefined) throw new AgentModelError('El modelo no respondió.');
      return { help: dicho, message: ` Respuesta de prueba de ${nombre}. ` } as never;
    },
  };
  const lineas: string[] = [];
  await ensayar(3, { modelo: lector, escribir: (linea) => lineas.push(linea) });
  const salida = lineas.join('\n');

  assert.deepEqual(pedidos.slice(0, 2).map(({ system, respuesta }) => [system.split('\n')[0], respuesta]), [
    ['Lees los archivos de trabajo que Catalina decidió compartir con su equipo en Montu.', false],
    ['Lees los archivos de trabajo que Felipe decidió compartir con su equipo en Montu.', false],
  ]);
  const deCatalina = pedidos.filter(({ system, respuesta }) => respuesta && system === systemFor('Catalina'));
  const deFelipe = pedidos.filter(({ system, respuesta }) => respuesta && system === systemFor('Felipe'));
  assert.deepEqual([pedidos.length, deCatalina.length, deFelipe.length], [9, 3, 4]);
  assert.ok(aLaVez >= 2 && aLaVez <= 3, `llamadas a la vez: ${aLaVez}`);
  for (const { prompt } of [...deCatalina, ...deFelipe]) {
    assert.match(prompt, /"disponibilidad": "baja"/);
    assert.match(prompt, /"Tema leído del repo"/);
    assert.match(prompt, /"Mantiene lo suyo al día\."/);
    assert.doesNotMatch(prompt, CAUSA_PRIVADA);
    assert.doesNotMatch(prompt, UNA_FICHA);
  }
  for (const { prompt } of deCatalina) {
    assert.ok(prompt.startsWith('El agente de Ignacio te escribió este mensaje:'));
    assert.match(prompt, /"tema": "Conciliación de cobros con el banco"/);
    assert.match(prompt, /"cobros",\s+"conciliación"/);
  }
  for (const { prompt } of deFelipe) {
    assert.ok(prompt.startsWith('El agente de Javiera te escribió este mensaje:'));
    assert.match(prompt, /"tema": "animación en canvas"/);
  }

  assert.match(salida, /^Ensayo de respuestas · modelo de prueba · 3 por persona · 8 llamadas, de a 3 como máximo\.$/m);
  assert.match(salida, /^Persona +Disponibilidad +no +parcial +si +sin respuesta$/m);
  assert.match(salida, /^Catalina +baja +2 +1 +0 +0$/m);
  assert.match(salida, /^Felipe +baja +0 +0 +1 +2$/m);
  assert.match(salida, /^ {2}\d\. parcial · «Respuesta de prueba de Catalina\.»$/m);
  assert.match(salida, /^ {2}\d\. sin respuesta · El modelo respondió «quizás», que el producto no acepta\.$/m);
  assert.match(salida, /^ {2}\d\. sin respuesta · El modelo no respondió\.$/m);
  assert.match(salida, /^Llamadas al modelo: 8 \(2 lecturas de repo y 6 respuestas\), 1 fallidas, 1 reintentos · /m);
  assert.doesNotMatch(salida, UNA_FICHA);
  assert.doesNotMatch(salida, /[!¡]|\p{Extended_Pictographic}/u);

  assert.deepEqual(leerOpciones([]), { ayuda: false, veces: 6, problema: null });
  assert.deepEqual(leerOpciones(['--veces', '3']), { ayuda: false, veces: 3, problema: null });
  assert.deepEqual(leerOpciones(['--veces', '3', '--ayuda']), { ayuda: true, veces: 3, problema: null });
  for (const mala of [['--veces'], ['--veces', '0'], ['--veces', '2.5'], ['--veces', '13'], ['--veces', 'seis'], ['--otra'], ['6']]) {
    const leida = leerOpciones(mala);
    assert.ok(leida.problema && !leida.ayuda, mala.join(' '));
  }
});

test('ninguna prueba salió a la red ni llamó al modelo', () => {
  assert.equal(salidasALaRed, 0);
  assert.equal(llamadasAlModelo, 0);
});
