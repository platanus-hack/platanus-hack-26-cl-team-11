// Servidor de la demo «Diez personas, sus fuentes y sus agentes». Es el producto, con cuatro diferencias declaradas:
// las respuestas de los proveedores salen de proveedor-demo.mjs, la pantalla de permiso es design/demo/permiso.html,
// no hay ronda automática y el modelo es Claude por la terminal, fijo y con un reintento. Además hace una llamada de calentamiento
// al partir, responde /demo/estado y no vuelve a sincronizar las fuentes cada 15 minutos (no llama a startScheduler).
// Solo lo arranca quien dirige la grabación.
//
//   DATA_DIR=<carpeta nueva fuera del repo> PORT=8797 DEMO_COMMIT=<sha> npx tsx tools/grabar/servidor-demo.mts
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as z from 'zod/v4';
import { CLAUDE_CLI_MODEL, createClaudeCliModel } from '../../backend/src/agents/claudeCli.js';
import { AgentModelError, type AgentModel } from '../../backend/src/agents/model.js';
import { startAgentRoutine } from '../../backend/src/agents/routine.js';
import { createApp } from '../../backend/src/app.js';
import { createContext, type AppContext } from '../../backend/src/context.js';
import { designAssets } from '../../backend/src/designAssets.js';
import { OAUTH_PROVIDERS } from '../../backend/src/oauth/registry.js';
import type { Fetch } from '../../backend/src/types.js';
import { ARRANQUE, HOY, PERSONAS_DEMO, SALA, idDe } from './elenco2.mjs';
import { createDemoFetch } from './proveedor-demo.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGINA_PERMISO = join(RAIZ, 'design', 'demo', 'permiso.html');
const FRONTEND = join(RAIZ, 'frontend', 'dist');
const PUERTO = 8797;
const EN_MEMORIA = ':memory:';
const CREDENCIAL_DEMO = { clientId: 'demo', clientSecret: 'demo' };
const PROVEEDORES_REALES = { ...OAUTH_PROVIDERS };
const FALTA_DATA_DIR = 'Define DATA_DIR con una carpeta nueva fuera del repo.';
const DATA_DIR_EN_EL_REPO = 'DATA_DIR apunta dentro del repo. Usa una carpeta nueva fuera del repo.';
const PERMISO_INVALIDO = 'Permiso de prueba no válido.';
const SIN_GUARDAR = { 'cache-control': 'no-store' };
const SIGNOS_HTML: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const Calentamiento = z.object({ listo: z.boolean() });

export interface Llamadas {
  total: number;
  fallidas: number;
  reintentos: number;
  segundos: number;
}

type App = ReturnType<typeof createApp>;

const escapar = (texto: string) => texto.replace(/[&<>"']/g, (signo) => SIGNOS_HTML[signo] ?? signo);
const decimas = (segundos: number) => Math.round(segundos * 10) / 10;
const modeloDeLaTerminal = () => process.env.AGENT_CLI_MODEL || CLAUDE_CLI_MODEL;

const rutaFisica = (ruta: string) => {
  const pedida = resolve(ruta);
  let existente = pedida;
  while (!existsSync(existente) && dirname(existente) !== existente) existente = dirname(existente);
  return join(realpathSync(existente), relative(existente, pedida));
};

const quedaEnElRepo = (ruta: string) => {
  const tramo = relative(realpathSync(RAIZ), rutaFisica(ruta));
  return !isAbsolute(tramo) && tramo !== '..' && !tramo.startsWith(`..${sep}`);
};

function carpetaDeDatos(pedida: string | undefined): string {
  const carpeta = pedida ?? process.env.DATA_DIR;
  if (!carpeta) throw new Error(FALTA_DATA_DIR);
  if (carpeta !== EN_MEMORIA && quedaEnElRepo(carpeta)) throw new Error(DATA_DIR_EN_EL_REPO);
  return carpeta;
}

function simularPermisos() {
  for (const [id, proveedor] of Object.entries(PROVEEDORES_REALES)) {
    OAUTH_PROVIDERS[id] = { ...proveedor, authorizeUrl: (pedido) => `/demo/permiso/${id}?${new URL(proveedor.authorizeUrl(pedido)).searchParams}` };
  }
}

export function conReintento(interno: AgentModel, llamadas: Llamadas): AgentModel {
  return {
    async decide(pedido) {
      const inicio = performance.now();
      llamadas.total += 1;
      const conUnaSegunda = async () => {
        try {
          return await interno.decide(pedido);
        } catch (falla) {
          if (!(falla instanceof AgentModelError)) throw falla;
          llamadas.reintentos += 1;
          return await interno.decide(pedido);
        }
      };
      try {
        return await conUnaSegunda();
      } catch (falla) {
        llamadas.fallidas += 1;
        throw falla;
      } finally {
        llamadas.segundos += (performance.now() - inicio) / 1000;
      }
    },
  };
}

export function crearServidorDemo(opciones: { location?: string; modelo?: AgentModel | null; paginaPermiso?: string } = {}): { app: App; ctx: AppContext; llamadas: Llamadas } {
  const location = carpetaDeDatos(opciones.location);
  const llamadas: Llamadas = { total: 0, fallidas: 0, reintentos: 0, segundos: 0 };
  const idDelModelo = opciones.modelo === undefined ? modeloDeLaTerminal() : null;
  const modelo = opciones.modelo === undefined ? conReintento(createClaudeCliModel({ model: modeloDeLaTerminal() }), llamadas) : opciones.modelo;
  const commit = process.env.DEMO_COMMIT || null;

  const ctx = createContext({
    location,
    fetch: createDemoFetch(PERSONAS_DEMO) as Fetch,
    config: { publicBaseUrl: null, agentRoundHour: null, oauth: Object.fromEntries(Object.keys(PROVEEDORES_REALES).map((id) => [id, CREDENCIAL_DEMO])) },
    model: modelo,
  });
  simularPermisos();
  const app = createApp(ctx);
  app.route('/', designAssets());

  const idDelPermiso = (proveedor: string, sello: string): string | null => {
    try {
      const estado = JSON.parse(ctx.vault.open(sello)) as { token?: unknown; provider?: unknown } | null;
      if (typeof estado?.token !== 'string' || estado.provider !== proveedor) return null;
      const id = idDe(ctx.store.findPerson(estado.token)?.name ?? '');
      return PERSONAS_DEMO.has(id) ? id : null;
    } catch {
      return null;
    }
  };

  app.get('/demo/permiso/:proveedor', (c) => {
    const proveedor = c.req.param('proveedor');
    const sello = c.req.query('state') ?? '';
    const vuelta = c.req.query('redirect_uri') ?? '';
    const id = idDelPermiso(proveedor, sello);
    const cuenta = id === null ? undefined : PERSONAS_DEMO.get(id);
    if (id === null || !cuenta || vuelta !== `${new URL(c.req.url).origin}/api/oauth/${proveedor}/callback`) return c.text(PERMISO_INVALIDO, 400);
    const enlace = (respuesta: Record<string, string>) => `${vuelta}?${new URLSearchParams({ ...respuesta, state: sello })}`;
    const pagina = (opciones.paginaPermiso ?? readFileSync(PAGINA_PERMISO, 'utf8'))
      .replaceAll('{{CUENTA}}', () => escapar(proveedor === 'github' ? cuenta.github : cuenta.correo))
      .replaceAll('{{PERMITIR}}', () => escapar(enlace({ code: `demo-${id}` })))
      .replaceAll('{{CANCELAR}}', () => escapar(enlace({ error: 'access_denied' })));
    return c.html(pagina, 200, SIN_GUARDAR);
  });

  app.get('/demo/estado', (c) =>
    c.json(
      {
        commit,
        arrancoEn: ARRANQUE.toISOString(),
        hoy: HOY,
        sala: SALA,
        modelo: idDelModelo,
        rondaSola: (ctx.config.agentRoundHour ?? null) !== null,
        llamadas: { ...llamadas, segundos: decimas(llamadas.segundos) },
      },
      200,
      SIN_GUARDAR,
    ),
  );

  if (existsSync(join(FRONTEND, 'index.html'))) {
    const root = relative(process.cwd(), FRONTEND) || '.';
    app.use('*', serveStatic({ root }));
    app.get('*', serveStatic({ root, path: 'index.html' }));
  }

  return { app, ctx, llamadas };
}

async function calentar(modelo: AgentModel | null) {
  if (!modelo) return;
  const inicio = performance.now();
  const segundos = () => decimas((performance.now() - inicio) / 1000);
  try {
    await modelo.decide({ system: 'Respondes solo con el dato que se te pide.', prompt: 'Devuelve «listo» con el valor verdadero.', schema: Calentamiento });
    console.log(`Calentamiento del modelo: ${segundos()} s.`);
  } catch (falla) {
    console.error(`El calentamiento del modelo falló a los ${segundos()} s: ${falla instanceof Error ? falla.message : 'error desconocido'}`);
  }
}

function arrancar() {
  const carpeta = process.env.DATA_DIR ?? '';
  if (carpeta && carpeta !== EN_MEMORIA && existsSync(join(carpeta, 'ronda.db'))) console.warn('Aviso: DATA_DIR ya tiene una base de datos. Para una toma usa una carpeta nueva.');
  if (!existsSync(join(FRONTEND, 'index.html'))) console.warn('Aviso: falta frontend/dist. Corre npm run build: sin eso el servidor responde la API y no la app.');

  const { app, ctx } = crearServidorDemo();
  startAgentRoutine(ctx);
  const puerto = Number(process.env.PORT || PUERTO);
  serve({ fetch: app.fetch, port: puerto }, () => {
    console.log(`Servidor de demo en http://localhost:${puerto} · commit ${process.env.DEMO_COMMIT || 'sin anotar'} · hoy ${HOY} · sala «${SALA}» · modelo ${modeloDeLaTerminal()} · sin ronda automática`);
    void calentar(ctx.model);
  });
}

const esLaEntrada = () => {
  try {
    return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (esLaEntrada()) arrancar();
