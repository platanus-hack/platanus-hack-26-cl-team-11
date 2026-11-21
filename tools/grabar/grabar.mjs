// Graba el camino feliz de Ronda sobre el producto real: una sala al azar, personas al azar y cada una
// con un agente al azar. Quien corre este script hace de todos los agentes: lee cada link y escribe cada repo.
//
//   node tools/grabar/grabar.mjs --base http://localhost:8797 --out docs/demo/camino-feliz.mp4
//
// El servidor tiene que estar arriba con un modelo configurado (FIFTYX_API_KEY, o AGENT_CLI=claude en local)
// y con el frontend compilado. Deja el video, una captura final y un resumen en JSON junto al video.
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ENLAZA, NOMBRE_DE, PEGA, PERSONAS, SALAS, archivosDe, respuestaDe } from './personas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(AQUI, '..', '..');
const { chromium } = createRequire(import.meta.url)(path.join(REPO, '.agents/skills/stageshow/node_modules/playwright-core'));
const ejecutar = promisify(execFile);

const ANCHO = 1920;
const ALTO = 1080;
const PERSONAS_EN_SALA = 6;
const ESPERA_RONDA_MS = 300_000;
const ULTIMO_CUADRO_S = 1.5;
const ACELERA_RONDA = 4;
const FILTRO = 'fps=30,format=yuv420p';

const opcion = (nombre, porDefecto) => {
  const posicion = process.argv.indexOf(`--${nombre}`);
  return posicion === -1 ? porDefecto : process.argv[posicion + 1];
};
const BASE = opcion('base', 'http://localhost:8797').replace(/\/+$/, '');
const SALIDA = path.resolve(opcion('out', path.join(REPO, 'docs/demo/camino-feliz.mp4')));
const CUADROS = path.resolve(opcion('frames', path.join(path.dirname(SALIDA), '.cuadros')));

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];
const barajar = (lista) => [...lista].sort(() => Math.random() - 0.5);

async function api(ruta, { metodo = 'GET', cuerpo, token } = {}) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: { ...(cuerpo ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await respuesta.text();
  if (!respuesta.ok) throw new Error(`${metodo} ${ruta} respondió ${respuesta.status}: ${texto.slice(0, 200)}`);
  return (respuesta.headers.get('content-type') ?? '').includes('json') ? JSON.parse(texto) : texto;
}

function elegirElenco() {
  const protagonista = azar(PERSONAS.filter((persona) => persona.necesita));
  const quienAyuda = PERSONAS.find((persona) => persona.nombre === protagonista.ayuda);
  const resto = barajar(PERSONAS.filter((persona) => persona !== protagonista && persona !== quienAyuda)).slice(0, PERSONAS_EN_SALA - 2);
  const otros = barajar([quienAyuda, ...resto]).map((persona) => ({ persona, agente: azar([...ENLAZA, ...PEGA]) }));
  return { sala: azar(SALAS), protagonista, otros };
}

async function conectarPorLink(tokenPersona, agente, etiqueta, persona) {
  const enlace = await api(`/api/people/${tokenPersona}/assistants/pairings`, { metodo: 'POST', cuerpo: {} });
  await api(enlace.path);
  const ingreso = await api('/api/assistants/join', { metodo: 'POST', cuerpo: { code: enlace.code, kind: agente, label: etiqueta } });
  await api('/api/repo/commit', { metodo: 'POST', token: ingreso.token, cuerpo: { message: `Primer contexto de ${persona.nombre}`, topics: [], files: archivosDe(persona) } });
}

async function conectarPegando(tokenPersona, agente, persona) {
  const pegado = await api(`/api/people/${tokenPersona}/repo/paste`, { metodo: 'POST', cuerpo: { kind: agente, content: respuestaDe(persona) } });
  await api(`/api/people/${tokenPersona}/repo/file`, { metodo: 'PATCH', cuerpo: { path: pegado.path, share: 'siempre' } });
}

async function main() {
  const elenco = elegirElenco();
  const resumen = { sala: elenco.sala, base: BASE, pasos: [], personas: [], conversaciones: [], propuestas: [] };
  console.log(`Sala «${elenco.sala}». Protagonista: ${elenco.protagonista.nombre}. Entran después: ${elenco.otros.map(({ persona, agente }) => `${persona.nombre} (${NOMBRE_DE[agente]})`).join(', ')}.`);

  await rm(CUADROS, { recursive: true, force: true });
  await mkdir(CUADROS, { recursive: true });
  await mkdir(path.dirname(SALIDA), { recursive: true });

  const navegador = await chromium.launch({ headless: true });
  const contexto = await navegador.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 1, locale: 'es-CL', timezoneId: 'America/Santiago' });
  await contexto.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const pagina = await contexto.newPage();
  const escenario = await readFile(path.join(REPO, 'design/demo/escenario.html'), 'utf8');
  await pagina.route(`${BASE}/design/demo/escenario.html`, (ruta) => ruta.fulfill({ contentType: 'text/html; charset=utf-8', body: escenario }));
  await pagina.goto(`${BASE}/design/demo/escenario.html`);

  const cuadros = [];
  const escrituras = [];
  const cdp = await contexto.newCDPSession(pagina);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const archivo = path.join(CUADROS, `c${String(cuadros.length).padStart(6, '0')}.jpg`);
    cuadros.push({ archivo, instante: metadata.timestamp });
    escrituras.push(writeFile(archivo, Buffer.from(data, 'base64')));
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });

  const sala = pagina.frameLocator('#sala');
  const telefono = pagina.frameLocator('#telefono');
  const paso = async (numero, texto) => {
    resumen.pasos.push({ numero, texto, cuadro: cuadros.length });
    console.log(`  ${numero} · ${texto}`);
    await pagina.evaluate(([n, t]) => window.escena.paso(n, t), [String(numero), texto]);
  };
  const anotar = (linea, eco = false) => pagina.evaluate(([l, e]) => window.escena.anotar(l, e), [linea, eco]);
  const apuntar = async (elemento) => {
    await elemento.scrollIntoViewIfNeeded();
    const caja = await elemento.boundingBox();
    if (!caja) throw new Error('No se ve el elemento que hay que apuntar.');
    await pagina.evaluate(([x, y]) => window.escena.apuntar(x, y), [caja.x + caja.width / 2, caja.y + caja.height / 2]);
    await pausa(700);
  };
  const tocar = async (elemento) => {
    await apuntar(elemento);
    await pagina.evaluate(() => window.escena.tocar(true));
    await pausa(140);
    await elemento.click();
    await pagina.evaluate(() => window.escena.tocar(false));
    await pausa(350);
  };
  const escribir = async (elemento, texto) => {
    await tocar(elemento);
    await elemento.pressSequentially(texto, { delay: 60 });
    await pausa(300);
  };

  await sala.getByPlaceholder('Nombre de la sala').waitFor();
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: ANCHO, maxHeight: ALTO, everyNthFrame: 1 });
  await pausa(1800);

  await paso(1, 'Abres una sala');
  await escribir(sala.getByPlaceholder('Nombre de la sala'), elenco.sala);
  await tocar(sala.getByRole('button', { name: 'Abrir sala' }));
  await sala.getByText('Escanea para entrar').waitFor();
  const codigo = await pagina.evaluate(() => document.getElementById('sala').contentWindow.location.pathname.split('/').pop());
  resumen.codigo = codigo;
  await pausa(1500);

  const { protagonista } = elenco;
  await paso(2, `${protagonista.nombre} escanea el QR con su teléfono`);
  await apuntar(sala.locator('.app-qr'));
  await pausa(600);
  await pagina.evaluate(([nombre, direccion]) => {
    window.escena.rotuloTelefono(`Teléfono de ${nombre}`);
    window.escena.abrirTelefono(direccion);
  }, [protagonista.nombre, `/unirse/${codigo}`]);
  await telefono.getByPlaceholder('Tu nombre').waitFor();
  await pausa(900);
  await escribir(telefono.getByPlaceholder('Tu nombre'), protagonista.nombre);
  await tocar(telefono.getByRole('button', { name: 'Entrar' }));
  await telefono.getByText('Conectar un agente').waitFor();
  await sala.getByText(protagonista.nombre, { exact: true }).first().waitFor();
  await pausa(1500);

  await paso(3, 'Crea una línea para su agente');
  await tocar(telefono.getByRole('button', { name: 'Crear la línea' }));
  const linea = await telefono.locator('.rd-code').first().innerText();
  const direccion = /https?:\/\/\S+\/a\/[0-9A-Z]+/.exec(linea)?.[0];
  if (!direccion) throw new Error(`La línea no trae un link: ${linea}`);
  await tocar(telefono.getByRole('button', { name: 'Copiar la línea' }));
  await pausa(1200);

  await paso(4, 'Su agente lee el link, se presenta y escribe su repo');
  const etiqueta = 'Claude Code en el MacBook';
  const ruta = new URL(direccion).pathname;
  await anotar(`agente de ${protagonista.nombre} › lee ${direccion}`);
  const documento = await api(ruta);
  await pausa(700);
  await anotar(`  ← 200 · documento de ingreso «${documento.split('\n')[0].replace(/^#\s*/, '')}» · ${(documento.length / 1024).toFixed(1)} KB`, true);
  await pausa(900);
  await anotar(`agente › le muestra a ${protagonista.nombre} los archivos que va a escribir · ella acepta`);
  await pausa(900);
  await anotar(`agente › POST /api/assistants/join  {"kind":"claude-code","label":"${etiqueta}"}`);
  const ingreso = await api('/api/assistants/join', { metodo: 'POST', cuerpo: { code: ruta.split('/').pop(), kind: 'claude-code', label: etiqueta } });
  await pausa(700);
  await anotar('  ← 201 · token propio, de un solo agente (no se muestra)', true);
  await pausa(800);
  const archivos = archivosDe(protagonista);
  await anotar(`agente › POST /api/repo/commit  «Primer contexto de ${protagonista.nombre}» · ${archivos.map((archivo) => archivo.path).join(', ')}`);
  const cambio = await api('/api/repo/commit', { metodo: 'POST', token: ingreso.token, cuerpo: { message: `Primer contexto de ${protagonista.nombre}`, topics: [], files: archivos } });
  await pausa(600);
  await anotar(`  ← 201 · ${cambio.files} archivos en el repo de ${protagonista.nombre}`, true);
  resumen.personas.push({ nombre: protagonista.nombre, agente: 'Claude Code', como: 'link' });
  const conectado = telefono.getByText(etiqueta, { exact: true }).first();
  await conectado.waitFor({ timeout: 15_000 });
  await telefono.getByText('README.md', { exact: true }).first().waitFor({ timeout: 15_000 });
  await apuntar(conectado);
  await pausa(1600);

  await paso(5, `${protagonista.nombre} decide qué se comparte`);
  await tocar(telefono.getByRole('button', { name: /estado\.md/ }));
  await telefono.getByText(protagonista.estado).first().waitFor({ timeout: 10_000 });
  await pausa(1200);
  await tocar(telefono.getByRole('button', { name: 'Privado', exact: true }));
  await telefono.getByRole('button', { name: /estado\.md.*Privado/ }).first().waitFor({ timeout: 10_000 });
  await pausa(1500);

  await paso(6, 'Llegan más personas, cada una con el agente que ya usa');
  const fichas = new Map();
  const mia = await pagina.evaluate(() => document.getElementById('telefono').contentWindow.location.pathname.split('/').pop());
  fichas.set(protagonista.nombre, mia);
  for (const { persona, agente } of elenco.otros) {
    const entrada = await api(`/api/rooms/${codigo}/join`, { metodo: 'POST', cuerpo: { name: persona.nombre } });
    fichas.set(persona.nombre, entrada.token);
    if (PEGA.includes(agente)) {
      await conectarPegando(entrada.token, agente, persona);
      await anotar(`${persona.nombre} entra · pega la respuesta de ${NOMBRE_DE[agente]} y la deja en «Se comparte»`);
    } else {
      await conectarPorLink(entrada.token, agente, NOMBRE_DE[agente], persona);
      await anotar(`${persona.nombre} entra · su ${NOMBRE_DE[agente]} lee el link y escribe 4 archivos`);
    }
    resumen.personas.push({ nombre: persona.nombre, agente: NOMBRE_DE[agente], como: PEGA.includes(agente) ? 'pegado' : 'link' });
    await sala.getByText(persona.nombre, { exact: true }).first().waitFor({ timeout: 10_000 });
    await pausa(900);
  }
  await pausa(2200);

  await paso(7, 'Empieza la ronda');
  await tocar(telefono.getByRole('button', { name: 'Equipo', exact: true }));
  await telefono.getByRole('button', { name: 'Iniciar ronda' }).waitFor({ timeout: 15_000 });
  await tocar(telefono.getByRole('button', { name: 'Iniciar ronda' }));
  const rondaDesde = cuadros.length;
  await pagina.evaluate((veces) => window.escena.paso('7', `Los agentes conversan entre ellos (video acelerado ×${veces})`), ACELERA_RONDA);
  await anotar('ronda › cada agente lee el repo de su persona y le escribe al agente que puede ayudar');
  await pagina.evaluate(() => window.escena.soltar());
  const limite = Date.now() + ESPERA_RONDA_MS;
  let estado = await api(`/api/rooms/${codigo}/state`);
  while ((!estado.round || estado.round.status === 'en_curso') && Date.now() < limite) {
    await pausa(1500);
    estado = await api(`/api/rooms/${codigo}/state`);
  }
  if (estado.round?.status !== 'lista') throw new Error(`La ronda no terminó bien: ${JSON.stringify(estado.round)}`);
  const rondaHasta = cuadros.length;
  const nombreDe = new Map(estado.people.map((persona) => [persona.id, persona.name]));
  resumen.conversaciones = estado.threads.map((hilo) => ({ pide: nombreDe.get(hilo.from), ayuda: nombreDe.get(hilo.to), tema: hilo.topic, respuesta: hilo.help }));
  await anotar(`  ← ronda lista · ${estado.threads.length} conversaciones`, true);
  await pausa(2500);

  await paso(8, `${protagonista.nombre} lee la conversación de su agente y acepta la propuesta`);
  const hilo = telefono.getByRole('button', { name: new RegExp(`El agente de ${protagonista.nombre} le escribió`) }).first();
  await hilo.waitFor({ timeout: 20_000 });
  await tocar(hilo);
  await pausa(5500);
  const equipo = (await api(`/api/people/${mia}/teams`)).teams[0].id;
  const vista = await api(`/api/people/${mia}/teams/${equipo}/agents`);
  resumen.propuestas = vista.proposals.map((propuesta) => ({ texto: propuesta.text, estado: propuesta.status }));
  const aceptar = telefono.getByRole('button', { name: 'Aceptar la propuesta' });
  if (await aceptar.count()) {
    for (let pendientes = await aceptar.count(); pendientes > 0; pendientes = await aceptar.count()) {
      await tocar(aceptar.first());
      await pausa(1500);
      if ((await aceptar.count()) >= pendientes) break;
    }
    const aceptadas = await api(`/api/people/${mia}/teams/${equipo}/agents`);
    for (const propuesta of aceptadas.proposals.filter((item) => item.status === 'por_aprobar')) {
      for (const parte of propuesta.parties.filter((item) => !item.me && item.answer === 'pendiente')) {
        await api(`/api/people/${fichas.get(parte.name)}/agents/proposals/${propuesta.id}/answer`, { metodo: 'POST', cuerpo: { answer: 'acepta' } });
        await anotar(`${parte.name} también acepta desde su teléfono`);
      }
    }
    await telefono.getByText('Acordada').first().waitFor({ timeout: 15_000 });
    await apuntar(telefono.getByText('Acordada').first());
    const despues = await api(`/api/people/${mia}/teams/${equipo}/agents`);
    resumen.propuestas = despues.proposals.map((propuesta) => ({ texto: propuesta.text, estado: propuesta.status }));
  }
  await pausa(2800);

  await paso(9, 'La misma sala en el globo: cada arco es una conversación');
  await tocar(sala.getByRole('link', { name: 'Ver la sala en el globo' }));
  await pagina.evaluate(() => window.escena.soltar());
  await pausa(9000);

  await paso('Listo', 'De un QR a una propuesta aceptada, sin reunión');
  await pausa(3000);

  await cdp.send('Page.stopScreencast');
  await Promise.all(escrituras);
  await pagina.screenshot({ path: SALIDA.replace(/\.mp4$/, '.png') });
  await navegador.close();

  const duraciones = cuadros.map((cuadro, posicion) => {
    const siguiente = cuadros[posicion + 1];
    const real = siguiente ? Math.max(0.01, siguiente.instante - cuadro.instante) : ULTIMO_CUADRO_S;
    return posicion >= rondaDesde && posicion < rondaHasta ? real / ACELERA_RONDA : real;
  });
  const comienzos = [];
  let largo = 0;
  for (const duracion of duraciones) {
    comienzos.push(largo);
    largo += duracion;
  }
  resumen.pasos = resumen.pasos.map(({ numero, texto, cuadro }) => ({ numero, texto, segundo: Math.round((comienzos[cuadro] ?? largo) * 10) / 10 }));
  const lista = cuadros.map((cuadro, posicion) => `file '${cuadro.archivo}'\nduration ${duraciones[posicion].toFixed(3)}`).join('\n');
  const guia = path.join(CUADROS, 'lista.txt');
  await writeFile(guia, `${lista}\nfile '${cuadros.at(-1).archivo}'\n`);
  await ejecutar('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', guia, '-vf', FILTRO, '-c:v', 'libx264', '-crf', '22', '-preset', 'medium', '-movflags', '+faststart', SALIDA]);
  await rm(CUADROS, { recursive: true, force: true });

  resumen.segundos = Math.round(largo);
  resumen.cuadros = cuadros.length;
  await writeFile(SALIDA.replace(/\.mp4$/, '.json'), `${JSON.stringify(resumen, null, 2)}\n`);
  console.log(`Video: ${SALIDA} · ${resumen.segundos} s · ${cuadros.length} cuadros`);
}

main().catch((falla) => {
  console.error(falla);
  process.exit(1);
});
