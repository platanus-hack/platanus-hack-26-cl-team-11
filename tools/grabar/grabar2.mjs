// Graba «Diez personas, sus fuentes y sus agentes» sobre el producto real, servido por tools/grabar/servidor-demo.mts.
// Las diez personas son inventadas y un proveedor simulado responde por sus cuentas. Este guion hace de cada persona
// y de cada asistente, y lo dice en el registro que queda en pantalla.
//
//   node tools/grabar/grabar2.mjs --base http://localhost:8797 --out docs/demo/diez-personas.mp4 --frames <carpeta fuera del repo> --capturas <carpeta fuera del repo>
//
// Otras opciones: --permiso pantalla|api · --sin-globo · --parcial-vale · --toma N · --max-segundos N.
// Deja el video, la captura final y un resumen en JSON junto al video. Los cuadros quedan en su carpeta: este guion no borra nada.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { ELENCO, PERSONAS_DEMO, SALA, idDe, porId } from './elenco2.mjs';
import { capitulos, duraciones, reloj } from './tiempos2.mjs';

const TITULO = 'Diez personas, sus fuentes y sus agentes';
const ACELERA_RONDA = 6;
const POSIBLES = (ELENCO.length * (ELENCO.length - 1)) / 2;
const LARGO_DE_ROTULO = 70;

export const ROTULOS = {
  e1: 'Diez personas inventadas y datos simulados sobre el producto real',
  e2: 'Antonia le pega una línea a su Claude Code y él escribe su repo',
  e3: 'Llega su sueño; un permiso de Google simulado trae agenda y correo',
  e4: 'Granola entra con una llave y suma una reunión de hoy',
  e5: 'Check-in desde el teléfono: cómo llega y qué la frena',
  e6: 'De sus fuentes sale una frase: carga alta hoy',
  e7: 'Su agente pregunta antes de contar el bloqueo. Antonia permite',
  e8: 'Entran nueve personas más, cada una con su asistente y sus fuentes',
  e9: `Empieza la ronda: los agentes conversan (video acelerado ×${ACELERA_RONDA})`,
  e10: {
    dos: 'Dos personas pueden ayudar a Antonia. Los tres aceptan',
    una: 'Una persona puede ayudar a Antonia. Las dos aceptan',
  },
  e11: 'El pedido de Ignacio no lo escribió nadie: salió de Linear',
  e12: {
    V1: 'El agente de Catalina dijo que no puede. No dijo por qué',
    V2: 'El agente de Felipe dijo que no puede. No dijo por qué',
    V3: 'El agente de Catalina solo ofrece orientar. No dice por qué',
  },
  e13: {
    V1: 'Catalina sí lo sabe: durmió poco y tiene el día lleno',
    V2: 'Felipe sí lo sabe: hoy anotó que llegó con cansancio',
    V3: 'Catalina sí lo sabe: durmió poco y tiene el día lleno',
  },
  e14: {
    V1: 'Su agente lo usa para decidir por ella y no se lo cuenta a nadie',
    V2: 'Su agente lo usa para decidir por él y no se lo cuenta a nadie',
    V3: 'Su agente lo usa para decidir por ella y no se lo cuenta a nadie',
  },
  e14b: 'Catalina dice «Ahora no» y la propuesta queda descartada',
  e15: (conversaciones) => `De ${POSIBLES} conversaciones posibles, los agentes tuvieron ${conversaciones}`,
  e16: 'Qué fue real y qué fue actuado en esta grabación',
};

export const todosLosRotulos = () =>
  Object.values(ROTULOS).flatMap((rotulo) => (typeof rotulo === 'function' ? [rotulo(999)] : typeof rotulo === 'string' ? [rotulo] : Object.values(rotulo)));

for (const rotulo of todosLosRotulos()) {
  if ([...rotulo].length > LARGO_DE_ROTULO) throw new Error(`Este rótulo pasa de ${LARGO_DE_ROTULO} caracteres (tiene ${[...rotulo].length}): ${rotulo}`);
}

const SEGUNDOS = { 1: 3, 2: 9, 3: 13, 4: 8, 5: 8, 6: 5, 7: 6, 8: 13, 9: 11, 10: 12, 11: 8, 12: 11, 13: 10, 14: 5, '14b': 7, 15: 7, 16: 7 };

const CIERRE = {
  titulo: TITULO,
  real: ['El producto, tal como está en main', 'Las rutas de conexión, los conectores y las señales', 'La ronda: cada texto lo escribió el modelo en esta toma'],
  actuado: [
    'Las diez personas y todos sus datos',
    'Las cuentas de Google, GitHub, Linear y Granola: las responde un proveedor de prueba',
    'Un guion hace de cada asistente y toca por cada persona',
  ],
};

const NOTA_DEL_CORREO = 'nota › el correo queda guardado; hoy no alimenta ninguna señal';
const NOTA_DE_LO_PRIVADO = {
  catalina: 'nota › a los otros agentes no les llega su sueño ni su agenda; al suyo solo «disponibilidad: baja»',
  felipe: 'nota › a los otros agentes no les llega su check-in; al suyo solo «disponibilidad: baja»',
};
const SIN_PANTALLA_DE_PERMISO = 'el guion autoriza por Antonia, sin pantalla de permiso';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(AQUI, '..', '..');
const ejecutar = promisify(execFile);

const ANCHO = 1920;
const ALTO = 1080;
const FILTRO = 'fps=30,format=yuv420p';
const TOPE_ESPERA_S = 1.2;
const ULTIMO_CUADRO_S = 1.5;
const ESPERA_MS = 15_000;
const ESPERA_RONDA_MS = 300_000;
const RELOJ_CADA_MS = 500;
const ASIENTO_MS = 150;
const LECTURA_MINIMA_MS = 900;
const LECTURA_MAXIMA_MS = 4000;
const ENTRE_LLEGADAS_S = 1.3;
const TECLA_MS = 60;
const MIRADA_MS = 150;
const DESPLAZAMIENTO_MS = 650;
const LLEGADA_QUE_DESPLAZA = 7;
const METODOS_DEL_ESCENARIO = ['paso', 'rotuloTelefono', 'anotar', 'apuntar', 'tocar', 'soltar', 'abrirSala', 'apagarTelefono', 'encenderTelefono', 'cambiarTelefono', 'reloj', 'cierre', 'marca'];

const NOMBRE = Object.fromEntries(ELENCO.map(({ id, nombre }) => [id, nombre]));
const ANIMO = { bien: 'Bien', normal: 'Normal', cansada: 'Con cansancio', mal: 'Mal' };
const RESPUESTA = { si: 'Puede ayudar', parcial: 'Puede orientar', no: 'No puede' };
const FUENTES_DE = { google: ['Google Calendar', 'Gmail'], github: ['GitHub'], linear: ['Linear'] };
const ORIGEN = { apple_health: 'Apple Health', google_calendar: 'Google Calendar', gmail: 'Gmail', granola: 'Granola', github: 'GitHub', linear: 'Linear', checkin: 'tu check-in' };
const TRAMOS_PERSONALES = [
  /(\/conectar\/)[^\s"'#?/]+/g,
  /(\/api\/people\/)[^\s"'#?/]+/g,
  /(\/api\/ingest\/[^\s"'#?/]+\/)[^\s"'#?/]+/g,
  /(\/a\/)[0-9A-Z]{6,}/g,
  /([?&](?:state|code)=)[^&\s"']+/g,
];

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const literal = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const enLista = (nombres) => (nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres.join(''));
const nuevos = (cuantos) => (cuantos === 1 ? '1 registro nuevo.' : `${cuantos} registros nuevos.`);
const origenDe = (senal) => `Sale de: ${senal.basis.map((origen) => ORIGEN[origen] ?? origen).join(', ')}`;
const kilos = (texto) => (String(texto).length / 1024).toLocaleString('es-CL', { maximumFractionDigits: 1 });

const fuentesDe = (persona) => [
  ...(persona.salud.length > 0 ? ['Apple Health'] : []),
  ...persona.oauth.flatMap((proveedor) => FUENTES_DE[proveedor]),
  ...(persona.granola ? ['Granola'] : []),
  ...(persona.checkin ? ['check-in'] : []),
];

const puertaDe = ({ asistente }) => {
  if (!asistente) return null;
  if (asistente.puerta === 'link') return 'link';
  return asistente.comparte ? 'pegado y compartido' : 'pegado, sin compartir';
};

const opcion = (nombre, porDefecto) => {
  const posicion = process.argv.indexOf(`--${nombre}`);
  return posicion === -1 ? porDefecto : process.argv[posicion + 1];
};

function leerOpciones() {
  const opciones = {
    base: opcion('base', 'http://localhost:8797').replace(/\/+$/, ''),
    salida: path.resolve(opcion('out', path.join(REPO, 'docs/demo/diez-personas.mp4'))),
    cuadros: opcion('frames', null),
    capturas: opcion('capturas', null),
    permiso: opcion('permiso', 'pantalla'),
    sinGlobo: process.argv.includes('--sin-globo'),
    parcialVale: process.argv.includes('--parcial-vale'),
    toma: Number(opcion('toma', '1')),
    maxSegundos: Number(opcion('max-segundos', '170')),
  };
  if (!opciones.salida.endsWith('.mp4')) throw new Error('--out tiene que terminar en .mp4.');
  if (!['pantalla', 'api'].includes(opciones.permiso)) throw new Error('--permiso acepta «pantalla» o «api».');
  if (!Number.isInteger(opciones.toma) || opciones.toma < 1) throw new Error('--toma es un número entero desde 1.');
  if (!(opciones.maxSegundos > 0)) throw new Error('--max-segundos es una cantidad de segundos.');
  return opciones;
}

async function carpetaNueva(pedida, nombre) {
  const carpeta = pedida ? path.resolve(pedida) : await mkdtemp(path.join(tmpdir(), 'ronda-diez-personas-'));
  const desdeElRepo = path.relative(REPO, carpeta);
  if (desdeElRepo === '' || (!desdeElRepo.startsWith('..') && !path.isAbsolute(desdeElRepo))) throw new Error(`La carpeta de ${nombre} tiene que quedar fuera del repo: ${carpeta}`);
  await mkdir(carpeta, { recursive: true });
  if ((await readdir(carpeta)).length > 0) throw new Error(`La carpeta de ${nombre} ya tiene archivos y este guion no borra nada. Usa una carpeta nueva: ${carpeta}`);
  return carpeta;
}

function crearVelo() {
  const secretos = new Set();
  const cubrir = (texto) => {
    const sinSecretos = [...secretos].sort((uno, otro) => otro.length - uno.length).reduce((visible, secreto) => visible.replaceAll(secreto, '…'), String(texto));
    return TRAMOS_PERSONALES.reduce((visible, tramo) => visible.replace(tramo, '$1…'), sinSecretos);
  };
  const cubrirTodo = (valor) => {
    if (typeof valor === 'string') return cubrir(valor);
    if (Array.isArray(valor)) return valor.map(cubrirTodo);
    if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([clave, interno]) => [clave, cubrirTodo(interno)]));
    return valor;
  };
  const guardar = (secreto) => {
    if (typeof secreto === 'string' && secreto !== '') secretos.add(secreto);
  };
  return { cubrir, cubrirTodo, guardar };
}

const velo = crearVelo();

function crearRodaje({ pagina, cuadros, tramos, resumen, capturas, decir, cubrir }) {
  const sala = pagina.frameLocator('#sala');
  const telefono = pagina.frameLocator('#telefono');
  const region = (nombre) => telefono.getByRole('region', { name: nombre, exact: true });
  const escena = (metodo, ...valores) => pagina.evaluate(([nombre, argumentos]) => window.escena[nombre](...argumentos), [metodo, valores]);

  const partio = performance.now();
  let descuentoMs = 0;
  let actual = '0';
  let inicioDeEscena = 0;
  let protegido = -1;
  const pelicula = () => (performance.now() - partio - descuentoMs) / 1000;

  const fallar = (que, falla) => new Error(cubrir(`Escena ${actual} · ${que}.${falla ? ` ${String(falla.message ?? falla).split('\n')[0]}` : ''}`));

  const aparece = (elemento, que, { ms = ESPERA_MS, estado = 'visible' } = {}) =>
    elemento.waitFor({ state: estado, timeout: ms }).catch((falla) => {
      throw fallar(`no ${estado === 'detached' ? 'se fue' : 'apareció'} ${que} en ${ms / 1000} s`, falla);
    });

  const paso = async (numero, texto) => {
    actual = String(numero);
    inicioDeEscena = pelicula();
    resumen.pasos.push({ numero: actual, texto, cuadro: cuadros.length });
    decir(`  ${actual} · ${texto}`);
    await escena('paso', actual, texto);
    await escena('marca', `e${actual}`);
  };

  const anotar = async (linea, eco = false) => {
    const visible = cubrir(linea);
    decir(`        ${visible}`);
    await escena('anotar', visible, eco);
  };

  const leer = async (ms) => {
    await pausa(ms);
    protegido = cuadros.length - 1;
  };

  const esperaCortable = async (espera) => {
    const desde = Math.max(cuadros.length - 1, protegido + 1, 0);
    const comienzo = performance.now();
    const valor = await espera;
    const tardo = performance.now() - comienzo;
    await pausa(ASIENTO_MS);
    const hasta = cuadros.length - 1;
    if (hasta > desde) {
      tramos.push({ desde, hasta, tipo: 'tope', valor: TOPE_ESPERA_S });
      descuentoMs += Math.max(0, tardo - TOPE_ESPERA_S * 1000);
    }
    return valor;
  };

  const omitir = (desdeCuadro = cuadros.length) => {
    const comienzo = performance.now();
    return {
      hasta(hastaCuadro = cuadros.length - 1) {
        if (hastaCuadro > desdeCuadro) tramos.push({ desde: desdeCuadro, hasta: hastaCuadro, tipo: 'omite' });
        descuentoMs += performance.now() - comienzo;
      },
    };
  };

  const acelerar = (desdeCuadro, comienzo) => {
    tramos.push({ desde: desdeCuadro, hasta: cuadros.length, tipo: 'acelera', valor: ACELERA_RONDA });
    descuentoMs += (performance.now() - comienzo) * (1 - 1 / ACELERA_RONDA);
  };

  const captura = async (numero = actual) => {
    if (capturas) await pagina.screenshot({ path: path.join(capturas, `e${String(numero).padStart(2, '0')}.png`) });
  };

  const completar = async (minimoMs = LECTURA_MINIMA_MS, maximoMs = LECTURA_MAXIMA_MS) => {
    await captura();
    const falta = (SEGUNDOS[actual] - (pelicula() - inicioDeEscena)) * 1000;
    await leer(Math.max(minimoMs, Math.min(falta, maximoMs)));
  };

  const enElMismoLugar = (una, otra) => Boolean(una && otra) && Math.abs(una.x - otra.x) < 0.5 && Math.abs(una.y - otra.y) < 0.5;

  const quieto = async (elemento) => {
    let antes = await elemento.boundingBox();
    for (let intento = 0; intento < 12; intento += 1) {
      await pausa(MIRADA_MS);
      const ahora = await elemento.boundingBox();
      if (enElMismoLugar(antes, ahora)) return;
      antes = ahora;
    }
  };

  const acercar = async (elemento, que) => {
    await aparece(elemento, que);
    const antes = await elemento.boundingBox();
    await elemento.evaluate((nodo) => nodo.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await pausa(MIRADA_MS);
    if (enElMismoLugar(antes, await elemento.boundingBox())) return;
    await pausa(DESPLAZAMIENTO_MS);
    await quieto(elemento);
  };

  const apuntar = async (elemento, que, { fijo = false } = {}) => {
    if (fijo) await aparece(elemento, que);
    else await acercar(elemento, que);
    const caja = await elemento.boundingBox();
    if (!caja) throw fallar(`no se ve ${que}`);
    await escena('apuntar', caja.x + caja.width / 2, caja.y + caja.height / 2);
    await pausa(700);
  };

  const pulsar = async (elemento, que, antesDelClic = () => {}) => {
    await escena('tocar', true);
    await pausa(140);
    antesDelClic();
    await elemento.click({ timeout: ESPERA_MS }).catch((falla) => {
      throw fallar(`no se pudo tocar ${que}`, falla);
    });
    await escena('tocar', false);
  };

  const tocar = async (elemento, que, opciones) => {
    await apuntar(elemento, que, opciones);
    await pulsar(elemento, que);
    await pausa(350);
  };

  const escribir = async (elemento, que, texto) => {
    await tocar(elemento, que);
    await elemento.pressSequentially(texto, { delay: TECLA_MS });
    await pausa(300);
  };

  const pestana = async (nombre) => {
    await tocar(telefono.getByRole('button', { name: nombre, exact: true }), `la pestaña «${nombre}»`, { fijo: true });
    await aparece(region(nombre), `la pestaña «${nombre}» abierta`);
  };

  const cambiarTelefono = async (ficha, pestanaInicial, rotulo, listo) => {
    await escena('soltar');
    await escena('cambiarTelefono', `/conectar/${ficha}#${pestanaInicial}`, rotulo);
    await pausa(ASIENTO_MS);
    const desde = Math.max(cuadros.length - 1, protegido + 1, 0);
    const comienzo = performance.now();
    await aparece(listo, `la pantalla de «${rotulo}»`, { estado: 'attached' });
    tramos.push({ desde, hasta: cuadros.length, tipo: 'tope', valor: TOPE_ESPERA_S });
    descuentoMs += Math.max(0, performance.now() - comienzo - TOPE_ESPERA_S * 1000);
    await escena('encenderTelefono');
    await pausa(500);
  };

  return { sala, telefono, region, escena, cuadros, fallar, aparece, paso, anotar, leer, esperaCortable, omitir, acelerar, completar, acercar, apuntar, pulsar, tocar, escribir, pestana, cambiarTelefono };
}

async function rodar(r, d) {
  const { sala, telefono, region, escena, cuadros, fallar, aparece, paso, anotar, leer, esperaCortable, omitir, acelerar, completar, acercar, apuntar, pulsar, tocar, escribir, pestana, cambiarTelefono } = r;
  const { prep, cliente, fichas, codigo, opciones, resumen, guardarSecreto, pagina } = d;
  const antonia = porId('antonia');
  const cuenta = PERSONAS_DEMO.get('antonia').correo;
  const fuentes = region('Fuentes');
  const tu = region('Tú');
  const agente = region('Agente');
  const equipo = region('Equipo');
  const filaDeSenal = (titulo, frase) => tu.getByRole('button', { name: new RegExp(`^${literal(titulo)}\\s*${literal(frase)}`) });
  const detalleDeSenal = tu.locator('.rd-item__detail').first();
  const hiloEnTelefono = (pide, ayuda) => equipo.getByRole('button', { name: new RegExp(`El agente de ${literal(pide)} le escribió al de ${literal(ayuda)}`) }).first();
  const mensajesDelHilo = equipo.locator('.rd-item__detail').filter({ hasText: 'Agente de ' }).first();
  const filaEnSala = (pide, ayuda) => sala.getByText(`${pide} → ${ayuda}`, { exact: true }).first();
  const filaDePropuesta = (texto) => equipo.locator('.rd-list > div').filter({ hasText: texto }).first();

  await paso(1, ROTULOS.e1);
  await completar();

  await paso(2, ROTULOS.e2);
  const crearLinea = agente.getByRole('button', { name: 'Crear la línea', exact: true });
  await cambiarTelefono(fichas.get('antonia'), 'agente', 'Teléfono de Antonia', crearLinea);
  await tocar(crearLinea, 'el botón «Crear la línea»');
  const lineaEnPantalla = agente.locator('.rd-code').first();
  await aparece(lineaEnPantalla, 'la línea para el agente');
  const codigoDeIngreso = /\/a\/([0-9A-Za-z]+)/.exec(await lineaEnPantalla.innerText())?.[1];
  if (!codigoDeIngreso) throw fallar('la línea del teléfono no trae un link de ingreso');
  await tocar(agente.getByRole('button', { name: 'Copiar la línea', exact: true }), 'el botón «Copiar la línea»');
  const { tipo, etiqueta } = antonia.asistente;
  const { archivos } = antonia.repo;
  const mensaje = `Primer contexto de ${antonia.nombre}`;
  const documento = await cliente.api(`/a/${codigoDeIngreso}`);
  await anotar(`guion como Claude Code › GET /a/… · lee las instrucciones del link de la línea (${kilos(documento)} KB)`);
  await pausa(600);
  await anotar(`guion como Claude Code › POST /api/assistants/join {"kind":"${tipo}","label":"${etiqueta}"}`);
  const ingreso = await cliente.api('/api/assistants/join', { metodo: 'POST', cuerpo: { code: codigoDeIngreso, kind: tipo, label: etiqueta } });
  guardarSecreto(ingreso.token);
  await pausa(600);
  await anotar(`guion como Claude Code › POST /api/repo/commit «${mensaje}» · ${archivos.map((archivo) => archivo.path).join(', ')}`);
  const cambio = await cliente.api('/api/repo/commit', { metodo: 'POST', token: ingreso.token, cuerpo: { message: mensaje, topics: [], files: archivos } });
  await anotar(`  ← 201 · ${cambio.files} archivos en el repo de ${antonia.nombre} · lo hizo el guion: no corrió ninguna sesión de Claude Code`, true);
  const asistenteConectado = agente.getByText(etiqueta, { exact: true }).first();
  await esperaCortable(
    Promise.all([aparece(asistenteConectado, `«${etiqueta}» en el teléfono`), aparece(agente.getByRole('button', { name: /README\.md/ }).first(), 'los archivos del repo en el teléfono')]),
  );
  await apuntar(asistenteConectado, `«${etiqueta}» en el teléfono`);
  await leer(900);
  await acercar(agente.getByRole('button', { name: /ahora\.md/ }).first(), 'los cuatro archivos del repo');
  await esperaCortable(aparece(sala.getByText('Claude Code', { exact: true }).first(), '«Claude Code» bajo Antonia en la sala'));
  await escena('soltar');
  await completar();

  await paso(3, ROTULOS.e3);
  await pestana('Fuentes');
  await apuntar(fuentes.getByRole('button', { name: /^Apple Health/ }), 'la fila de Apple Health');
  await anotar(`guion como el Atajo de iOS › POST /api/ingest/health/… ${JSON.stringify(antonia.salud[0])} · a la dirección personal de Antonia`);
  const sueno = await prep.pasosDeAntonia.salud(cliente, fichas.get('antonia'));
  await anotar(`  ← 201 · ${sueno.resumen ?? 'guardado'} · lo envía el guion: no hubo iPhone`, true);
  await esperaCortable(aparece(fuentes.getByText(/Último registro/).first(), '«Último registro» en Apple Health'));
  await leer(1100);
  const dosFilas = () => aparece(fuentes.getByText(cuenta, { exact: true }).nth(1), 'las dos filas de Google conectadas');
  if (opciones.permiso === 'pantalla') {
    await tocar(fuentes.getByRole('link', { name: 'Conectar Google Calendar', exact: true }), '«Conectar» de Google Calendar');
    const permitir = telefono.getByRole('link', { name: 'Permitir', exact: true });
    await esperaCortable(aparece(permitir, 'la pantalla de permiso simulada'));
    await anotar('proveedor simulado › pantalla de prueba del servidor de demo: no es Google y la cuenta no existe');
    await leer(2600);
    await apuntar(permitir, 'el botón «Permitir»');
    let recarga = null;
    await pulsar(permitir, 'el botón «Permitir»', () => {
      recarga = omitir(cuadros.length);
    });
    await escena('soltar');
    await dosFilas();
    await pausa(2 * ASIENTO_MS);
    recarga.hasta(cuadros.length - 1);
  } else {
    await anotar(SIN_PANTALLA_DE_PERMISO);
    await cliente.conectarOAuth(fichas.get('antonia'), 'google', antonia.id);
    await esperaCortable(dosFilas());
  }
  await apuntar(fuentes.getByText(cuenta, { exact: true }).first(), 'la fila de Google Calendar conectada');
  const guardados = await prep.dosGuardados(cliente, fichas.get('antonia'));
  await anotar(`guardado › correo · ${guardados.correo}`);
  await pausa(700);
  await anotar(`guardado › reunión · ${guardados.reunion}`);
  await pausa(700);
  await anotar(NOTA_DEL_CORREO);
  await escena('soltar');
  await completar();

  await paso(4, ROTULOS.e4);
  await tocar(fuentes.getByRole('button', { name: 'Conectar Granola', exact: true }), '«Conectar» de Granola');
  await anotar('guion como Antonia › escribe una llave de prueba; la revisa el proveedor simulado, no Granola');
  await escribir(fuentes.getByLabel('Llave de Granola', { exact: true }), 'el campo «Llave de Granola»', `grn_demo_${antonia.id}`);
  await tocar(fuentes.getByRole('button', { name: 'Conectar', exact: true }), 'el botón «Conectar» de la llave');
  const conGranola = fuentes.getByText(`Conectado como ${cuenta}. ${nuevos(antonia.espera.conexiones.granola)}`, { exact: true });
  await esperaCortable(aparece(conGranola, 'el resultado de conectar Granola'));
  await apuntar(conGranola, 'el resultado de conectar Granola');
  await completar();

  await paso(5, ROTULOS.e5);
  await pestana('Tú');
  await anotar('guion como Antonia › marca cómo llega y escribe qué la frena');
  await tocar(tu.getByRole('group', { name: 'Cómo llegas hoy' }).getByRole('button', { name: ANIMO[antonia.checkin.mood], exact: true }), `«${ANIMO[antonia.checkin.mood]}» en el check-in`);
  await escribir(tu.getByLabel('Bloqueo', { exact: true }), 'el campo «Bloqueo»', antonia.checkin.blocker);
  await tocar(tu.getByRole('button', { name: 'Guardar check-in', exact: true }), '«Guardar check-in»');
  await esperaCortable(aparece(tu.getByText(/Último check-in:/).first(), 'la línea «Último check-in»'));
  await escena('soltar');
  await completar();

  const deAntonia = await prep.verificar(cliente, fichas, ['antonia']);
  if (deAntonia.length > 0) throw fallar(`el producto no dice de Antonia lo que el guion espera antes de mostrar su carga:\n${deAntonia.join('\n')}`);
  await paso(6, ROTULOS.e6);
  await tocar(filaDeSenal('Carga', antonia.espera.load.statement), 'la fila «Carga» de Antonia');
  await aparece(tu.getByText(origenDe(antonia.espera.load), { exact: true }), `«${origenDe(antonia.espera.load)}»`);
  await acercar(detalleDeSenal, 'el detalle de la carga');
  await escena('soltar');
  await completar();

  await paso(7, ROTULOS.e7);
  await pestana('Equipo');
  const pregunta = equipo.getByText(`¿Pido ayuda con «${antonia.checkin.blocker}»?`, { exact: true });
  await esperaCortable(aparece(pregunta, 'la pregunta del agente de Antonia'));
  await acercar(pregunta, 'la pregunta del agente de Antonia');
  await leer(1200);
  await anotar('guion como Antonia › toca «Permitir» en su teléfono');
  await tocar(equipo.getByRole('button', { name: `Permitir pedir ayuda con ${antonia.checkin.blocker}`, exact: true }), '«Permitir»');
  await aparece(pregunta, 'la pregunta del agente de Antonia', { estado: 'detached' });
  await escena('soltar');
  await completar();

  await paso(8, ROTULOS.e8);
  await anotar('guion › hace entrar a nueve personas que creó y conectó antes de grabar');
  for (const [posicion, persona] of ELENCO.slice(1).entries()) {
    const llega = performance.now();
    await prep.entrar(cliente, codigo, fichas.get(persona.id));
    await anotar(persona.enRegistro);
    const fila = sala.getByText(persona.nombre, { exact: true }).first();
    const esperado = await esperaCortable(aparece(fila, `a ${persona.nombre} en la pantalla de la sala`).then(() => performance.now()));
    if (posicion >= LLEGADA_QUE_DESPLAZA) await acercar(fila, `la fila de ${persona.nombre} en la sala`);
    const yaMostrado = Math.min(esperado - llega, TOPE_ESPERA_S * 1000) + (performance.now() - esperado);
    await leer(Math.max(350, ENTRE_LLEGADAS_S * 1000 - yaMostrado));
  }
  await aparece(sala.getByText('Sin agente todavía', { exact: true }).first(), '«Sin agente todavía» bajo Sebastián');
  await completar();

  const antesDeLaRonda = await cliente.api(`/api/rooms/${codigo}/state`);
  if (antesDeLaRonda.round !== null) throw fallar('la sala ya tiene una ronda antes del toque en «Iniciar ronda»');
  if (antesDeLaRonda.people.length !== ELENCO.length) throw fallar(`en la sala hay ${antesDeLaRonda.people.length} personas y se esperaban ${ELENCO.length}`);
  const deLaSala = (await prep.verificarSala?.(cliente, codigo)) ?? [];
  if (deLaSala.length > 0) throw fallar(`la sala no quedó como el guion espera antes de la ronda:\n${deLaSala.join('\n')}`);
  const llamadasAntes = (await cliente.api('/demo/estado')).llamadas?.total ?? 0;
  await acercar(sala.getByRole('heading', { level: 1 }), 'el título de la sala');
  await anotar('guion como Antonia › toca «Iniciar ronda» en su teléfono');
  await tocar(equipo.getByRole('button', { name: 'Iniciar ronda', exact: true }), '«Iniciar ronda»');
  await paso(9, ROTULOS.e9);
  await escena('soltar');
  const partioLaRonda = performance.now();
  const rondaDesde = cuadros.length;
  await escena('reloj', reloj(0));
  await anotar('ronda › la corre el producto: cada texto lo escribe el modelo en esta toma');
  const alEvento = async ({ type, payload }, nombres) => {
    const de = (id) => nombres.get(id) ?? 'alguien';
    if (type === 'hilo_abre') await anotar(`hilo › ${de(payload.from)} → ${de(payload.to)} · ${payload.topic}`);
    if (type === 'hilo_responde') await anotar(`  ← el agente de ${de(payload.to)} responde: ${RESPUESTA[payload.help] ?? payload.help}`, true);
    if (type === 'propuesta_nace') await anotar(`propuesta › para ${de(payload.from)} con ${enLista((payload.helpers ?? []).map(de))}`);
  };
  const tictac = setInterval(() => escena('reloj', reloj((performance.now() - partioLaRonda) / 1000)).catch(() => {}), RELOJ_CADA_MS);
  const ronda = await prep.esperarRonda(cliente, codigo, { limiteMs: ESPERA_RONDA_MS, alEvento }).finally(() => clearInterval(tictac));
  const enPantalla = Math.floor((performance.now() - partioLaRonda) / 1000);
  await escena('reloj', reloj(enPantalla));
  acelerar(rondaDesde, partioLaRonda);
  if (ronda.vencio) throw fallar(`la ronda no terminó en ${ESPERA_RONDA_MS / 1000} s`);

  const servidorDespues = await cliente.api('/demo/estado');
  const resultado = await prep.leerResultado(cliente, codigo, fichas);
  const eleccion = prep.elegirVariante(resultado, { parcialVale: opciones.parcialVale });
  const pedidoDe = (id, condicion = () => true) => resultado.pedidos.find((pedido) => idDe(pedido.pide) === id && condicion(pedido));
  const hiloElegido = eleccion.pide ? pedidoDe(eleccion.pide, (pedido) => pedido.hilos.some((hilo) => idDe(hilo.ayuda) === eleccion.quien))?.hilos.find((hilo) => idDe(hilo.ayuda) === eleccion.quien) : null;
  Object.assign(resumen, {
    variante: eleccion.variante,
    motivo: eleccion.motivo,
    puertas: eleccion.puertas,
    conversaciones: resultado.pedidos.flatMap((pedido) => pedido.hilos.map((hilo) => ({ pide: pedido.pide, ayuda: hilo.ayuda, tema: pedido.tema, respuesta: hilo.help }))),
    hiloElegido: hiloElegido ? { pide: NOMBRE[eleccion.pide], ayuda: hiloElegido.ayuda, mensajes: hiloElegido.mensajes } : null,
    propuestas: resultado.pedidos.filter((pedido) => pedido.propuesta).map(({ pide, propuesta }) => ({ pide, texto: propuesta.texto, estado: propuesta.estado, ayudantes: propuesta.ayudantes })),
    ronda: {
      segundosReales: ronda.segundos,
      segundosEnPantalla: enPantalla,
      factor: ACELERA_RONDA,
      llamadas: (servidorDespues.llamadas?.total ?? 0) - llamadasAntes,
      servidor: servidorDespues.llamadas ?? null,
    },
  });
  await anotar(`  ← ronda ${resultado.ronda.status} · ${resultado.hilos} conversaciones · ${resumen.ronda.llamadas} llamadas al modelo`, true);
  if (eleccion.variante === 'retoma') return false;
  if (!hiloElegido) throw fallar(`la variante ${eleccion.variante} no trae la conversación que se muestra`);
  await completar(2000, 3500);

  const conAyuda = pedidoDe('antonia', (pedido) => pedido.propuesta !== null && pedido.hilos.some((hilo) => hilo.help === 'si'));
  const ayudantes = conAyuda.propuesta.ayudantes;
  const noAceptaElGuion = ['antonia', ...(eleccion.propuestaDeIgnacio ? [eleccion.propuestaDeIgnacio] : [])];
  const alAceptar = async (nombre) => {
    await anotar(`el guion acepta por ${nombre}`);
    await pausa(450);
  };
  await escena('reloj', null);
  await paso(10, eleccion.ayudantesDeAntonia === 2 ? ROTULOS.e10.dos : ROTULOS.e10.una);
  for (const ayudante of ayudantes) {
    await apuntar(filaEnSala(antonia.nombre, ayudante), `la fila «${antonia.nombre} → ${ayudante}» en la sala`);
    await leer(700);
  }
  const hiloDeAntonia = hiloEnTelefono(antonia.nombre, ayudantes[0]);
  await anotar('guion como Antonia › lee la conversación de su agente y toca «Aceptar»');
  await esperaCortable(aparece(hiloDeAntonia, 'la conversación del agente de Antonia en su teléfono'));
  await tocar(hiloDeAntonia, 'la conversación del agente de Antonia');
  await acercar(mensajesDelHilo, 'los mensajes de la conversación de Antonia');
  await escena('soltar');
  await leer(3000);
  await tocar(hiloDeAntonia, 'la conversación del agente de Antonia');
  const propuestaDeAntonia = filaDePropuesta(conAyuda.propuesta.texto);
  await esperaCortable(aparece(propuestaDeAntonia, 'la propuesta para Antonia en su teléfono'));
  await tocar(propuestaDeAntonia.getByRole('button', { name: 'Aceptar la propuesta', exact: true }), '«Aceptar» en la propuesta');
  for (const ayudante of ayudantes) {
    await prep.aceptarPendientes(cliente, new Map([[idDe(ayudante), fichas.get(idDe(ayudante))]]), { excepto: noAceptaElGuion, alAceptar });
  }
  const acordada = propuestaDeAntonia.getByText('Acordada', { exact: true });
  await esperaCortable(aparece(acordada, '«Acordada» en la propuesta de Antonia'));
  await apuntar(acordada, '«Acordada» en la propuesta de Antonia');
  await prep.aceptarPendientes(cliente, fichas, { excepto: noAceptaElGuion, alAceptar });
  await escena('soltar');
  await completar();

  const pide = porId(eleccion.pide);
  const quien = porId(eleccion.quien);
  const ignacio = porId('ignacio');
  const bloqueo = ignacio.espera.bloqueos[0].statement;
  await paso(11, ROTULOS.e11);
  await anotar('guion › abre el teléfono de Ignacio y su fila «Bloqueos»');
  const bloqueos = filaDeSenal('Bloqueos', bloqueo);
  await cambiarTelefono(fichas.get('ignacio'), 'tu', 'Teléfono de Ignacio', bloqueos);
  await tocar(bloqueos, 'la fila «Bloqueos» de Ignacio');
  await aparece(detalleDeSenal.getByText(bloqueo, { exact: true }), 'el bloqueo de Ignacio que salió de Linear');
  await acercar(detalleDeSenal, 'el detalle del bloqueo de Ignacio');
  await escena('soltar');
  await anotar('nota › nadie escribió este pedido: el conector de Linear vio una tarea sin avances hace 4 días');
  if (eleccion.variante === 'V2') {
    const suHilo = pedidoDe('ignacio')?.hilos.find((hilo) => idDe(hilo.ayuda) === 'catalina') ?? pedidoDe('ignacio')?.hilos[0];
    if (suHilo) {
      await leer(2200);
      await pestana('Equipo');
      await apuntar(hiloEnTelefono(ignacio.nombre, suHilo.ayuda), `la conversación de Ignacio con ${suHilo.ayuda}`);
      await leer(2500);
      await escena('soltar');
    }
  }
  await completar();

  await paso(12, ROTULOS.e12[eleccion.variante]);
  await apuntar(filaEnSala(pide.nombre, quien.nombre), `la fila «${pide.nombre} → ${quien.nombre}» en la sala`);
  await leer(800);
  const hiloDeLaCausa = hiloEnTelefono(pide.nombre, quien.nombre);
  if (eleccion.variante === 'V2') {
    await anotar(`guion › abre el teléfono de ${quien.nombre} y la conversación con el agente de ${pide.nombre}`);
    await cambiarTelefono(fichas.get(quien.id), 'equipo', `Teléfono de ${quien.nombre}`, hiloDeLaCausa);
  } else {
    await anotar(`guion › abre la conversación en el teléfono de ${pide.nombre}`);
    await pestana('Equipo');
  }
  await tocar(hiloDeLaCausa, `la conversación de ${pide.nombre} con ${quien.nombre}`);
  await acercar(mensajesDelHilo, 'los dos mensajes de la conversación');
  await escena('soltar');
  await completar(6000);

  await paso(13, ROTULOS.e13[eleccion.variante]);
  await anotar(`guion › abre «Tú» en el teléfono de ${quien.nombre}: lo que solo ve ${quien.nombre}`);
  const energia = filaDeSenal('Energía', quien.espera.energy.statement);
  if (eleccion.variante === 'V2') await pestana('Tú');
  else await cambiarTelefono(fichas.get(quien.id), 'tu', `Teléfono de ${quien.nombre}`, energia);
  await tocar(energia, `la fila «Energía» de ${quien.nombre}`);
  await aparece(tu.getByText(origenDe(quien.espera.energy), { exact: true }), `«${origenDe(quien.espera.energy)}»`);
  await acercar(detalleDeSenal, `el detalle de la energía de ${quien.nombre}`);
  await escena('soltar');
  await completar();

  await paso(14, ROTULOS.e14[eleccion.variante]);
  if (quien.espera.load.basis.length > 0) {
    await tocar(filaDeSenal('Carga', quien.espera.load.statement), `la fila «Carga» de ${quien.nombre}`);
    await aparece(tu.getByText(origenDe(quien.espera.load), { exact: true }), `«${origenDe(quien.espera.load)}»`);
    await acercar(detalleDeSenal, `el detalle de la carga de ${quien.nombre}`);
    await escena('soltar');
  }
  await anotar(NOTA_DE_LO_PRIVADO[quien.id]);
  await completar();

  if (eleccion.propuestaDeIgnacio) {
    const descartable = pedidoDe('ignacio', (pedido) => pedido.propuesta?.id === eleccion.propuestaDeIgnacio);
    if (!descartable) throw fallar('no está la propuesta de Ignacio que Catalina tiene que descartar');
    await paso('14b', ROTULOS.e14b);
    await pestana('Equipo');
    const propuestaDeIgnacio = filaDePropuesta(descartable.propuesta.texto);
    await esperaCortable(aparece(propuestaDeIgnacio, 'la propuesta de Ignacio en el teléfono de Catalina'));
    await anotar('guion como Catalina › toca «Ahora no» en su teléfono');
    await tocar(propuestaDeIgnacio.getByRole('button', { name: 'Rechazar la propuesta', exact: true }), '«Ahora no» en la propuesta');
    const descartada = propuestaDeIgnacio.getByText('Descartada', { exact: true });
    await aparece(descartada, '«Descartada» en la propuesta de Ignacio');
    await apuntar(descartada, '«Descartada» en la propuesta de Ignacio');
    await escena('soltar');
    await completar();
  }

  const alFinal = await prep.leerResultado(cliente, codigo, fichas);
  resumen.propuestas = alFinal.pedidos.filter((pedido) => pedido.propuesta).map(({ pide: suPedido, propuesta }) => ({ pide: suPedido, texto: propuesta.texto, estado: propuesta.estado, ayudantes: propuesta.ayudantes }));

  await paso(15, ROTULOS.e15(resultado.hilos));
  await escena('apagarTelefono');
  await escena('rotuloTelefono', 'Un teléfono');
  if (opciones.sinGlobo) {
    await acercar(sala.getByRole('heading', { level: 1 }), 'el título de la sala');
    await anotar('guion › se queda en la pantalla de la sala: cada fila de arriba es una conversación');
    await completar(4000);
  } else {
    const alGlobo = sala.getByRole('link', { name: 'Ver la sala en el globo', exact: true });
    await acercar(alGlobo, 'el link al globo en la pantalla de la sala');
    await pagina.emulateMedia({ reducedMotion: 'reduce' });
    await anotar('guion › abre el globo quieto, con movimiento reducido; las cinco primeras caras son dibujos del equipo');
    await tocar(alGlobo, 'el link «Ver la sala en el globo»');
    await escena('soltar');
    await esperaCortable(aparece(sala.frameLocator('#globo').locator('#c'), 'el globo de la sala', { estado: 'attached' }));
    await completar(6000);
  }

  await paso(16, ROTULOS.e16);
  await escena('cierre', CIERRE);
  await completar(SEGUNDOS[16] * 1000);
  return true;
}

async function main() {
  const opciones = leerOpciones();
  const prep = await import('./preparar2.mjs');
  const { chromium } = createRequire(import.meta.url)(path.join(REPO, '.agents/skills/stageshow/node_modules/playwright-core'));
  if (!existsSync(chromium.executablePath())) throw new Error('Falta el Chromium que trae Playwright en .agents/skills/stageshow. Este guion no graba con el Chrome del sistema.');
  const fichas = new Map();
  const limpio = (valor) => prep.sinFichas(velo.cubrirTodo(valor), fichas);
  const decir = (linea) => console.log(limpio(linea));

  const carpetaDeCuadros = await carpetaNueva(opciones.cuadros, 'cuadros');
  const capturas = opciones.capturas ? await carpetaNueva(opciones.capturas, 'capturas') : null;
  await mkdir(path.dirname(opciones.salida), { recursive: true });
  const escenario = await readFile(path.join(REPO, 'design/demo/escenario2.html'), 'utf8');
  const direccionDelEscenario = `${opciones.base}/design/demo/escenario2.html`;

  const cliente = prep.crearCliente({ base: opciones.base });
  const servidor = await prep.comprobarServidor(cliente);
  decir(`Toma ${opciones.toma} sobre ${opciones.base} · commit ${servidor.commit ?? 'sin anotar'} · modelo ${servidor.modelo ?? 'sin anotar'} · hoy ${servidor.hoy}`);
  const { codigo, ficha } = await prep.abrirSala(cliente);
  velo.guardar(ficha);
  fichas.set('antonia', ficha);
  decir(`Sala «${SALA}» abierta · Antonia adentro, sin agente todavía`);
  for (const [id, suFicha] of await prep.prepararElenco(cliente, { anotar: (linea) => decir(`  ${linea}`) })) {
    velo.guardar(suFicha);
    fichas.set(id, suFicha);
  }
  const diferencias = await prep.verificar(cliente, fichas, ELENCO.slice(1).map((persona) => persona.id));
  if (diferencias.length > 0) throw new Error(limpio(`El producto no dice de las nueve personas lo que el guion espera. No se graba.\n${diferencias.join('\n')}`));
  decir('Las nueve personas quedaron como se esperaba. Empieza la grabación.');

  const resumen = {
    titulo: TITULO,
    sala: SALA,
    base: opciones.base,
    commit: servidor.commit ?? null,
    modelo: servidor.modelo ?? null,
    toma: opciones.toma,
    opciones: { permiso: opciones.permiso, sinGlobo: opciones.sinGlobo, parcialVale: opciones.parcialVale },
    variante: null,
    publicable: false,
    motivo: null,
    puertas: null,
    pasos: [],
    personas: ELENCO.map((persona) => ({ nombre: persona.nombre, asistente: persona.asistente?.etiqueta ?? null, puerta: puertaDe(persona), fuentes: fuentesDe(persona) })),
    conversaciones: [],
    hiloElegido: null,
    propuestas: [],
    ronda: { segundosReales: null, factor: ACELERA_RONDA, llamadas: null },
    ediciones: { topeEsperaS: TOPE_ESPERA_S, omitidos: 0 },
    segundos: null,
    cuadros: 0,
  };
  const cuadros = [];
  const tramos = [];
  const escrituras = [];
  const archivoDelResumen = opciones.salida.replace(/\.mp4$/, '.json');
  const guardarResumen = () => writeFile(archivoDelResumen, `${JSON.stringify(limpio(resumen), null, 2)}\n`);
  const noPublicable = async (motivo) => {
    Object.assign(resumen, { publicable: false, motivo: limpio(motivo), cuadros: cuadros.length });
    await guardarResumen();
    decir(`No se publica esta toma: ${motivo}`);
    decir(`Resumen: ${archivoDelResumen} · los cuadros quedaron en ${carpetaDeCuadros}`);
    process.exitCode = 1;
  };

  const navegador = await chromium.launch({ headless: true });
  try {
    const contexto = await navegador.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 1, locale: 'es-CL', timezoneId: 'America/Santiago' });
    await contexto.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: opciones.base });
    const pagina = await contexto.newPage();
    await pagina.route(direccionDelEscenario, (ruta) => ruta.fulfill({ contentType: 'text/html; charset=utf-8', body: escenario }));
    await pagina.goto(direccionDelEscenario);
    const faltan = await pagina.evaluate((metodos) => metodos.filter((metodo) => typeof window.escena?.[metodo] !== 'function'), METODOS_DEL_ESCENARIO);
    if (faltan.length > 0) throw new Error(`Al escenario le faltan estos métodos: ${faltan.join(', ')}`);

    const r = crearRodaje({ pagina, cuadros, tramos, resumen, capturas, decir, cubrir: limpio });
    await r.escena('abrirSala', `/sala/${codigo}`);
    await r.aparece(r.sala.getByText('Escanea para entrar', { exact: true }), 'la pantalla de la sala');
    await r.aparece(r.sala.getByText(NOMBRE.antonia, { exact: true }).first(), 'Antonia en la pantalla de la sala');

    const cdp = await contexto.newCDPSession(pagina);
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      const archivo = path.join(carpetaDeCuadros, `c${String(cuadros.length).padStart(6, '0')}.jpg`);
      cuadros.push({ archivo, instante: metadata.timestamp });
      escrituras.push(writeFile(archivo, Buffer.from(data, 'base64')));
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: ANCHO, maxHeight: ALTO, everyNthFrame: 1 });

    const completa = await rodar(r, { prep, cliente, fichas, codigo, opciones, resumen, guardarSecreto: velo.guardar, pagina });
    await cdp.send('Page.stopScreencast');
    await Promise.all(escrituras);
    if (completa) await pagina.screenshot({ path: opciones.salida.replace(/\.mp4$/, '.png') });
  } catch (falla) {
    await Promise.allSettled(escrituras);
    await noPublicable(`la grabación se detuvo. ${falla?.message ?? falla}`);
    throw falla;
  } finally {
    await navegador.close().catch(() => {});
  }

  resumen.cuadros = cuadros.length;
  if (resumen.variante === 'retoma') return noPublicable(`la ronda pide una retoma. ${resumen.motivo}`);

  const porCuadro = duraciones(cuadros, tramos, { ultimo: ULTIMO_CUADRO_S });
  const largo = porCuadro.reduce((suma, duracion) => suma + duracion, 0);
  const enElVideo = cuadros.flatMap((cuadro, posicion) => (porCuadro[posicion] > 0 ? [{ archivo: cuadro.archivo, duracion: porCuadro[posicion] }] : []));
  resumen.pasos = capitulos(resumen.pasos, porCuadro);
  resumen.ediciones.omitidos = cuadros.length - enElVideo.length;
  resumen.segundos = Math.round(largo);
  if (enElVideo.length === 0) return noPublicable('la grabación no dejó ningún cuadro.');
  if (largo > opciones.maxSegundos) return noPublicable(`el video dura ${Math.round(largo)} s y el máximo es ${opciones.maxSegundos} s.`);

  const guia = path.join(carpetaDeCuadros, 'lista.txt');
  await writeFile(guia, `${enElVideo.map(({ archivo, duracion }) => `file '${archivo}'\nduration ${duracion.toFixed(3)}`).join('\n')}\nfile '${enElVideo.at(-1).archivo}'\n`);
  try {
    await ejecutar('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', guia, '-vf', FILTRO, '-c:v', 'libx264', '-crf', '22', '-preset', 'medium', '-movflags', '+faststart', opciones.salida]);
  } catch (falla) {
    await noPublicable(`ffmpeg no armó el video. ${String(falla?.message ?? falla).split('\n')[0]}`);
    throw falla;
  }

  resumen.publicable = true;
  await guardarResumen();
  decir(`Video: ${opciones.salida} · ${resumen.segundos} s · ${cuadros.length} cuadros · variante ${resumen.variante}`);
  decir(`Antes de publicar, una persona lee los dos mensajes de «hiloElegido» en ${archivoDelResumen}. Los cuadros quedaron en ${carpetaDeCuadros}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((falla) => {
    console.error(velo.cubrir(falla instanceof Error ? (falla.stack ?? falla.message) : String(falla)));
    process.exitCode = 1;
  });
}
