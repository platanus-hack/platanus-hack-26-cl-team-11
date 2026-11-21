# Demo 2 de Ronda · build contracts

Script: `docs/demo/plan/guion-final.md` (cast, data, scenes, gates). This file says who builds what and how the pieces fit.
Repo root, called `R` below: `<repo>`. Checked at `98db251`.

Five builders work at the same time in the same checkout. **Only the lead starts a server, a browser, a model call or a film.**

---

## 0. Rules for every builder

1. Write only the files you own (section 2 to 6). All are new files. **No existing file changes.**
2. Never touch: `R/backend/src/**`, `R/frontend/**`, `R/design/grafo/**`, `R/design/ronda.css`, `R/design/tokens.css`, `R/tools/grabar/grabar.mjs`, `R/tools/grabar/personas.mjs`, `R/design/demo/escenario.html`, `R/docs/demo/README.md`, `R/docs/demo/camino-feliz.*`.
3. No git command that writes. No `npm install`. No server, no browser, no `claude` call, no `ffmpeg`. Never read `.env`.
4. Node 22 (`R/.nvmrc`; the shell default is 23.7, so run `nvm use` first). `.mts` files run with `npx tsx`.
5. Code in English or Spanish as the first recorder does (Spanish identifiers are fine). Every on-screen string in Chilean Spanish: no exclamation marks, no emojis, never «paciente», «cita» or «consulta».
6. No token, no `/conectar/<token>` link and no ingest address in any log line, console line, thrown message or JSON. Print `/conectar/…` and `/api/ingest/health/…`.
7. No demo back door in a production route. Everything demo-only lives in `R/tools/grabar/` and `R/design/demo/`.
8. Before you use a selector or a route, open the source file and check it. Other sessions edit this checkout.
9. If a contract here cannot be met, stop and tell the lead. Do not change the interface on your own.

### Shared constants

| Thing | Value |
|---|---|
| Base URL and port | `http://localhost:8797`, `PORT=8797` |
| Sala | `Equipo Quillay` |
| Persona ids, in join order | `antonia`, `ignacio`, `javiera`, `catalina`, `cristobal`, `felipe`, `fernanda`, `nicolas`, `martina`, `sebastian` |
| OAuth code and access token of the simulated provider | `demo-<id>` |
| Granola key | `grn_demo_<id>` |
| Accounts | Google, Linear, Granola: `<id>@ronda.example`. GitHub: `<id>-demo` |
| Time zone | `America/Santiago` |
| Stage address (answered by the recorder, not by the server) | `<base>/design/demo/escenario2.html` |
| Permission page address (answered by the demo server) | `<base>/demo/permiso/<google|github|linear>?redirect_uri=…&state=…` |

---

## 1. Map of the pieces

```
elenco2.mjs ──► proveedor-demo.mjs ──► servidor-demo.mts ──► (HTTP :8797)
     │                                        ▲                  ▲
     │                                permiso.html               │
     ├──────────────► preparar2.mjs ─────────────────────────────┤
     └──────────────► grabar2.mjs ──► escenario2.html            │
                          └── tiempos2.mjs        (Playwright) ──┘
```

| Builder | Owns |
|---|---|
| B1 `elenco` | `R/tools/grabar/elenco2.mjs`, `R/tools/grabar/proveedor-demo.mjs`, `R/tools/grabar/proveedor-demo.test.mts` |
| B2 `servidor` | `R/tools/grabar/servidor-demo.mts`, `R/tools/grabar/servidor-demo.test.mts`, `R/tools/grabar/ensayo-respuesta.mts` |
| B3 `escenario` | `R/design/demo/escenario2.html`, `R/design/demo/permiso.html` |
| B4 `preparar` | `R/tools/grabar/preparar2.mjs`, `R/tools/grabar/preparar2.test.mjs` |
| B5 `grabador` | `R/tools/grabar/grabar2.mjs`, `R/tools/grabar/tiempos2.mjs`, `R/tools/grabar/tiempos2.test.mjs`, `R/docs/demo/diez-personas.md` (draft) |
| Lead | `R/docs/demo/REHEARSAL.md`, one line in `R/docs/demo/README.md`, `R/docs/demo/diez-personas.{mp4,png,json}` |

---

## 2. B1 · cast and simulated provider

### 2.1 `R/tools/grabar/elenco2.mjs`

Plain ESM, no imports from the backend. All data of `guion-final.md` section 2, exactly.

```js
export const SALA = 'Equipo Quillay';
export const ZONA = 'America/Santiago';
export const ARRANQUE;   // Date, taken once when the module loads
export const HOY;        // 'YYYY-MM-DD' of ARRANQUE in ZONA
export const idDe;       // (nombre: string) => id   lower case, no accents: 'Cristóbal' -> 'cristobal'
export const ELENCO;     // Persona[], 10, join order
export const porId;      // (id: string) => Persona | undefined
export const PERSONAS_DEMO;  // Map<id, FixtureProveedor>, all 10 ids (empty arrays when a person has no data)
```

```ts
type Persona = {
  id: string; nombre: string; rol: string; variable: string;      // variable: one Spanish sentence
  asistente: null | { tipo: 'claude-code'|'codex'|'chatgpt'|'cursor'|'openclaw'|'grok'|'claude'|'gemini';
                      puerta: 'link'|'pegado'; etiqueta: string; comparte: boolean };
  repo: null | { archivos: { path: string; share: 'siempre'|'preguntar'|'nunca'; content: string }[] }   // puerta 'link'
             | { pegado: string };                                                                        // puerta 'pegado'
  salud: object[];            // bodies for POST /api/ingest/health/<token>, sent in this order, as they are
  oauth: ('google'|'github'|'linear')[];
  granola: boolean;
  checkin: null | { mood: 'bien'|'normal'|'cansada'|'mal'; blocker?: string };
  enRegistro: string;         // log line when the person enters, e.g. 'Ignacio entra · Codex por link · GitHub y Linear'
  espera: {                   // what GET /api/people/<token>/signals and GET /api/people/<token> must return
    energy?: { level: string; statement: string; basis: string[] };
    load?:   { level: string; statement: string; basis: string[] };
    bloqueos?: { statement: string; source: 'checkin'|'linear'; visibility: string }[];   // exact list
    temas?: string[];                         // each must be included in signals.expertise
    conexiones?: Record<string, number>;      // source id -> sync.total, and connection.lastError === null
  };
};

type FixtureProveedor = {
  correo: string; github: string;
  reuniones: object[];   // Google Calendar items: { id, status:'confirmed', summary, start:{dateTime}, end:{dateTime}, attendees:[{email,self?,responseStatus}] }
  correos: object[];     // Gmail messages: { id, threadId, labelIds:['INBOX'], internalDate:'<ms>', payload:{ headers:[{name:'Subject'|'From'|'Date', value}] } }
  actividad: object[];   // GitHub events: PushEvent { id, type, created_at, repo:{name}, payload:{size} } · PullRequestEvent { …, payload:{ action, pull_request:{ title, html_url, merged } } }
  tareas: object[];      // Linear nodes: { id, identifier, title, url, updatedAt, createdAt, dueDate, priority, state:{ name, type } }
  notas: object[];       // Granola notes: { id, title, owner:{name,email}, created_at, web_url, attendees:[{name,email}], summary_text, calendar_event:{ scheduled_start_time, scheduled_end_time } }
};
```

Rules:

- Every date is computed from `ARRANQUE` when the module loads, and never again. «T 09:30» means 09:30 of `HOY` in `ZONA`, as an ISO instant. Ignacio's `RON-212` has `updatedAt = ARRANQUE − 96 h`.
- Antonia's `salud` is `[{ sleep_hours: '23040,5' }]`. Catalina's 11 bodies carry `date`. Cristóbal's one body carries `date: HOY`.
- Antonia's `espera` is her state after scenes 2 to 5 (load `alta`, basis `['google_calendar','granola']`; energy `media`).
- Link personas get four files: `README.md`, `ahora.md`, `sabe.md` with `siempre`; `estado.md` with `preguntar`. `estado.md` holds one neutral sentence and nothing about sleep.
- Hosts are `.example` only. Organization `ronda-demo`.

### 2.2 `R/tools/grabar/proveedor-demo.mjs`

```js
export function createDemoFetch(personas /* Map<id, FixtureProveedor> */, { alLlamar } = {})
// returns async (input: string | URL, init?: RequestInit) => Response
// alLlamar?: (ruta: string) => void, called with 'METHOD host/pathname' on every call
```

Match on `METHOD host pathname`, never on a prefix. Answers (shapes: `mapa-oauth.md` sections 5 and 8.3 in the same scratch folder):

| Request | Answer |
|---|---|
| `POST oauth2.googleapis.com/token` | form `code` is `demo-<known id>`: `{ access_token: code, expires_in: 31536000 }` (number, no `refresh_token`). Else 400 `{ error: 'invalid_grant' }` |
| `POST github.com/login/oauth/access_token`, `POST api.linear.app/oauth/token` | `{ access_token: code }` or 400 as above |
| `GET www.googleapis.com/oauth2/v3/userinfo` | `{ email: correo }` |
| `GET www.googleapis.com/calendar/v3/calendars/primary/events` | `{ items: reuniones }`, no `nextPageToken` |
| `GET gmail.googleapis.com/gmail/v1/users/me/messages` | `{ messages: [{ id }] }` |
| `GET gmail.googleapis.com/gmail/v1/users/me/messages/<id>` | the message, or 404 `{}` |
| `GET api.github.com/user` | `{ login: github }` |
| `GET api.github.com/users/<login>/events` | the array `actividad` |
| `POST api.linear.app/graphql` | body query contains `assignedIssues`: `{ data: { viewer: { assignedIssues: { nodes: tareas } } } }`. Else `{ data: { viewer: { email: correo } } }` |
| `GET public-api.granola.ai/v1/notes` | `{ notes: [{ id, title, owner, created_at }], hasMore: false, cursor: null }` |
| `GET public-api.granola.ai/v1/notes/<id>` | the note, or 404 `{}` |
| a provider host with an unknown bearer | 401 `{}` |
| anything else | 404 `{}` |

The persona comes from `Authorization: Bearer demo-<id>` or `Bearer grn_demo_<id>`. **The function never calls the real `fetch`.**

### 2.3 `R/tools/grabar/proveedor-demo.test.mts`

Run: `cd R && npx tsx --test tools/grabar/proveedor-demo.test.mts`. In process, no port, no network, no model.

It builds the real app: `createContext({ location: ':memory:', fetch: createDemoFetch(PERSONAS_DEMO), config: { publicBaseUrl: null, agentRoundHour: null, oauth: { google: d, github: d, linear: d } }, model: null })` and `createApp(ctx)` (imports from `../../backend/src/context.js` and `../../backend/src/app.js`). For each persona it adds the person with `ctx.store.addPerson(nombre)` and drives the real routes with `app.request(...)`:

- OAuth: `GET /api/people/<token>/oauth/<p>/start` with header `sec-fetch-site: same-origin`; read `state` from the `location` header and the cookie from `set-cookie`; `GET /api/oauth/<p>/callback?code=demo-<id>&state=…` with that cookie. Pattern: `R/backend/test/oauth-github-linear.test.ts`, function `connect`.
- Granola: `POST /api/people/<token>/connections/granola` with `{ secret: 'grn_demo_<id>' }`.
- Health: one `POST /api/ingest/health/<token>` per body. Check-in: `POST /api/people/<token>/checkins`.

Asserts: every answer is 2xx or the expected 302 with no `aviso`; no `Error interno.`; `GET /api/people/<token>/signals` and `GET /api/people/<token>` match `espera` for all ten; an unknown URL gives 404; the call list from `alLlamar` holds only the 13 rules above.

**Acceptance B1**

- `node --check tools/grabar/elenco2.mjs && node --check tools/grabar/proveedor-demo.mjs`
- the test above passes under Node 22;
- `grep -nE 'paciente|cita|consulta|!' tools/grabar/elenco2.mjs` shows no on-screen string;
- `ELENCO.length === 10`, ids equal the shared list, and only Javiera's text contains «Necesita».

---

## 3. B2 · demo server and reply probe

### 3.1 `R/tools/grabar/servidor-demo.mts`

Run (lead only): `cd <root> && DATA_DIR=<new folder outside the repo> PORT=8797 DEMO_COMMIT=<short sha> npx tsx tools/grabar/servidor-demo.mts`

```ts
export interface Llamadas { total: number; fallidas: number; reintentos: number; segundos: number }
export function conReintento(interno: AgentModel, llamadas: Llamadas): AgentModel
//   counts every decide(); on AgentModelError retries once through the same `interno` (so the same limiter of 3)
export function crearServidorDemo(opciones?: { location?: string; modelo?: AgentModel | null; paginaPermiso?: string }): { app: Hono; ctx: AppContext; llamadas: Llamadas }
//   paginaPermiso: the HTML to use in place of design/demo/permiso.html (tests only)
```

`crearServidorDemo` does, in this order:

1. `location` = the option, else `process.env.DATA_DIR`. Missing: throw «Define DATA_DIR con una carpeta nueva fuera del repo.» A path inside the repo root (other than `':memory:'`): throw.
2. `modelo` = the option, else `conReintento(createClaudeCliModel({ model: process.env.AGENT_CLI_MODEL || CLAUDE_CLI_MODEL }), llamadas)`. It never reads `FIFTYX_*`, `ANTHROPIC_*` or `AGENT_CLI`. It loads no `.env`.
3. `createContext({ location, fetch: createDemoFetch(PERSONAS_DEMO), config: { publicBaseUrl: null, agentRoundHour: null, oauth: { google: demo, github: demo, linear: demo } }, model: modelo })` with `demo = { clientId: 'demo', clientSecret: 'demo' }`.
4. For each entry of `OAUTH_PROVIDERS` (`backend/src/oauth/registry.ts`): replace it with `{ ...provider, authorizeUrl: (input) => '/demo/permiso/' + id + '?' + new URL(provider.authorizeUrl(input)).searchParams }`. `exchange`, `identify` and `refresh` stay.
5. `createApp(ctx)`, then `app.route('/', designAssets())`.
6. Demo routes, **before** the static fallback:
   - `GET /demo/permiso/:proveedor` → HTML. Uses `paginaPermiso` if given; else reads `design/demo/permiso.html` from disk on each request. Opens the state in memory: `JSON.parse(ctx.vault.open(state)).token` → `ctx.store.findPerson(token)?.name` → `idDe(name)` → must be in the cast. Replaces three placeholders, HTML-escaped: `{{CUENTA}}` = the persona's `correo` (for `github`: the `github` login), `{{PERMITIR}}` = `<redirect_uri>?code=demo-<id>&state=<state>`, `{{CANCELAR}}` = `<redirect_uri>?error=access_denied&state=<state>`. A bad state or an unknown person: 400 with the plain text «Permiso de prueba no válido.» It never logs the state or the token.
   - `GET /demo/estado` → JSON, read only: `{ commit: process.env.DEMO_COMMIT ?? null, arrancoEn: <ISO>, hoy: HOY, sala: SALA, modelo: <model id>, rondaSola: false, llamadas }`.
7. Static frontend as `backend/src/index.ts` does: `root = relative(process.cwd(), frontendDist) || '.'`, `app.use('*', serveStatic({ root }))`, `app.get('*', serveStatic({ root, path: 'index.html' }))`.

Only when the file is the entry (`import.meta.url === pathToFileURL(process.argv[1]).href`): call `crearServidorDemo()`, `startAgentRoutine(ctx)` (no scheduler), `serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8797) })`, then one warm-up `decide` with a one-field schema, and print its seconds. The console prints no token.

No other demo route. No route writes events, connections or people.

### 3.2 `R/tools/grabar/servidor-demo.test.mts`

Run: `cd R && npx tsx --test tools/grabar/servidor-demo.test.mts`. Uses `crearServidorDemo({ location: ':memory:', modelo: <fake AgentModel> })` and `app.request`. Asserts:

- `GET /demo/estado` → 200, `rondaSola === false`, `hoy` is today in Santiago;
- `GET /api/people/<token>` → the three OAuth providers' sources have `configured: true`;
- start for Google (header `sec-fetch-site: same-origin`) → 302 whose `location` starts with `/demo/permiso/google?`; `GET` that location → 200 HTML containing `antonia@ronda.example` and a link to `/api/oauth/google/callback?code=demo-antonia`; following it with the cookie → 302 to `/conectar/…` with no `aviso`; then `google_calendar` and `gmail` have `connection.lastError === null`;
- the HTML does not contain the person's token;
- `conReintento`: a fake that fails once then answers gives one answer, `reintentos === 1`; a fake that fails twice throws.

The test passes `paginaPermiso` with a three-placeholder stub, so it does not wait for B3. The lead runs it once more without that option, against the real `permiso.html`.

### 3.3 `R/tools/grabar/ensayo-respuesta.mts`

Run (lead only, it calls the model): `cd <root> && npx tsx tools/grabar/ensayo-respuesta.mts --veces 6`

- Builds an in-memory context with the simulated provider and the real Claude CLI model, adds Ignacio, Javiera, Catalina and Felipe, connects their sources as the contract test does, and builds each card with the product's own code (`backend/src/agents/`).
- Calls `model.decide({ system: systemFor(nombre), prompt: replyPrompt(card, requesterName, need, message), schema: HelpReply })` `--veces` times for Catalina (topic «Conciliación de cobros con el banco», a fixed one-sentence message) and for Felipe (topic «animación en canvas»). At most 3 calls at once.
- Prints a table: person, `disponibilidad` of the card, count of `no`, `parcial`, `si`, and each reply text. Exit code 0 always. It asserts first that both cards have `availability === 'baja'` and stops if not.
- It changes no prompt. It imports them.

**Acceptance B2** (no model call): the test in 3.2 passes; `npx tsx tools/grabar/ensayo-respuesta.mts --ayuda` prints usage and exits without calling the model; `grep -n "env-file\|FIFTYX\|ANTHROPIC" tools/grabar/servidor-demo.mts` finds nothing.

---

## 4. B3 · stage and permission page

Read `R/design/DESIGN.md` whole and open `R/design/reference.html` first (AGENTS.md rule 3). Only `rd-*` primitives and `--rd-*` tokens. Layout rules may live in the page's own `<style>`; colours, fonts, weights, gradients and shadows may not. Both pages carry the Ronda favicon (the same data URI as `design/demo/escenario.html`).

### 4.1 `R/design/demo/escenario2.html`

Start from a copy of `escenario.html`. Keep: 1920 × 1080, desktop frame 1280 × 800 (a 1440 × 900 page scaled), phone 406 × 800 with a 390 × 784 iframe and `allow="clipboard-read; clipboard-write"`, a log of 4 lines, the pointer. Stylesheets: `../tokens.css`, `../ronda.css`.

Element ids (the recorder uses them): `#sala`, `#telefono`, `#marco-telefono`, `#registro`, `#puntero`, `#numero`, `#texto`, `#rotulo-sala`, `#rotulo-telefono`, `#aviso`, `#rotulo-registro`, `#reloj`, `#cierre`.

Always visible:

- `#aviso`, in the label row over the desktop frame, right-aligned, class `rd-label`: «Personas y datos inventados · proveedores simulados · un guion actúa por todas».
- `#rotulo-registro`, a left column of the log, class `rd-label`: «Lo que hace el guion en lugar de cada agente y de cada fuente». The four lines go in the right column.
- The header holds only the chip `#numero` and the caption `#texto`. Nothing else goes in the header, so a 70-character caption at 32 px never gets cut.

`window.escena`, existing methods unchanged: `paso(numero, texto)`, `rotuloTelefono(texto)`, `abrirTelefono(direccion)`, `anotar(linea, eco)`, `apuntar(x, y)`, `tocar(activo)`, `soltar()`.

New methods:

| Method | Does |
|---|---|
| `abrirSala(direccion, rotulo = 'Pantalla de la sala')` | Sets the desktop iframe `src` and `#rotulo-sala` |
| `apagarTelefono()` | Sets `data-apagado` on `#marco-telefono` (the frame stays, the content is hidden) |
| `encenderTelefono()` | Removes `data-apagado` |
| `cambiarTelefono(direccion, rotulo)` | `apagarTelefono()`, sets the phone `src` and its label. The phone stays off until `encenderTelefono()` |
| `reloj(texto)` | A string shows the chip `#reloj` with that text (the recorder sends «Tiempo real 0:47»). `null` hides it. The chip sits in the label row, not in the header |
| `cierre(listas)` | `{ titulo, real: string[], actuado: string[] }` hides both frames and shows `#cierre`: one glass card, two columns titled «Real» and «Actuado o simulado», each an `rd-list`. `null` restores the frames |
| `marca(nombre)` | Sets `document.body.dataset.mark = nombre` (for Stageshow `film.mjs --at`) |

Query string for review without the recorder: `?estado=ronda` shows the clock chip with a sample text and four sample log lines; `?estado=cierre` shows the closing card with the lists of `guion-final.md` 5.1; no query is the normal state.

### 4.2 `R/design/demo/permiso.html`

Served by B2 at `/demo/permiso/<proveedor>`, shown inside the 390 px phone frame. Stylesheets by absolute path: `/design/tokens.css`, `/design/ronda.css`. Icons from `/design/sources/` (`google-calendar.svg`, `gmail.svg`, `github.svg`, `linear.svg`).

- Three blocks, `<section data-proveedor="google|github|linear" hidden>`. A small inline script shows the one that matches the last segment of `location.pathname`.
- Text of the Google block, exactly: chip «Pantalla de prueba»; title «Permiso de Google simulado»; note «En esta grabación ocupa el lugar de la pantalla de Google. No es Google y la cuenta no existe.»; row «Google Calendar» · «Título, horario y asistentes de tus reuniones»; row «Gmail» · «Asunto y remitente. Nunca el cuerpo»; «Cuenta de prueba: {{CUENTA}}».
- GitHub block: «Permiso de GitHub simulado», row «GitHub» · «Tu actividad pública: commits y pull requests». Linear block: «Permiso de Linear simulado», row «Linear» · «Las tareas asignadas a ti».
- Two links, outside the blocks: `<a class="rd-button" href="{{PERMITIR}}">Permitir</a>` and `<a class="rd-button rd-button--quiet" href="{{CANCELAR}}">Cancelar</a>`. Accessible names exactly «Permitir» and «Cancelar».
- The three placeholders appear exactly once each: `{{CUENTA}}`, `{{PERMITIR}}`, `{{CANCELAR}}`. No other `{{`.
- It does not copy the look of Google, GitHub or Linear. No provider logo larger than a row icon.

**Acceptance B3** (no browser): `cd R && design/lint.sh design/demo/escenario2.html design/demo/permiso.html` passes; `grep -c '{{' design/demo/permiso.html` gives 3; every id of 4.1 is present once; every method of 4.1 is defined; `grep -nE 'paciente|cita|consulta|¡' design/demo/escenario2.html design/demo/permiso.html` finds nothing, and no visible text has an exclamation mark. The lead does the visual checks (integration step 7).

---

## 5. B4 · everything the guion does over HTTP

### 5.1 `R/tools/grabar/preparar2.mjs`

Plain ESM. Imports only `./elenco2.mjs` and Node built-ins. No Playwright. Every function takes the client first.

```js
export function crearCliente({ base, fetchImpl = fetch })
// -> { base,
//      api(ruta, { metodo = 'GET', cuerpo, token } = {}),          // JSON in, JSON out; throws 'METODO ruta respondió N' with the path masked
//      conectarOAuth(ficha, proveedor, id) }                       // start + callback over HTTP, redirect: 'manual'
```

`conectarOAuth`: `GET /api/people/<ficha>/oauth/<proveedor>/start` with headers `sec-fetch-site: same-origin` **and** `origin: <base>` (if the runtime drops the first, the route accepts the second); expect 302; `state` from `new URL(location, base).searchParams`; cookie = first `set-cookie` up to `;`; then `GET /api/oauth/<proveedor>/callback?code=demo-<id>&state=…` with header `cookie`; expect 302 with no `aviso`. Errors name the provider and the persona, never the token.

```js
export async function comprobarServidor(cliente)            // GET /demo/estado; throws if hoy !== today in Santiago or rondaSola !== false. Returns the estado
export async function abrirSala(cliente)                    // POST /api/rooms { name: SALA }; POST /api/rooms/<codigo>/join { name: 'Antonia' } -> { codigo, ficha }
export async function crearYConectar(cliente, persona, { anotar } = {})
//   POST /api/people { name } -> ficha. Then, in this order: salud (one POST per body), oauth (conectarOAuth each), granola
//   (POST /api/people/<ficha>/connections/granola { secret }), checkin, asistente:
//   link   -> POST /api/people/<ficha>/assistants/pairings {}, GET <path>, POST /api/assistants/join { code, kind, label },
//             POST /api/repo/commit (Bearer assistant token) { message, topics: [], files }
//   pegado -> POST /api/people/<ficha>/repo/paste { kind, content }; if comparte: PATCH /api/people/<ficha>/repo/file { path, share: 'siempre' }
//   The person is NOT in the sala after this. Returns ficha.
export async function prepararElenco(cliente, { anotar } = {})   // the nine others, one after another -> Map<id, ficha>
export async function verificar(cliente, fichas, ids)            // compares with persona.espera -> string[] of differences ('catalina · load.level · esperado alta · real media'); [] is OK
export async function entrar(cliente, codigo, ficha)             // POST /api/rooms/<codigo>/join { token: ficha }
export const pasosDeAntonia = {                                  // API versions of her on-camera steps, for --ensayo and for fallbacks
  asistente(cliente, ficha, { alPaso } = {}),                    // alPaso(nombre, detalle): 'lee', 'entra', 'escribe'
  salud(cliente, ficha), google(cliente, ficha), granola(cliente, ficha), checkin(cliente, ficha), permitir(cliente, ficha),
};
export async function dosGuardados(cliente, ficha)               // GET /api/people/<ficha>/events -> { correo: summary of one gmail event, reunion: summary of one google_calendar event }
export async function equipoDe(cliente, ficha)                   // GET /api/people/<ficha>/teams -> teams[0].id
export async function iniciarRonda(cliente, ficha)               // asserts state.round === null, then POST /api/people/<ficha>/teams/<equipo>/agents/rounds
export async function esperarRonda(cliente, codigo, { limiteMs = 300000, cadaMs = 1500, alEvento } = {})
//   polls GET /api/rooms/<codigo>/state; feeds alEvento(evento, nombres) from GET /api/rooms/<codigo>/events?since=<id>; returns { estado, segundos }
export async function leerResultado(cliente, codigo, fichas)     // -> Resultado
export function elegirVariante(resultado, { parcialVale = false } = {})   // pure
export async function aceptarPendientes(cliente, fichas, { excepto = [], alAceptar } = {})   // POST …/agents/proposals/<id>/answer { answer: 'acepta' }
export async function rechazar(cliente, ficha, propuestaId)      // { answer: 'rechaza' }, for the V3 fallback only
export function sinFichas(valor, fichas)                         // deep copy with every ficha replaced by '…'; used on everything that is printed or saved
```

```ts
type Resultado = {
  ronda: { status: string; problem: string | null };
  hilos: number;                                    // threads.length of the room state
  pedidos: { pide: string; tema: string;            // names as in ELENCO
             hilos: { ayuda: string; help: 'si'|'parcial'|'no'|null; mensajes: { de: string; texto: string }[] }[];
             propuesta: null | { id: string; texto: string; estado: string; ayudantes: string[] } }[];
};
type Eleccion = {
  variante: 'V1'|'V2'|'V3'|'retoma'; motivo: string;
  quien: 'catalina'|'felipe'|null;                  // whose phone shows the cause
  pide: 'ignacio'|'javiera'|null;
  ayudantesDeAntonia: 0|1|2;
  propuestaDeIgnacio: string | null;                // proposal id, for the V3 «Ahora no» scene
  puertas: { G0: boolean; G1: boolean; G2: boolean; G2b: boolean; G3: boolean };
};
```

`elegirVariante` implements `guion-final.md` 3.3 with exact comparisons only. No keyword matching on any text.

Message texts of a thread come from each party's own view (`GET /api/people/<ficha>/teams/<equipo>/agents`, field `messages`, non-null only for the two parties).

CLI, when the file is the entry: `node tools/grabar/preparar2.mjs --ensayo [--base URL] [--parcial-vale]`. It runs `comprobarServidor`, `abrirSala`, `prepararElenco`, `verificar` (stops on differences), Antonia's steps by API, the nine `entrar`, `verificar` for Antonia, `iniciarRonda`, `esperarRonda`, `leerResultado`, `elegirVariante`, and prints: differences, calls and seconds from `/demo/estado`, one line per thread, the proposals, the two messages of the chosen thread, and the variant. Exit code 1 on differences or `retoma`. A new sala on every run.

### 5.2 `R/tools/grabar/preparar2.test.mjs`

Run: `cd R && node --test tools/grabar/preparar2.test.mjs`. A hand-written fake `fetchImpl`, no server. Asserts:

- `conectarOAuth` sends both headers, uses `redirect: 'manual'`, forwards the cookie, and throws without the token in the message when the callback carries `aviso`;
- `crearYConectar` calls the routes in the contract order for one link persona and one pasted persona;
- `verificar` reports each kind of difference and returns `[]` on a match;
- `elegirVariante` for eight fixtures: V1; V2; V3 with and without `parcialVale`; G0 fails with a fourth requester; G1 fails with `help: null`; G2 fails with no proposal for Antonia; one helper sets `ayudantesDeAntonia: 1` and keeps the take;
- `sinFichas` leaves no ficha in a nested object or in a string that contains one.

**Acceptance B4**: `node --check tools/grabar/preparar2.mjs`; the test passes; `grep -n "console.log" tools/grabar/preparar2.mjs` shows every printed value going through `sinFichas`.

---

## 6. B5 · recorder

### 6.1 `R/tools/grabar/tiempos2.mjs`

Pure functions, no imports.

```js
export function duraciones(cuadros, tramos, { ultimo = 1.5 } = {})
// cuadros: { instante: number }[]  (seconds, from the screencast)
// tramos:  { desde: number, hasta: number, tipo: 'acelera' | 'tope' | 'omite', valor?: number }[]   frame indexes, [desde, hasta)
//   'acelera': duration / valor      'tope': min(duration, valor)      'omite': 0 (the frame is left out of the list)
// returns number[] (seconds per frame)
export function comienzos(duracionesPorCuadro)          // start second of each frame
export function capitulos(pasos, duracionesPorCuadro)   // [{ numero, texto, segundo }] for the JSON
export function reloj(segundos)                         // 47.3 -> 'Tiempo real 0:47'
```

`R/tools/grabar/tiempos2.test.mjs` (`node --test`): each kind of range, overlapping ranges (the last one listed wins), the last frame, `reloj` at 0, 59 and 75 s.

### 6.2 `R/tools/grabar/grabar2.mjs`

Run (lead only): `node tools/grabar/grabar2.mjs --base http://localhost:8797 --out docs/demo/diez-personas.mp4 --frames <dir outside the repo> --capturas <dir outside the repo>`

| Flag | Default | Meaning |
|---|---|---|
| `--base` | `http://localhost:8797` | Demo server |
| `--out` | `docs/demo/diez-personas.mp4` | Also writes `.png` and `.json` beside it |
| `--frames` | a new folder under the system temp folder | Screencast frames. **Never deleted by the script** |
| `--capturas` | none | If set, one PNG per scene: `e01.png` … |
| `--permiso` | `pantalla` | `api`: Antonia's Google goes through `cliente.conectarOAuth`; the log says «el guion autoriza por Antonia, sin pantalla de permiso» |
| `--sin-globo` | off | Scene 15 stays on the sala screen |
| `--parcial-vale` | off | Allows variant V3 |
| `--toma` | `1` | Written to the JSON |
| `--max-segundos` | `170` | Stops with an error if the film is longer |

Structure:

- Reuse the first recorder's approach by copying it, not by importing it: Playwright from `.agents/skills/stageshow/node_modules/playwright-core`, one headless Chromium, viewport 1920 × 1080, locale `es-CL`, time zone `America/Santiago`, clipboard permissions, CDP screencast, ffmpeg concat with `fps=30,format=yuv420p`.
- The stage is read from `design/demo/escenario2.html` and answered with `pagina.route('<base>/design/demo/escenario2.html', …)`.
- `main()` runs only when the file is the entry. The file must pass `node --check` and must be importable without side effects.
- Order: `comprobarServidor` → `abrirSala` → `prepararElenco` → `verificar` (stop on differences) → open the stage with `escena.abrirSala('/sala/<codigo>')` → start the screencast → scenes 1 to 16 of `guion-final.md` section 4 → stop → durations → ffmpeg → JSON.
- Helpers: `paso`, `anotar`, `apuntar`, `tocar`, `escribir` as in the first recorder, plus:
  - `region(nombre)` = `telefono.getByRole('region', { name: nombre })`. Every phone locator goes through it;
  - `acercar(elemento)`: `elemento.evaluate((nodo) => nodo.scrollIntoView({ behavior: 'smooth', block: 'center' }))`, then 650 ms. Used before every `apuntar` on camera. `scrollIntoViewIfNeeded` is not used;
  - `esperaCortable(promesa)`: marks a `'tope'` range of 1.2 s around a wait;
  - `omitir(desdeCuadro)` / `hasta`: marks an `'omite'` range (only the reload after «Permitir»);
  - `cambiarTelefono(ficha, pestana, rotulo, listo)`: `escena.cambiarTelefono('/conectar/<ficha>#<pestana>', rotulo)`, waits for the locator `listo`, then `escena.encenderTelefono()`;
  - `captura(n)`: a PNG when `--capturas` is set.
- Scene 9: `'acelera'` range with `valor: 6`; a 500 ms timer calls `escena.reloj(reloj(segundos))` until the round ends; then `leerResultado` + `elegirVariante`. On `retoma` the script stops, writes the JSON with `publicable: false` and the reason, and makes no video.
- Scene 15: `await pagina.emulateMedia({ reducedMotion: 'reduce' })` before the tap on the globe link. Hold 6 s.
- Scene 16: `escena.cierre({ titulo, real, actuado })` with the lists of 5.1.
- Every log line that reports an acted step names the actor (rule 3 of `guion-final.md` 4.1). Nothing printed or saved holds a ficha: pass it through `sinFichas`.
- JSON summary: `{ titulo, sala, base, commit, toma, variante, publicable, pasos: [{ numero, texto, segundo }], personas: [{ nombre, asistente, puerta, fuentes }], conversaciones: [{ pide, ayuda, tema, respuesta }], hiloElegido: { pide, ayuda, mensajes }, propuestas: [{ pide, texto, estado, ayudantes }], ronda: { segundosReales, factor: 6, llamadas }, ediciones: { topeEsperaS: 1.2, omitidos: n }, segundos, cuadros }`.

Selectors: the table in `guion-final.md` section 4. Check each one against `R/frontend/src` before use (`SourceRow.tsx`, `KeyForm.tsx`, `CheckinSection.tsx`, `SignalRow.tsx`, `AskRow.tsx`, `RoundSection.tsx`, `ProposalRow.tsx`, `ThreadRow.tsx`, `RoomPage.tsx`, `TabBar.tsx`, `ConnectPage.tsx`).

### 6.3 `R/docs/demo/diez-personas.md` (draft)

Chilean Spanish. Sections: title and one-line summary; «Qué se ve» (a table the lead fills from the JSON); «Qué es real y qué no» (the text of `guion-final.md` 5.2, with its `[ ]` placeholders); «Cómo volver a grabar» (the commands of section 7). No link to the mp4 until the lead has it.

**Acceptance B5**: `node --check tools/grabar/grabar2.mjs && node --check tools/grabar/tiempos2.mjs`; `node --test tools/grabar/tiempos2.test.mjs` passes; `node -e "import('./tools/grabar/grabar2.mjs')"` exits with no output and opens nothing; `grep -n "scrollIntoViewIfNeeded\|rm(" tools/grabar/grabar2.mjs` finds nothing; every caption in the file is 70 characters or fewer.

---

## 7. Integration order for the lead

One heavy process at a time. Do not run an ensayo and a take, or two servers, together. Stop at the first step that fails and use its fallback.

| # | Step | Passes when | Fallback |
|---|---|---|---|
| 1 | `nvm use`. Run the three test files and the two `node --check` lists. `design/lint.sh` on the two pages | All green | Return the file to its builder |
| 2 | `npm run build` (the `frontend/dist` on disk is from 11:55; the last frontend commit is from 12:06) | Build ends | — |
| 3 | **Spike A.** `DATA_DIR=<new> PORT=8797 npx tsx tools/grabar/servidor-demo.mts` | `GET /demo/estado` answers; the warm-up prints its seconds | Add `tools/grabar/package.json` with `{ "type": "module" }` (lead's file) |
| 4 | **Spike B.** `node tools/grabar/preparar2.mjs --ensayo` up to `verificar` (stop it before the round, or let it run: it is also step 6) | No differences | Fix the fixture with B1. Never loosen an expected value |
| 5 | **Probe.** Stop the server. `npx tsx tools/grabar/ensayo-respuesta.mts --veces 6` (12 calls) | Table of `guion-final.md` 3.2 | Decision D1 |
| 6 | Start the server again. `node tools/grabar/preparar2.mjs --ensayo`, twice (new `DATA_DIR` each time) | Variant is not `retoma` both times; requesters are the three; read the chosen thread | Tune data with B1 and repeat. Three failures: talk to Mati |
| 7 | **Stage review** (AGENTS.md rules 3 and 4). Load the Stageshow skill. A still of `escenario2.html` (normal, `?estado=ronda`, `?estado=cierre`) and of `permiso.html` at 390 px beside `design/reference.png`. `film.mjs --gate` and `layout.mjs` on the stage | Same app as the reference; the longest caption fits | Return to B3 |
| 8 | **Spike C.** A short Playwright run: Antonia's phone, «Conectar Google Calendar», the permission page, «Permitir», two rows connected | Works inside the phone frame | `--permiso api` for every take (decision D4) |
| 9 | **Spike D.** Open the globe with 10 people and reduced motion in headless Chromium; one PNG | Ten names, arcs, no «Listo» mark, a normal frame time | `--sin-globo` (decision D3) |
| 10 | **Freeze.** Note `git rev-parse --short HEAD` (read only). Copy the checkout without `.git` and `node_modules` to a folder outside the repo; link `node_modules` (root and `.agents/skills/stageshow/node_modules`). Run the server and the recorder from the copy, with `DEMO_COMMIT` set | The copy serves the app | Film from the checkout if no other session is writing to it |
| 11 | **Take.** New `DATA_DIR`. `node tools/grabar/grabar2.mjs --capturas <dir> --frames <dir> --toma N` | `publicable: true`; every PNG reviewed (fold, tab bar, no personal link, no «Cargando…»); a person read the chosen thread | New take. At most 4 |
| 12 | Fill `diez-personas.md` (takes, seconds, calls, variant). Write `docs/demo/REHEARSAL.md` (takes, gates, what was not checked). Add one line to `docs/demo/README.md` | — | — |
| 13 | Commit and push each file as AGENTS.md rule 1 asks, and send the team mail of rule 2 | Pushed | Say the exact error |

Do not film between 23:30 and 00:30. After midnight: new server, new `DATA_DIR`, assertions again.

---

## 8. Decisions the lead must make

| # | Decision | Default in this plan |
|---|---|---|
| D1 | Is «Puede orientar» (variant V3) a publishable outcome, or only «No puede»? | Decide after the probe. If Catalina says `no` in 4 of 6 or more: only «No puede». Otherwise allow V3 with `--parcial-vale` and tell Mati before filming |
| D2 | Title and file name | «Diez personas, sus fuentes y sus agentes», `diez-personas` |
| D3 | End with the globe or with the sala screen | Globe with reduced motion if spike D passes; else `--sin-globo` |
| D4 | Permission on camera or by API | On camera if spike C passes |
| D5 | Run a real `claude` process as Antonia's assistant | No. The guion plays it and the video says so |
| D6 | Keep the one-retry wrapper and the warm-up call | Yes, both declared in the write-up |
| D7 | Speed of the round | ×6, with the real-time chip |
| D8 | When to film | Tonight before 23:30, with no other session using the Claude CLI |
| D9 | What to do after 4 takes with no publishable variant | Stop and ask Mati. Never change a prompt for the demo |
| D10 | A fourth requester appears in ensayos (gate G0) | Tune the shared texts with B1; do not relax the gate |
| D11 | Which cuts to apply if time runs short | The order of `guion-final.md` 4.3 |
| D12 | Whether the first five globe faces (the team's drawings) are acceptable under invented names | Yes, declared in the write-up; else `--sin-globo` |
