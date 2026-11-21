// Prueba de contrato del elenco y del proveedor simulado. Arma la app real en memoria, conecta a las diez personas por
// las rutas del producto y compara lo que el producto responde con lo que el guion espera. Sin puerto, sin red y sin modelo.
//
//   npx tsx --test tools/grabar/proveedor-demo.test.mts
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { cardDepsFrom } from '../../backend/src/agents/deps.js';
import type { AgentModel } from '../../backend/src/agents/model.js';
import { contactPrompt, replyPrompt } from '../../backend/src/agents/prompts.js';
import { cardFor, openNeedsOf, refreshTeamDigests } from '../../backend/src/agents/round.js';
import { createApp } from '../../backend/src/app.js';
import { createContext } from '../../backend/src/context.js';
import { ARRANQUE, ELENCO, HOY, PERSONAS_DEMO, SALA, ZONA, construirElenco, idDe, porId } from './elenco2.mjs';
import { createDemoFetch } from './proveedor-demo.mjs';

type Json = any;
type Persona = any;
type Elenco = { ARRANQUE: Date; HOY: string; ELENCO: Persona[]; PERSONAS_DEMO: Map<string, Json>; porId: (id: string) => Persona };
type Pedido = { metodo?: string; cuerpo?: unknown; cabeceras?: Record<string, string>; estado?: number };

const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;
const IDS = ['antonia', 'ignacio', 'javiera', 'catalina', 'cristobal', 'felipe', 'fernanda', 'nicolas', 'martina', 'sebastian'];
const DEMO = { clientId: 'demo', clientSecret: 'demo' };
const DESDE_SU_PAGINA = { 'sec-fetch-site': 'same-origin' };
const ORDEN_EN_CAMARA = ['asistente', 'salud', 'oauth', 'granola', 'checkin'];
const ORDEN_PREVIO = ['salud', 'oauth', 'granola', 'checkin', 'asistente'];
const PIDE_ALGO = /necesita|busca|falta|le sirve/i;
const NO_VA_EN_PANTALLA = /paciente|cita|consulta|[!¡]|\p{Extended_Pictographic}/iu;
const CAUSA_PRIVADA = /\benerg|\bcarga\b|sueñ|dorm|durm|cansa|reuni|\bagenda|apple|granola|calendar/i;
const DISPONIBILIDAD: Record<string, string> = {
  antonia: 'baja',
  ignacio: 'alta',
  javiera: 'desconocida',
  catalina: 'baja',
  cristobal: 'alta',
  felipe: 'baja',
  fernanda: 'alta',
  nicolas: 'alta',
  martina: 'desconocida',
  sebastian: 'normal',
};
const REGLAS = [
  /^POST oauth2\.googleapis\.com\/token$/,
  /^POST github\.com\/login\/oauth\/access_token$/,
  /^POST api\.linear\.app\/oauth\/token$/,
  /^GET www\.googleapis\.com\/oauth2\/v3\/userinfo$/,
  /^GET www\.googleapis\.com\/calendar\/v3\/calendars\/primary\/events$/,
  /^GET gmail\.googleapis\.com\/gmail\/v1\/users\/me\/messages$/,
  /^GET gmail\.googleapis\.com\/gmail\/v1\/users\/me\/messages\/[^/]+$/,
  /^GET api\.github\.com\/user$/,
  /^GET api\.github\.com\/users\/[^/]+\/events$/,
  /^POST api\.linear\.app\/graphql$/,
  /^GET public-api\.granola\.ai\/v1\/notes$/,
  /^GET public-api\.granola\.ai\/v1\/notes\/[^/]+$/,
];

let salidasALaRed = 0;
globalThis.fetch = (async () => {
  salidasALaRed += 1;
  throw new Error('Esta prueba no sale a la red.');
}) as typeof fetch;

const relojDe = new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const diaDe = (instante: Date) => relojDe.format(instante).slice(0, 10);
const diaMas = (dia: string, cuantos: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + cuantos * DIA_MS).toISOString().slice(0, 10);

function enSantiago(dia: string, hora: string): Date {
  const pared = Date.parse(`${dia}T${hora}:00Z`);
  for (const horas of [3, 4, 5, 2]) {
    const candidato = new Date(pared + horas * HORA_MS);
    if (relojDe.format(candidato) === `${dia} ${hora}`) return candidato;
  }
  throw new Error(`No existe ${dia} ${hora} en ${ZONA}.`);
}

const DIA_REAL = diaDe(new Date());
const DE_ARRANQUE: Elenco = { ARRANQUE, HOY, ELENCO, PERSONAS_DEMO, porId } as Elenco;
const simulado = (id: string): Json => DE_ARRANQUE.PERSONAS_DEMO.get(id);

const textosDe = (persona: Persona): { compartido: boolean; texto: string }[] => {
  if (!persona.repo) return [];
  if (persona.repo.pegado) return [{ compartido: persona.asistente.comparte, texto: persona.repo.pegado }];
  return persona.repo.archivos.map((archivo: Json) => ({ compartido: archivo.share === 'siempre', texto: archivo.content }));
};
const minutosHoy = (elenco: Elenco, id: string) =>
  elenco.PERSONAS_DEMO.get(id).reuniones
    .filter((reunion: Json) => diaDe(new Date(reunion.start.dateTime)) === elenco.HOY)
    .reduce((total: number, reunion: Json) => total + (Date.parse(reunion.end.dateTime) - Date.parse(reunion.start.dateTime)) / 60_000, 0);

function montar(elenco: Elenco) {
  const llamadas: string[] = [];
  const secretos: string[] = [];
  const ctx = createContext({
    location: ':memory:',
    fetch: createDemoFetch(elenco.PERSONAS_DEMO, { alLlamar: (ruta: string) => llamadas.push(ruta) }) as typeof fetch,
    config: { publicBaseUrl: null, agentRoundHour: null, oauth: { google: DEMO, github: DEMO, linear: DEMO } },
    model: null,
    whatsapp: null,
  });
  const app = createApp(ctx);
  const sinSecretos = (texto: string) => secretos.reduce((limpio, secreto) => limpio.replaceAll(secreto, '…'), texto);
  const guardar = <Valor extends string>(secreto: Valor): Valor => {
    secretos.push(secreto);
    return secreto;
  };

  const enviar = async (ruta: string, { metodo = 'GET', cuerpo, cabeceras = {} }: Pedido = {}) => {
    const respuesta = await app.request(ruta, {
      method: metodo,
      headers: { ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }), ...cabeceras },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const texto = await respuesta.text();
    const donde = `${metodo} ${sinSecretos(ruta.split('?')[0] ?? '')}`;
    assert.ok(!texto.includes('Error interno.'), `${donde} respondió «Error interno.»`);
    const destino = new URL(respuesta.headers.get('location') ?? '/', 'http://ronda.invalid');
    return { respuesta, texto, donde, aviso: destino.searchParams.get('aviso'), destino: sinSecretos(destino.pathname), json: (): Json => JSON.parse(texto) };
  };

  const pedir = async (ruta: string, pedido: Pedido = {}) => {
    const resultado = await enviar(ruta, pedido);
    const { respuesta, donde } = resultado;
    if (pedido.estado === 302) {
      assert.equal(respuesta.status, 302, `${donde} respondió ${respuesta.status} y se esperaba 302`);
      assert.equal(resultado.aviso, null, `${donde} volvió con el aviso «${resultado.aviso}»`);
    } else {
      assert.ok(respuesta.status >= 200 && respuesta.status < 300, `${donde} respondió ${respuesta.status}: ${sinSecretos(resultado.texto).slice(0, 200)}`);
    }
    return resultado;
  };

  const conectarOAuth = async (ficha: string, proveedor: string, id: string) => {
    const inicio = await pedir(`/api/people/${ficha}/oauth/${proveedor}/start`, { cabeceras: DESDE_SU_PAGINA, estado: 302 });
    const estado = new URL(inicio.respuesta.headers.get('location') ?? '').searchParams.get('state') ?? '';
    const galleta = (inicio.respuesta.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    assert.ok(estado && galleta.startsWith(`ronda_oauth_${proveedor}=`), `El inicio de ${proveedor} para ${id} no entregó estado y galleta.`);
    const vuelta = await pedir(`/api/oauth/${proveedor}/callback?${new URLSearchParams({ code: `demo-${id}`, state: estado })}`, { cabeceras: { cookie: galleta }, estado: 302 });
    assert.equal(vuelta.destino, '/conectar/…', `La vuelta de ${proveedor} para ${id} no terminó en la página de la persona.`);
  };

  const pasos: Record<string, (persona: Persona, ficha: string) => Promise<void>> = {
    async salud(persona, ficha) {
      for (const cuerpo of persona.salud) await pedir(`/api/ingest/health/${ficha}`, { metodo: 'POST', cuerpo });
    },
    async oauth(persona, ficha) {
      for (const proveedor of persona.oauth) await conectarOAuth(ficha, proveedor, persona.id);
    },
    async granola(persona, ficha) {
      if (!persona.granola) return;
      const conectada = (await pedir(`/api/people/${ficha}/connections/granola`, { metodo: 'POST', cuerpo: { secret: `grn_demo_${persona.id}` } })).json();
      assert.deepEqual(conectada, { ok: true, account: `${persona.id}@ronda.example`, imported: persona.espera.conexiones.granola }, `${persona.id} · Granola`);
    },
    async checkin(persona, ficha) {
      if (persona.checkin) await pedir(`/api/people/${ficha}/checkins`, { metodo: 'POST', cuerpo: persona.checkin });
    },
    async asistente(persona, ficha) {
      if (!persona.asistente) return;
      if (persona.asistente.puerta === 'pegado') {
        const pegado = (await pedir(`/api/people/${ficha}/repo/paste`, { metodo: 'POST', cuerpo: { kind: persona.asistente.tipo, content: persona.repo.pegado } })).json();
        if (persona.asistente.comparte) await pedir(`/api/people/${ficha}/repo/file`, { metodo: 'PATCH', cuerpo: { path: pegado.path, share: 'siempre' } });
        return;
      }
      const enlace = (await pedir(`/api/people/${ficha}/assistants/pairings`, { metodo: 'POST', cuerpo: {} })).json();
      guardar(enlace.code);
      const documento = await pedir(enlace.path);
      assert.ok(documento.texto.startsWith(`# Ronda: join as ${persona.nombre}'s assistant`), `${persona.id} · el link no entregó el documento de ingreso`);
      const ingreso = (await pedir('/api/assistants/join', { metodo: 'POST', cuerpo: { code: enlace.code, kind: persona.asistente.tipo, label: persona.asistente.etiqueta } })).json();
      guardar(ingreso.token);
      assert.deepEqual([ingreso.assistant.kind, ingreso.assistant.label], [persona.asistente.tipo, persona.asistente.etiqueta]);
      const cambio = (
        await pedir('/api/repo/commit', {
          metodo: 'POST',
          cabeceras: { authorization: `Bearer ${ingreso.token}` },
          cuerpo: { message: `Primer contexto de ${persona.nombre}`, topics: [], files: persona.repo.archivos },
        })
      ).json();
      assert.equal(cambio.files, persona.repo.archivos.length, `${persona.id} · archivos del repo`);
    },
  };

  const conectar = async (persona: Persona, ficha: string, orden: string[]) => {
    for (const paso of orden) await pasos[paso]!(persona, ficha);
  };

  const senalesDe = async (ficha: string): Promise<Json> => (await pedir(`/api/people/${ficha}/signals`)).json().signals;
  const fuentesDe = async (ficha: string): Promise<Record<string, Json>> =>
    Object.fromEntries((await pedir(`/api/people/${ficha}`)).json().sources.map((fuente: Json) => [fuente.id, fuente]));
  const nivelDe = ({ level, statement, basis }: Json) => ({ level, statement, basis });
  const cartaDe = (persona: Persona, ficha: string) => cardFor(cardDepsFrom(ctx), { token: ficha, name: persona.nombre }, new Date());

  const comprobar = async (persona: Persona, ficha: string) => {
    const { id, espera } = persona;
    const senales = await senalesDe(ficha);
    assert.deepEqual(nivelDe(senales.energy), espera.energy, `${id} · energy`);
    assert.deepEqual(nivelDe(senales.load), espera.load, `${id} · load`);
    assert.deepEqual(senales.blockers.map(({ statement, source, visibility }: Json) => ({ statement, source, visibility })), espera.bloqueos, `${id} · bloqueos`);
    assert.deepEqual(senales.expertise, espera.temas, `${id} · temas`);
    assert.deepEqual([senales.energy.visibility, senales.load.visibility], ['preguntar', 'preguntar'], `${id} · permisos de energía y carga`);

    const fuentes = await fuentesDe(ficha);
    for (const fuente of Object.values(fuentes)) {
      const total = espera.conexiones[fuente.id];
      assert.equal(fuente.configured, true, `${id} · ${fuente.id} · configured`);
      if (total === undefined) {
        assert.equal(fuente.connection, null, `${id} · ${fuente.id} no debería estar conectada`);
        continue;
      }
      assert.ok(fuente.connection, `${id} · ${fuente.id} no quedó conectada`);
      assert.equal(fuente.connection.lastError, null, `${id} · ${fuente.id} · lastError`);
      assert.equal(fuente.connection.account, fuente.id === 'github' ? `${id}-demo` : `${id}@ronda.example`, `${id} · ${fuente.id} · cuenta`);
      assert.equal(fuente.sync?.total, total, `${id} · ${fuente.id} · sync.total`);
    }
    assert.deepEqual(Object.keys(espera.conexiones).filter((fuente) => !fuentes[fuente]), [], `${id} · fuentes que el producto no conoce`);
    assert.equal(fuentes.apple_health?.sync?.total ?? 0, persona.salud.length, `${id} · registros de Apple Health`);

    const carta = cartaDe(persona, ficha);
    assert.equal(carta.availability, DISPONIBILIDAD[id], `${id} · disponibilidad de la ficha`);
    assert.deepEqual(carta.statements.filter((frase) => /^(Energía|Carga)/.test(frase)), [], `${id} · la ficha no lleva energía ni carga`);
    return { senales, fuentes, carta };
  };

  const soloLasReglas = (completas: boolean) => {
    const ajenas = llamadas.filter((llamada) => !REGLAS.some((regla) => regla.test(llamada)));
    assert.deepEqual(ajenas, [], 'El backend hizo una llamada que el proveedor simulado no contempla.');
    if (completas) assert.deepEqual(REGLAS.filter((regla) => !llamadas.some((llamada) => regla.test(llamada))).map(String), [], 'Quedó una regla del proveedor sin usar.');
  };

  return { ctx, app, llamadas, guardar, sinSecretos, enviar, pedir, conectarOAuth, pasos, conectar, senalesDe, fuentesDe, cartaDe, comprobar, soloLasReglas };
}

const congelarReloj = (t: TestContext, instante: Date) => {
  t.mock.timers.enable({ apis: ['Date'], now: instante.getTime() });
  t.after(() => t.mock.timers.reset());
};

test('el elenco es el del guion: diez personas, en orden de entrada, y solo Javiera pide algo en su texto', () => {
  assert.equal(SALA, 'Equipo Quillay');
  assert.equal(ZONA, 'America/Santiago');
  assert.equal(ELENCO.length, 10);
  assert.deepEqual(ELENCO.map((persona: Persona) => persona.id), IDS);
  assert.deepEqual([...PERSONAS_DEMO.keys()], IDS);
  assert.deepEqual(ELENCO.map((persona: Persona) => idDe(persona.nombre)), IDS);
  assert.deepEqual([idDe('Cristóbal'), idDe('Nicolás'), idDe(' Sebastián ')], ['cristobal', 'nicolas', 'sebastian']);
  assert.equal(porId('catalina').nombre, 'Catalina');
  assert.equal(porId('nadie'), undefined);

  assert.deepEqual(
    ELENCO.map((persona: Persona) => persona.asistente?.tipo ?? null),
    ['claude-code', 'codex', 'chatgpt', 'cursor', 'claude-code', 'openclaw', 'grok', 'claude', 'gemini', null],
  );
  assert.deepEqual(
    ELENCO.map((persona: Persona) => (persona.asistente ? `${persona.asistente.puerta}${persona.asistente.puerta === 'pegado' && !persona.asistente.comparte ? ' sin compartir' : ''}` : 'sin agente')),
    ['link', 'link', 'pegado', 'link', 'link', 'link', 'pegado', 'pegado', 'pegado sin compartir', 'sin agente'],
  );

  assert.deepEqual(ELENCO.filter((persona: Persona) => /necesita/i.test(JSON.stringify(persona))).map((persona: Persona) => persona.id), ['javiera']);
  assert.match(porId('javiera').repo.pegado, /^3\. Necesita a alguien que sepa de animación en canvas/m);
  for (const persona of ELENCO as Persona[]) {
    if (persona.id !== 'javiera') for (const { texto } of textosDe(persona)) assert.doesNotMatch(texto, PIDE_ALGO, `${persona.id} · un texto del repo suena a pedido`);
    assert.doesNotMatch(JSON.stringify(persona), NO_VA_EN_PANTALLA, `${persona.id} · un texto no puede ir en pantalla`);
    assert.ok(persona.variable.endsWith('.') && persona.enRegistro.startsWith(`${persona.nombre} entra · `) && persona.enRegistro.length <= 80, `${persona.id} · variable y línea de registro`);
    if (persona.asistente?.puerta !== 'link') continue;
    assert.deepEqual(
      persona.repo.archivos.map(({ path, share }: Json) => `${path} ${share}`),
      ['README.md siempre', 'ahora.md siempre', 'sabe.md siempre', 'estado.md preguntar'],
    );
    assert.doesNotMatch(persona.repo.archivos.map(({ content }: Json) => content).join('\n'), CAUSA_PRIVADA, `${persona.id} · un archivo habla de energía, sueño o reuniones`);
  }
  assert.doesNotMatch(JSON.stringify(porId('antonia').repo), /pitch/i);
  assert.doesNotMatch(JSON.stringify(porId('ignacio').repo), /conciliaci/i);
  assert.equal(porId('catalina').checkin, null);

  assert.deepEqual(porId('antonia').salud, [{ sleep_hours: '23040,5' }]);
  assert.deepEqual(porId('catalina').salud.map((noche: Json) => noche.date), [-10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0].map((dias) => diaMas(HOY, dias)));
  assert.deepEqual(porId('catalina').salud.map((noche: Json) => noche.sleep_hours), [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 4.9, 4.8, 5]);
  assert.deepEqual(porId('cristobal').salud, [{ date: HOY, sleep_hours: 8 }]);

  for (const [id, fixture] of DE_ARRANQUE.PERSONAS_DEMO) {
    assert.deepEqual(Object.keys(fixture), ['correo', 'github', 'reuniones', 'correos', 'actividad', 'tareas', 'notas']);
    assert.deepEqual([fixture.correo, fixture.github], [`${id}@ronda.example`, `${id}-demo`]);
    const texto = JSON.stringify(fixture);
    assert.doesNotMatch(texto, NO_VA_EN_PANTALLA, `${id} · un dato del proveedor no puede ir en pantalla`);
    const anfitriones = [...texto.matchAll(/@([a-z0-9.-]+)|https?:\/\/([a-z0-9.-]+)/gi)].map((hallazgo) => hallazgo[1] ?? hallazgo[2] ?? '');
    assert.deepEqual(anfitriones.filter((anfitrion) => !anfitrion.endsWith('.example')), [], `${id} · un host no es .example`);
    for (const { name } of fixture.actividad.map((evento: Json) => evento.repo)) assert.ok(name.startsWith('ronda-demo/'), `${id} · ${name}`);
    const inicios = new Set(fixture.reuniones.map((reunion: Json) => Date.parse(reunion.start.dateTime)));
    for (const nota of fixture.notas) assert.ok(!inicios.has(Date.parse(nota.calendar_event.scheduled_start_time)), `${id} · una nota parte junto con una reunión`);
  }
  assert.deepEqual([minutosHoy(DE_ARRANQUE, 'antonia'), minutosHoy(DE_ARRANQUE, 'catalina'), minutosHoy(DE_ARRANQUE, 'nicolas')], [210, 300, 30]);
  assert.equal(Date.parse(simulado('ignacio').tareas[0].updatedAt), ARRANQUE.getTime() - 96 * HORA_MS);
  assert.deepEqual(
    [...DE_ARRANQUE.PERSONAS_DEMO.values()].flatMap((fixture) => fixture.notas).filter((nota: Json) => PIDE_ALGO.test(nota.summary_text)).map((nota: Json) => nota.id),
    ['not_antonia_1'],
  );

  assert.throws(() => {
    porId('catalina').espera.load.level = 'media';
  }, TypeError);
  assert.throws(() => simulado('ignacio').tareas.push({}), TypeError);
});

test('las fechas salen del día de Santiago, aunque en UTC ya sea mañana y aunque cambie el horario', () => {
  assert.equal(HOY, diaDe(ARRANQUE));

  const tarde = construirElenco(enSantiago(DIA_REAL, '22:45')) as Elenco;
  assert.equal(tarde.HOY, DIA_REAL);
  assert.notEqual(tarde.ARRANQUE.toISOString().slice(0, 10), DIA_REAL);
  const deAntonia = tarde.PERSONAS_DEMO.get('antonia');
  assert.deepEqual(
    deAntonia.reuniones.map((reunion: Json) => [Date.parse(reunion.start.dateTime), Date.parse(reunion.end.dateTime)]),
    [
      [enSantiago(DIA_REAL, '09:30'), enSantiago(DIA_REAL, '10:30')],
      [enSantiago(DIA_REAL, '11:30'), enSantiago(DIA_REAL, '12:30')],
      [enSantiago(DIA_REAL, '15:00'), enSantiago(DIA_REAL, '16:30')],
      [enSantiago(diaMas(DIA_REAL, -1), '10:00'), enSantiago(diaMas(DIA_REAL, -1), '10:45')],
      [enSantiago(diaMas(DIA_REAL, 1), '12:00'), enSantiago(diaMas(DIA_REAL, 1), '12:30')],
    ].map((tramo) => tramo.map((instante) => instante.getTime())),
  );
  assert.equal(Date.parse(deAntonia.notas[0].calendar_event.scheduled_start_time), enSantiago(DIA_REAL, '17:00').getTime());
  assert.equal(tarde.porId('catalina').salud.at(-1).date, DIA_REAL);
  assert.deepEqual(tarde.PERSONAS_DEMO.get('catalina').tareas.map((tarea: Json) => tarea.dueDate), [null, diaMas(DIA_REAL, 3), diaMas(DIA_REAL, 5)]);
  assert.equal(Date.parse(tarde.PERSONAS_DEMO.get('ignacio').tareas[0].updatedAt), tarde.ARRANQUE.getTime() - 96 * HORA_MS);
  for (const fixture of tarde.PERSONAS_DEMO.values()) {
    for (const correo of fixture.correos) assert.ok(Number(correo.internalDate) < tarde.ARRANQUE.getTime(), 'Un correo llegó después del arranque.');
    for (const evento of fixture.actividad) assert.ok(Date.parse(evento.created_at) < tarde.ARRANQUE.getTime(), 'Un commit ocurrió después del arranque.');
  }

  const madrugada = construirElenco(enSantiago(DIA_REAL, '00:35')) as Elenco;
  assert.equal(madrugada.HOY, DIA_REAL);
  for (const fixture of madrugada.PERSONAS_DEMO.values()) {
    for (const correo of fixture.correos) assert.ok(Number(correo.internalDate) < madrugada.ARRANQUE.getTime(), 'Un correo llegó después del arranque.');
  }

  const invierno = construirElenco(new Date('2026-07-15T02:30:00Z')) as Elenco;
  assert.equal(invierno.HOY, '2026-07-14');
  assert.equal(invierno.PERSONAS_DEMO.get('antonia').reuniones[0].start.dateTime, '2026-07-14T09:30:00-04:00');
  const verano = construirElenco(new Date('2026-11-22T01:45:00Z')) as Elenco;
  assert.equal(verano.HOY, '2026-11-21');
  assert.equal(verano.PERSONAS_DEMO.get('antonia').reuniones[0].start.dateTime, '2026-11-21T09:30:00-03:00');
  assert.equal(verano.PERSONAS_DEMO.get('antonia').correos[0].payload.headers[2].value, 'Sat, 21 Nov 2026 08:15:00 -0300');
});

const RELOJES: { nombre: string; preparar: () => { elenco: Elenco; graba: Date } }[] = [
  { nombre: 'con el elenco exportado, a la hora en que cargó el módulo', preparar: () => ({ elenco: DE_ARRANQUE, graba: ARRANQUE }) },
  { nombre: 'servidor y grabación a las 22:45', preparar: () => ({ elenco: construirElenco(enSantiago(DIA_REAL, '22:45')), graba: enSantiago(DIA_REAL, '22:45') }) },
  { nombre: 'servidor desde las 09:05, grabación a las 23:20', preparar: () => ({ elenco: construirElenco(enSantiago(DIA_REAL, '09:05')), graba: enSantiago(DIA_REAL, '23:20') }) },
  { nombre: 'servidor y grabación a las 00:35', preparar: () => ({ elenco: construirElenco(enSantiago(DIA_REAL, '00:35')), graba: enSantiago(DIA_REAL, '00:35') }) },
  { nombre: 'en horario de invierno, a las 22:45', preparar: () => ({ elenco: construirElenco(enSantiago('2026-07-14', '22:45')), graba: enSantiago('2026-07-14', '22:45') }) },
];

for (const { nombre, preparar } of RELOJES) {
  test(`el producto dice de las diez personas lo que el guion espera · ${nombre}`, async (t) => {
    const { elenco, graba } = preparar();
    congelarReloj(t, graba);
    const demo = montar(elenco);

    for (const persona of elenco.ELENCO) {
      const ficha = demo.guardar(demo.ctx.store.addPerson(persona.nombre).token);
      await demo.conectar(persona, ficha, persona.id === 'antonia' ? ORDEN_EN_CAMARA : ORDEN_PREVIO);
      const { carta } = await demo.comprobar(persona, ficha);
      assert.deepEqual(carta.needs.map((pedido) => pedido.topic), persona.id === 'ignacio' ? ['Conciliación de cobros con el banco'] : [], `${persona.id} · pedidos sin permiso`);
      assert.deepEqual(carta.pendingAsks.map((pedido) => pedido.topic), persona.id === 'antonia' ? ['guion y ensayo del pitch'] : [], `${persona.id} · preguntas pendientes`);
    }
    demo.soloLasReglas(true);
  });
}

test('Antonia en cámara, paso a paso, y después la sala con las diez', async (t) => {
  const elenco = construirElenco(enSantiago(DIA_REAL, '22:45')) as Elenco;
  congelarReloj(t, enSantiago(DIA_REAL, '22:45'));
  const pasan = (segundos: number) => t.mock.timers.tick(segundos * 1000);
  const lecturas: { system: string; prompt: string }[] = [];
  const lector: AgentModel = {
    async decide({ system, prompt }) {
      lecturas.push({ system, prompt });
      return { workingOn: [], needs: [], expertise: [] } as never;
    },
  };
  const demo = montar(elenco);
  const antonia = elenco.porId('antonia');
  const pregunta = { topic: 'guion y ensayo del pitch', statement: 'Bloqueo en «guion y ensayo del pitch» desde hoy' };

  const { code: codigo } = (await demo.pedir('/api/rooms', { metodo: 'POST', cuerpo: { name: SALA } })).json();
  const ficha = demo.guardar((await demo.pedir(`/api/rooms/${codigo}/join`, { metodo: 'POST', cuerpo: { name: antonia.nombre } })).json().token as string);
  const equipo = (await demo.pedir(`/api/people/${ficha}/teams`)).json().teams[0].id as string;
  const vistaDeAgentes = async () => (await demo.pedir(`/api/people/${ficha}/teams/${equipo}/agents`)).json();
  const cargaDe = async () => {
    const { load } = await demo.senalesDe(ficha);
    return [load.statement, load.basis.join(', ')];
  };

  pasan(3);
  await demo.pasos.asistente!(antonia, ficha);
  assert.deepEqual((await demo.pedir(`/api/rooms/${codigo}/state`)).json().people.map((persona: Json) => [persona.name, persona.assistants]), [['Antonia', ['claude-code']]]);
  assert.deepEqual((await demo.pedir(`/api/people/${ficha}/repo`)).json().files.map((archivo: Json) => `${archivo.path} ${archivo.share}`), ['README.md siempre', 'ahora.md siempre', 'estado.md preguntar', 'sabe.md siempre']);

  pasan(9);
  const sueno = (await demo.pedir(`/api/ingest/health/${ficha}`, { metodo: 'POST', cuerpo: antonia.salud[0] })).json();
  assert.equal(sueno.summary, 'sueño 6.4 h');
  assert.deepEqual(await cargaDe(), ['Sin datos de carga', '']);
  await demo.conectarOAuth(ficha, 'google', 'antonia');
  const conGoogle = await demo.fuentesDe(ficha);
  assert.deepEqual([conGoogle.google_calendar!.connection.account, conGoogle.gmail!.connection.account], ['antonia@ronda.example', 'antonia@ronda.example']);
  assert.deepEqual(await cargaDe(), ['Carga media hoy', 'google_calendar']);
  const guardados = (await demo.pedir(`/api/people/${ficha}/events`)).json().events;
  assert.ok(guardados.some((evento: Json) => evento.source === 'gmail' && evento.summary === 'Agenda del comité de producto · de Elisa Carrasco'));
  assert.ok(guardados.some((evento: Json) => evento.source === 'google_calendar' && evento.summary === 'Comité de producto · 90 min · 4 asistentes'));

  pasan(13);
  await demo.pasos.granola!(antonia, ficha);
  assert.deepEqual(await cargaDe(), ['Carga alta hoy', 'google_calendar, granola']);

  pasan(8);
  assert.deepEqual((await vistaDeAgentes()).asks, []);
  await demo.pasos.checkin!(antonia, ficha);
  assert.equal((await demo.pedir(`/api/people/${ficha}/checkins`)).json()[0].mood, 'normal');
  const { carta } = await demo.comprobar(antonia, ficha);
  assert.deepEqual(carta.needs, []);
  assert.deepEqual((await vistaDeAgentes()).asks, [pregunta]);

  pasan(13);
  await demo.pedir(`/api/people/${ficha}/agents/asks`, { metodo: 'POST', cuerpo: { topic: pregunta.topic, allow: true } });
  assert.deepEqual((await vistaDeAgentes()).asks, []);
  assert.deepEqual(demo.cartaDe(antonia, ficha).needs, [pregunta]);
  assert.deepEqual((await demo.senalesDe(ficha)).blockers.map((bloqueo: Json) => bloqueo.visibility), ['preguntar']);

  const fichas = new Map<string, string>([['antonia', ficha]]);
  for (const persona of elenco.ELENCO.slice(1)) {
    const suya = demo.guardar((await demo.pedir('/api/people', { metodo: 'POST', cuerpo: { name: persona.nombre } })).json().token as string);
    fichas.set(persona.id, suya);
    await demo.conectar(persona, suya, ORDEN_PREVIO);
  }
  for (const persona of elenco.ELENCO.slice(1)) {
    pasan(1.3);
    await demo.pedir(`/api/rooms/${codigo}/join`, { metodo: 'POST', cuerpo: { token: fichas.get(persona.id) } });
  }
  for (const persona of elenco.ELENCO) await demo.comprobar(persona, fichas.get(persona.id)!);

  const sala = (await demo.pedir(`/api/rooms/${codigo}/state`)).json();
  assert.deepEqual([sala.name, sala.round, sala.threads], [SALA, null, []]);
  assert.deepEqual(
    sala.people.map((persona: Json) => [persona.name, persona.assistants]),
    elenco.ELENCO.map((persona) => [persona.nombre, persona.asistente ? [persona.asistente.tipo] : []]),
  );

  const deps = cardDepsFrom(demo.ctx);
  assert.equal(await refreshTeamDigests({ ...deps, model: lector }, equipo), null);
  const leidas = elenco.ELENCO.filter((persona) => lecturas.some(({ system }) => system.includes(` ${persona.nombre} `)));
  assert.deepEqual(leidas.map((persona) => persona.id), ['antonia', 'ignacio', 'javiera', 'catalina', 'cristobal', 'felipe', 'fernanda', 'nicolas']);
  assert.equal(lecturas.length, 8);
  for (const persona of leidas) {
    const { prompt } = lecturas.find(({ system }) => system.includes(` ${persona.nombre} `))!;
    const leido: string[] = JSON.parse(prompt.slice(prompt.indexOf('['), prompt.lastIndexOf(']') + 1)).map((archivo: Json) => archivo.contenido);
    assert.deepEqual([...leido].sort(), textosDe(persona).filter(({ compartido }) => compartido).map(({ texto }) => texto).sort(), `${persona.id} · lo que lee el modelo no es lo compartido`);
    assert.equal(PIDE_ALGO.test(leido.join('\n')), persona.id === 'javiera', `${persona.id} · palabras de pedido en lo que lee el modelo`);
    assert.doesNotMatch(leido.join('\n'), CAUSA_PRIVADA, `${persona.id} · lo que lee el modelo habla de energía, sueño o reuniones`);
  }

  const ahora = new Date();
  const { cards: cartas, openNeeds: pedidos } = openNeedsOf(deps, equipo, ahora);
  assert.deepEqual(cartas.map((una) => una.name), elenco.ELENCO.map((persona) => persona.nombre));
  assert.deepEqual(pedidos.map(({ requester, need }) => [requester.name, need.topic]), [
    ['Antonia', 'guion y ensayo del pitch'],
    ['Ignacio', 'Conciliación de cobros con el banco'],
  ]);

  const deIgnacio = pedidos[1]!;
  const otros = cartas.filter((una) => una.token !== deIgnacio.requester.token).map((card, posicion) => ({ id: `p${posicion + 1}`, card }));
  const aTodos = contactPrompt(deIgnacio.need, otros);
  assert.doesNotMatch(aTodos, CAUSA_PRIVADA, 'Lo que ve otro agente habla de energía, carga, sueño o reuniones.');
  assert.match(aTodos, /"cobros",\s+"conciliación"/);
  const deCatalina = cartas[3]!;
  const paraCatalina = replyPrompt(deCatalina, 'Ignacio', deIgnacio.need, 'Mensaje de prueba.');
  assert.match(paraCatalina, /"disponibilidad": "baja"/);
  assert.deepEqual(deCatalina.statements, []);
  assert.doesNotMatch(paraCatalina, CAUSA_PRIVADA, 'Lo que recibe el agente de Catalina dice la causa.');
  assert.match(replyPrompt(cartas[5]!, 'Javiera', { topic: 'animación en canvas', statement: 'Pedido de prueba.' }, 'Mensaje de prueba.'), /"disponibilidad": "baja"/);
  assert.match(replyPrompt(cartas[4]!, 'Javiera', { topic: 'animación en canvas', statement: 'Pedido de prueba.' }, 'Mensaje de prueba.'), /"disponibilidad": "alta"/);

  demo.soloLasReglas(true);
  assert.equal(demo.sinSecretos([...fichas.values()].join(' ')), [...fichas.values()].map(() => '…').join(' '));
});

test('el proveedor simulado responde solo sus trece reglas y nunca sale a la red', async () => {
  const llamadas: string[] = [];
  const pedir = createDemoFetch(PERSONAS_DEMO, { alLlamar: (ruta: string) => llamadas.push(ruta) });
  const como = (acceso: string) => ({ headers: { authorization: `Bearer ${acceso}`, accept: 'application/json' } });
  const canje = (codigo: string) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: codigo, client_id: 'demo' }).toString() });
  const linear = (acceso: string, query: string) => ({ method: 'POST', headers: { authorization: `Bearer ${acceso}`, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables: {} }) });
  const leer = async (respuesta: Response) => [respuesta.status, await respuesta.json()];

  assert.deepEqual(await leer(await pedir('https://oauth2.googleapis.com/token', canje('demo-antonia'))), [200, { access_token: 'demo-antonia', expires_in: 31_536_000 }]);
  assert.deepEqual(await leer(await pedir('https://github.com/login/oauth/access_token', canje('demo-ignacio'))), [200, { access_token: 'demo-ignacio' }]);
  assert.deepEqual(await leer(await pedir('https://api.linear.app/oauth/token', canje('demo-catalina'))), [200, { access_token: 'demo-catalina' }]);
  for (const direccion of ['https://oauth2.googleapis.com/token', 'https://github.com/login/oauth/access_token', 'https://api.linear.app/oauth/token']) {
    assert.deepEqual(await leer(await pedir(direccion, canje('demo-nadie'))), [400, { error: 'invalid_grant' }]);
    assert.deepEqual(await leer(await pedir(direccion, canje('antonia'))), [400, { error: 'invalid_grant' }]);
    assert.deepEqual(await leer(await pedir(direccion, { method: 'POST' })), [400, { error: 'invalid_grant' }]);
  }

  assert.deepEqual(await leer(await pedir('https://www.googleapis.com/oauth2/v3/userinfo', como('demo-antonia'))), [200, { email: 'antonia@ronda.example' }]);
  const agenda = await leer(await pedir(new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=250'), como('demo-antonia')));
  assert.deepEqual(agenda, [200, { items: JSON.parse(JSON.stringify(simulado('antonia').reuniones)) }]);
  assert.deepEqual(await leer(await pedir('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25', como('demo-antonia'))), [
    200,
    { messages: ['m-antonia-1', 'm-antonia-2', 'm-antonia-3', 'm-antonia-4', 'm-antonia-5'].map((id) => ({ id })) },
  ]);
  const unCorreo = await leer(await pedir('https://gmail.googleapis.com/gmail/v1/users/me/messages/m-antonia-3?format=metadata', como('demo-antonia')));
  assert.deepEqual([unCorreo[0], unCorreo[1].id, unCorreo[1].payload.headers[0]], [200, 'm-antonia-3', { name: 'Subject', value: 'Acta de la retro del sprint' }]);
  assert.deepEqual(await leer(await pedir('https://gmail.googleapis.com/gmail/v1/users/me/messages/m-catalina-1', como('demo-antonia'))), [404, {}]);
  assert.deepEqual(await leer(await pedir('https://gmail.googleapis.com/gmail/v1/users/me/messages', como('demo-javiera'))), [200, { messages: [] }]);

  assert.deepEqual(await leer(await pedir('https://api.github.com/user', como('demo-ignacio'))), [200, { login: 'ignacio-demo' }]);
  const actividad = await leer(await pedir('https://api.github.com/users/ignacio-demo/events?per_page=100', como('demo-ignacio')));
  assert.deepEqual([actividad[0], Array.isArray(actividad[1]), actividad[1].length], [200, true, 5]);
  assert.deepEqual(await leer(await pedir('https://api.github.com/users/cristobal-demo/events', como('demo-ignacio'))), [404, {}]);
  assert.deepEqual(await leer(await pedir('https://api.github.com/users', como('demo-ignacio'))), [404, {}]);
  assert.deepEqual(await leer(await pedir('https://api.github.com/user/repos', como('demo-ignacio'))), [404, {}]);

  assert.deepEqual(await leer(await pedir('https://api.linear.app/graphql', linear('demo-ignacio', 'query RondaViewer { viewer { email } }'))), [200, { data: { viewer: { email: 'ignacio@ronda.example' } } }]);
  const tareas = await leer(await pedir('https://api.linear.app/graphql', linear('demo-ignacio', 'query RondaAssignedIssues { viewer { assignedIssues { nodes { id } } } }')));
  assert.deepEqual(tareas[1].data.viewer.assignedIssues.nodes.map((tarea: Json) => tarea.identifier), ['RON-212', 'RON-230']);

  const notas = await leer(await pedir('https://public-api.granola.ai/v1/notes?page_size=1', como('grn_demo_catalina')));
  assert.deepEqual([notas[0], Object.keys(notas[1]), notas[1].notes.map((nota: Json) => Object.keys(nota)), notas[1].hasMore, notas[1].cursor], [
    200,
    ['notes', 'hasMore', 'cursor'],
    [['id', 'title', 'owner', 'created_at'], ['id', 'title', 'owner', 'created_at']],
    false,
    null,
  ]);
  const unaNota = await leer(await pedir('https://public-api.granola.ai/v1/notes/not_catalina_1', como('grn_demo_catalina')));
  assert.deepEqual([unaNota[0], unaNota[1].title, unaNota[1].attendees.length], [200, 'Reunión con el banco', 2]);
  assert.deepEqual(await leer(await pedir('https://public-api.granola.ai/v1/notes/not_antonia_1', como('grn_demo_catalina'))), [404, {}]);
  assert.deepEqual(await leer(await pedir('https://public-api.granola.ai/v1/notes/%E0%A4%A', como('grn_demo_catalina'))), [404, {}]);

  for (const [direccion, acceso] of [
    ['https://api.github.com/user', 'demo-nadie'],
    ['https://www.googleapis.com/oauth2/v3/userinfo', 'grn_demo_antonia'],
    ['https://public-api.granola.ai/v1/notes', 'demo-antonia'],
    ['https://gmail.googleapis.com/gmail/v1/users/me/messages', 'otra-cosa'],
    ['https://api.linear.app/no-existe', ''],
  ] as const) {
    assert.deepEqual(await leer(await pedir(direccion, como(acceso))), [401, {}], direccion);
  }
  assert.deepEqual(await leer(await pedir('https://api.linear.app/graphql', { method: 'POST', body: '{}' })), [401, {}]);

  const antes = llamadas.length;
  for (const direccion of ['https://hack.platan.us/api/market/state?event=26-cl', 'https://accounts.google.com/o/oauth2/v2/auth', 'https://api.ai.50x.energy/v1/chat/completions', 'https://oauth2.googleapis.com/token/otra', 'no es una dirección']) {
    assert.deepEqual(await leer(await pedir(direccion, como('demo-antonia'))), [404, {}], direccion);
  }
  assert.deepEqual(await leer(await pedir('https://oauth2.googleapis.com/token')), [404, {}]);
  assert.deepEqual(llamadas.slice(antes), [
    'GET hack.platan.us/api/market/state',
    'GET accounts.google.com/o/oauth2/v2/auth',
    'GET api.ai.50x.energy/v1/chat/completions',
    'GET oauth2.googleapis.com/token/otra',
    'GET sin-direccion',
    'GET oauth2.googleapis.com/token',
  ]);
  assert.equal(llamadas[0], 'POST oauth2.googleapis.com/token');
});

test('un código o una llave que el proveedor no conoce dan el aviso del producto, no un error interno', async (t) => {
  congelarReloj(t, ARRANQUE);
  const demo = montar(DE_ARRANQUE);
  const ficha = demo.guardar(demo.ctx.store.addPerson('Antonia').token);

  const inicio = await demo.pedir(`/api/people/${ficha}/oauth/google/start`, { cabeceras: DESDE_SU_PAGINA, estado: 302 });
  const estado = new URL(inicio.respuesta.headers.get('location') ?? '').searchParams.get('state') ?? '';
  const galleta = (inicio.respuesta.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  const vuelta = await demo.enviar(`/api/oauth/google/callback?${new URLSearchParams({ code: 'demo-nadie', state: estado })}`, { cabeceras: { cookie: galleta } });
  assert.deepEqual([vuelta.respuesta.status, vuelta.destino, vuelta.aviso], [302, '/conectar/…', 'Google no aceptó la autorización. Vuelve a conectar tu cuenta.']);

  const llave = await demo.enviar(`/api/people/${ficha}/connections/granola`, { metodo: 'POST', cuerpo: { secret: 'grn_demo_nadie' } });
  assert.deepEqual([llave.respuesta.status, llave.json()], [400, { error: 'Granola rechazó la llave.' }]);
  const sinPagina = await demo.enviar(`/api/people/${ficha}/oauth/google/start`);
  assert.equal(sinPagina.respuesta.status, 403);
  assert.deepEqual(Object.values(await demo.fuentesDe(ficha)).filter((fuente) => fuente.connection).map((fuente) => fuente.id), []);
  demo.soloLasReglas(false);
});

test('ninguna prueba salió a la red', () => {
  assert.equal(salidasALaRed, 0);
});
