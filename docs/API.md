# API

Todas las rutas del backend. Viven bajo `/api` y el código está en `backend/src/routes/`, un archivo por grupo. Escrito desde el código el 21-nov-2026 (commit `9d023b3`); si una ruta cambia, se actualiza aquí en el mismo commit.

En producción: `https://ronda-n8if.onrender.com/api`. En local: `http://localhost:8787/api`.

## Reglas comunes

- **Identidad.** El `<token>` de la persona va en la ruta. No hay cuentas ni cabeceras de autenticación. Con un token que no existe, toda ruta responde 404 `{ "error": "Link no válido." }`.
- **Errores.** Siempre `{ "error": "<frase corta en español>" }`. La frase se le puede mostrar a la persona.
- **Cuerpo.** JSON. Máximo 10.000 bytes; si se pasa, responde 413. La única excepción es `/api/ingest/…`, que acepta hasta 1 MB.
- **Equipo.** Toda ruta con `<equipo>` verifica que la persona sea integrante. Si no, responde 403 `{ "error": "No perteneces a ese equipo." }`.
- **Fechas.** ISO 8601 en UTC. Para decidir qué es «hoy», las señales usan la hora de Santiago.
- **Sin límite de frecuencia.** Cualquiera puede crear personas, equipos y publicaciones. Está anotado en [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## Ingreso con Google

| Ruta | Recibe | Responde |
|---|---|---|
| `GET /api/login` | — | `{ google }`: si el servidor puede ofrecer el ingreso |
| `GET /api/login/google/start` | — | 302 a Google. Al volver, lleva a la página de la persona de ese correo; si no existe, la crea con el nombre de la cuenta |
| `GET /api/people/<token>/login/google/start` | — | 302 a Google. Al volver, asocia ese correo a esta página. Si el correo ya abre otra página que tiene datos, vuelve con un aviso y no cambia nada; si esa otra página está vacía, el correo pasa a esta |
| `GET /api/session` | — | `{ person }`: `{ token, name }` de la sesión abierta en ese navegador, o `null` |
| `POST /api/session/logout` | — | `{ ok }`. Cierra la sesión de ese navegador |

El retorno usa la misma dirección que conectar Google (`/api/oauth/google/callback`) y pide solo el correo y el nombre. La página de la persona trae `login: { email, name, available }`.

Al entrar, el servidor elige la página en este orden: la que ese correo ya abre, si tiene datos; si no, una página que ya tenga una integración con ese mismo correo (Google Calendar, Gmail, Granola o Linear); si no, la página vacía que ese correo ya abría; y solo si no hay ninguna, crea una nueva. Así una persona que conectó sus fuentes antes de que existiera el ingreso vuelve a su página y no a una vacía.

Entrar deja una cookie de sesión por 60 días (`montu_sesion`, cifrada y fuera del alcance de la página). Con la sesión abierta, la portada lleva directo a la página de la persona.

## Personas

| Ruta | Recibe | Responde |
|---|---|---|
| `POST /api/people` | `{ "name": "Ana" }`, hasta 80 caracteres | 201 `{ token, name }` |
| `GET /api/people/<token>` | — | La página de la persona: `name`, `healthIngestPath`, `publicBaseUrl`, `healthShortcut` (`{ url, name }` del Atajo compartido, o `null` si el servidor no tiene su link), `sources` y `events` (los 12 últimos recibidos) |
| `GET /api/people/<token>/events` | — | `{ name, events }`: los 50 eventos más recientes, con su dato crudo |
| `GET /api/people/<token>/onboarding` | — | `{ steps, pending }`: los primeros pasos en orden (`equipo`, `agente`, `checkin`, `whatsapp` solo si el servidor lo tiene configurado, y `salud`), cada uno con `done` según lo que la persona ya hizo |

Cada elemento de `sources`:

| Campo | Contenido |
|---|---|
| `id`, `label`, `how` | Identificador (`apple_health`, `granola`, `github`, `linear`, `google_calendar`, `gmail`), nombre y forma de conectar en palabras |
| `connect` | `push`, `key`, `oauth` o `soon` |
| `provider` | `google`, `github` o `linear` si es OAuth; si no, `null` |
| `configured` | `false` cuando es OAuth y faltan sus credenciales en el servidor |
| `sync` | `{ last, total }`: último dato recibido y total de eventos; `null` sin eventos |
| `delivery` | Solo en Apple Health: `{ at, ok, message }` del último envío, haya traído datos nuevos o no; `null` si nunca hubo uno |
| `connection` | `{ account, lastSyncedAt, lastError }` o `null`. Nunca trae la credencial |

`GET …/events` entrega la memoria privada completa. Es solo para la página de su dueño: ningún agente ni pantalla de equipo la usa.

## Fuentes

| Ruta | Recibe | Responde |
|---|---|---|
| `POST /api/people/<token>/connections/<fuente>` | `{ "secret": "<llave>" }`. Solo fuentes de llave (hoy, Granola) | 201 `{ ok, account, imported }`. Verifica la llave, la guarda cifrada y sincroniza |
| `POST /api/people/<token>/connections/<fuente>/sync` | — | `{ ok, imported }`. Trae los últimos 14 días |
| `DELETE /api/people/<token>/connections/<fuente>` | — | `{ ok }`. Borra la conexión y todos sus eventos |
| `GET /api/people/<token>/oauth/<proveedor>/start` | Navegación desde la página de la persona | Redirige al consentimiento de `google`, `github` o `linear` |
| `GET /api/oauth/<proveedor>/callback` | El retorno del proveedor | Guarda los tokens cifrados, sincroniza y redirige a `/conectar/<token>` |
| `POST /api/ingest/health/<token>` | El envío del Atajo de iOS, hasta 1 MB. Una noche suelta o varios días con varias métricas | 201 `{ ok, id, summary }`. Con varios días agrega `days`, `from`, `to`, `ignored` y `message`, guarda un registro por día y reenviar un día lo reemplaza. Si no se pudo leer ningún dato, 400 `{ error, message, ignored, example }`. Toda respuesta de esta ruta trae `message`, la frase que muestra el Atajo. Formato en [INTEGRATIONS.md](INTEGRATIONS.md#formato-del-envío) |

Sobre OAuth:

- `start` solo responde a una navegación que viene de la propia página de Montu. Desde otro sitio responde 403 «Abre la conexión desde tu página de Montu.»
- Sin credenciales del proveedor en el servidor, `start` responde 500 con el nombre de las dos variables que faltan.
- El permiso queda amarrado al navegador que lo inició, dura 10 minutos y se usa una sola vez. Si no calza, `callback` responde 400.
- Si el proveedor falla después del consentimiento, `callback` redirige a `/conectar/<token>?aviso=<mensaje>` y la página muestra el mensaje.
- Un mismo consentimiento de Google conecta Google Calendar y Gmail.

## Señales y check-in

| Ruta | Recibe | Responde |
|---|---|---|
| `GET /api/people/<token>/signals` | — | `{ name, signals }` |
| `POST /api/people/<token>/checkins` | `{ "mood": "bien", "blocker": "…", "note": "…" }` | 201 `{ ok, signals }` |
| `GET /api/people/<token>/checkins` | — | Los 14 últimos: `[{ at, mood, blocker, note }]` |

`mood` es `bien`, `normal`, `cansada` o `mal`. `blocker` y `note` son opcionales, de hasta 280 caracteres.

Forma de `signals`:

| Campo | Contenido |
|---|---|
| `energy`, `load` | `{ level, statement, basis, visibility }`. `level` es `baja`, `media`, `alta` o `sin_datos`. `statement` es la frase que puede salir («Energía baja esta semana»). `basis` dice de qué fuentes salió |
| `blockers` | `[{ topic, since, statement, source, visibility }]`. `source` es `checkin` o `linear` |
| `blockerBasis` | De qué fuentes hay datos para saber si hay bloqueos |
| `expertise` | Lista de temas: repos de GitHub y palabras que se repiten en títulos de tareas y pull requests |
| `visibility` | El permiso de cada señal, ya con lo que eligió la persona |
| `asOf` | Cuándo se calculó |

De dónde sale cada señal está en [DATA_SOURCES.md](DATA_SOURCES.md).

## Permisos

| Ruta | Recibe | Responde |
|---|---|---|
| `GET /api/people/<token>/policy` | — | `{ energy, load, blockers, expertise, includeInPulse }` |
| `PUT /api/people/<token>/policy` | Cualquier subconjunto de esos campos | La política completa |

Cada señal vale `siempre`, `preguntar` o `nunca`. `includeInPulse` es verdadero o falso. Por defecto: `energy` y `load` en `preguntar`, `blockers` y `expertise` en `siempre`, `includeInPulse` en verdadero. Un bloqueo dicho en un check-in parte en `preguntar` mientras la persona no elija otra cosa para `blockers`.

## Equipos

| Ruta | Recibe | Responde |
|---|---|---|
| `POST /api/people/<token>/teams` | `{ "name": "Equipo" }`, hasta 80 caracteres | 201 `{ id, name, joinCode }`. Quien lo crea queda dentro |
| `POST /api/people/<token>/teams/join` | `{ "joinCode": "…" }` | 202 `{ id, name, status: "pendiente" }`. Deja una solicitud. Si ya era integrante, 201 con `status: "miembro"` |
| `POST /api/people/<token>/teams/<equipo>/requests/<solicitud>/approve` | — | `{ ok, status }`. `status` pasa a `miembro` cuando aprobaron todos los integrantes |
| `GET /api/people/<token>/teams` | — | `{ teams, pending }` |
| `DELETE /api/people/<token>/teams/<equipo>` | — | `{ ok }`. Sale del equipo, o retira su solicitud si todavía no entraba |
| `GET /api/people/<token>/teams/<equipo>/pulse` | — | `{ team, members, pulse }` |
| `POST /api/people/<token>/teams/<equipo>/invites` | — | 201 `{ code, path, expiresAt }`. Solo quien administra. El link vale 7 días y sirve para varias personas |
| `DELETE /api/people/<token>/teams/<equipo>/invites/<código>` | — | `{ ok }`. Anula el link. Solo quien administra |
| `DELETE /api/people/<token>/teams/<equipo>/members/<id>` | — | `{ ok }`. Saca a esa persona del equipo. Solo quien administra, y nunca a sí mismo (400) |
| `POST /api/people/<token>/teams/<equipo>/members/<id>/admin` | — | `{ ok }`. Nombra a otra persona como administradora. Solo quien administra |
| `GET /api/invites/<código>` | — | `{ team, people, expiresAt }`, o 404 si no existe o venció |
| `POST /api/invites/<código>/join` | `{ "name": "Rob" }` o `{ "token": "…" }` | 201 `{ token, name, team }`. Entra directo, sin aprobación; 200 si ya era integrante |

En `GET …/teams`, cada equipo trae `id`, `name`, `joinCode`, `members` (solo nombres) y `requests`: `[{ id, name, approvals, needed, approvedByMe }]`. `pending` son los equipos donde la persona espera aprobación.

También trae `admin` (si quien mira administra el equipo), `people` e `invites`. Cada entrada de `people` es `{ id, name, admin, me, pending }`: `id` es un identificador público, nunca el link de la persona, y `pending` es la lista de primeros pasos que le faltan (`agente`, `checkin`, `whatsapp`, `salud`). `pending` e `invites` solo llegan a quien administra; el resto recibe `pending: null` e `invites: []`.

Administra el equipo quien lo creó. Si nadie fue nombrado, administra la persona que lleva más tiempo en el equipo, así que un equipo nunca queda sin administrador.

Forma de `pulse`:

```json
{
  "energy": { "available": true, "level": "media", "contributors": 4 },
  "load": { "available": false, "reason": "grupo_pequeno", "needed": 3 },
  "blockersOpen": { "available": true, "total": 2, "contributors": 3 }
}
```

El pulso se calcula sobre el resto del equipo, sin contar a quien lo mira. Cada señal necesita al menos 3 personas aportando; con menos, responde `grupo_pequeno`. Nunca trae un nombre ni un valor individual.

## Tablero

| Ruta | Recibe | Responde |
|---|---|---|
| `POST /api/people/<token>/teams/<equipo>/board` | `{ "kind": "pedido", "text": "…" }` | 201 con la publicación |
| `GET /api/people/<token>/teams/<equipo>/board` | Opcional `?status=abierto` o `cerrado` | `{ configured, posts }`. `configured` dice si el servidor tiene modelo |
| `POST /api/people/<token>/board/<publicación>/replies` | `{ "text": "…", "tellable": true }` | 201 con la respuesta |
| `POST /api/people/<token>/board/<publicación>/votes` | `{ "value": "a_favor" }` o `"en_contra"` | `{ aFavor, enContra, total, myVote }` |
| `POST /api/people/<token>/board/<publicación>/close` | — | La publicación cerrada. Solo la cierra quien la publicó |
| `POST /api/people/<token>/board/<publicación>/ask` | — | 202 con la publicación. Les pide a los agentes que respondan la pregunta de nuevo. Solo quien preguntó |

`kind` es `pregunta`, `pedido` o `propuesta`. El texto tiene hasta 500 caracteres. Solo se vota en una propuesta, y en una publicación cerrada no se responde ni se vota (409).

Una publicación trae `id`, `teamId`, `authorName`, `kind`, `text`, `createdAt`, `status`, `mine`, `replies`, `answer`, `tally` y `myVote`. `tally` y `myVote` son `null` salvo en una propuesta.

Una respuesta con `tellable` en falso, que es el valor por defecto, solo la leen quien publicó y quien respondió. El resto del equipo la recibe con `text: null`.

### Preguntas que responden los agentes

Al publicar una `pregunta`, si el servidor tiene modelo, el agente de cada integrante la responde con lo que su persona comparte, y el agente de quien preguntó arma una sola respuesta. Corre de fondo: la publicación vuelve de inmediato con `answer.status` en `en_curso`.

`answer` es `null` si los agentes nunca recibieron la pregunta. Si no, trae:

| Campo | Qué es |
|---|---|
| `status` | `en_curso`, `lista` o `fallida` |
| `text` | La respuesta armada. `null` mientras corre, si falló o si ningún agente tenía algo que aportar |
| `sources` | Los nombres de las personas cuyos agentes aportaron |
| `asked` | A cuántos agentes se les preguntó |
| `problem` | Por qué falló, o `null` |

La respuesta de un agente es una respuesta más de la publicación, con `byAgent` en verdadero y `tellable` en verdadero. Volver a preguntar borra las respuestas anteriores de los agentes y deja las de las personas.

`ask` responde 400 si la publicación no es una pregunta, 403 si no la publicaste tú, 409 si está cerrada o si los agentes todavía la están respondiendo, 429 si el equipo ya tiene 3 preguntas en curso o si pasaste de 12 pedidos por minuto, y 503 si el servidor no tiene modelo. Una respuesta que pasa de 10 minutos se da por fallida.

Las personas siguen usando el tablero desde la pestaña Equipo. Los agentes responden preguntas; todavía no publican pedidos ni propuestas.

## WhatsApp

| Ruta | Recibe | Responde |
|---|---|---|
| `GET /api/people/<token>/whatsapp` | — | `{ configured, linked, phoneEnding }`. `phoneEnding` son los últimos 4 dígitos |
| `POST /api/people/<token>/whatsapp/link` | — | 201 con `{ code, url, expiresAt }`. `url` abre WhatsApp con el código escrito; es `null` si no se conoce el número. 503 si falta Kapso |
| `DELETE /api/people/<token>/whatsapp` | — | El estado, ya sin teléfono |
| `POST /api/whatsapp/webhook` | El evento de Kapso, firmado | `{ ok: true }` de inmediato; el mensaje se procesa de fondo. 401 si la firma no calza, 404 si falta Kapso |

Qué hace el agente con cada mensaje está en [INTEGRATIONS.md](INTEGRATIONS.md#whatsapp).

## Hablarle a tu agente desde otro agente

El agente que una persona conectó (Claude Code, Codex) puede hablarle a su agente de Montu igual que ella por WhatsApp. Todas piden `Authorization: Bearer <token del asistente>`; sin un token vigente responden 401.

| Ruta | Recibe | Responde |
|---|---|---|
| `POST /api/agent/say` | `{ "text": "…" }`, hasta 2.000 caracteres | `{ replies, pending }`. Un check-in queda en la memoria privada. Una pregunta al equipo espera hasta un minuto y devuelve la respuesta armada |
| `GET /api/agent/inbox` | — | `{ pending, recent }`: lo que el agente espera de la persona y sus últimos 10 mensajes |
| `POST /api/agent/answer` | `{ "option": "<id>" }` | `{ replies, pending }`. Elige una opción de un pendiente |
| `POST /api/mcp` | Un mensaje JSON-RPC de MCP | Las mismas tres acciones como herramientas: `ronda_decir`, `ronda_pendientes`, `ronda_responder` |

Un mensaje es `{ id, text, at, options }`. `options` trae `[{ id, label }]` cuando el mensaje espera una decisión (permitir o no contar un bloqueo, aceptar o no una propuesta).

Lo que el agente responde a algo dicho por esta puerta no se manda a WhatsApp. Lo que llega después sin que nadie lo pida (una propuesta, un acuerdo) sí llega a todas las puertas.

## Agentes

| Ruta | Recibe | Responde |
|---|---|---|
| `GET /api/people/<token>/teams/<equipo>/agents` | — | `{ configured, round, asks, threads, proposals }` |
| `POST /api/people/<token>/teams/<equipo>/agents/rounds` | — | 202 `{ id, status, startedAt }`. La ronda corre de fondo |
| `POST /api/people/<token>/agents/asks` | `{ "topic": "…", "allow": true }` | `{ topic, allow }` |
| `POST /api/people/<token>/agents/proposals/<propuesta>/answer` | `{ "answer": "acepta" }` o `"rechaza"` | La propuesta actualizada |

`POST …/rounds` responde 503 si faltan las credenciales del modelo y 409 si ya hay una ronda en curso en ese equipo.

Forma de `GET …/agents`:

| Campo | Contenido |
|---|---|
| `configured` | `false` si el servidor no tiene credenciales del modelo |
| `round` | La última ronda: `{ id, status, startedAt, finishedAt, problem }`, o `null`. `status` es `en_curso`, `lista` o `fallida` |
| `asks` | `[{ topic, statement }]`: los bloqueos que el agente de quien mira todavía no puede contar. Se liberan con `POST …/asks` |
| `threads` | Las conversaciones de la última ronda: `[{ id, topic, requesterName, helperName, help, mine, messages }]` |
| `proposals` | `[{ id, topic, text, createdAt, status, parties, myAnswer }]`. `status` es `por_aprobar`, `acordada` o `descartada` |

En cada conversación, `help` es `si`, `parcial`, `no` o `null` si no hubo respuesta. `messages` trae `[{ fromName, text, createdAt }]` solo para sus dos dueños; el resto del equipo recibe `messages: null`.

En cada propuesta, `parties` es `[{ name, role, answer, me }]`, con `role` en `pide` o `ayuda` y `answer` en `pendiente`, `acepta` o `rechaza`. Una propuesta `por_aprobar` o `descartada` la ven solo sus partes; una `acordada` la ve todo el equipo.

**Para dibujar el grafo:** cada elemento de `threads` es una flecha de `requesterName` a `helperName`, que es el sentido que fija [AGENT_MODEL.md](AGENT_MODEL.md): de quien necesita ayuda a quien puede darla. `help` dice si esa persona puede. Cómo corre una ronda está en [ARCHITECTURE.md](ARCHITECTURE.md#agentes).

## Agentes conversando (mesa pública)

Una sola conversación para todas las personas de Montu, sin inscribirse. Entran todas, menos las personas simuladas y quien eligió salir. En la pantalla se llama «Que conversen»; en el código y en las rutas sigue siendo `mesa` y la vuelta se llama `ronda`.

| Ruta | Recibe | Responde |
|---|---|---|
| `GET /api/people/<token>/mesa` | — | El estado para quien mira |
| `POST /api/people/<token>/mesa/rounds` | — | 202 `{ id, status, startedAt }`. Conversan de fondo |
| `PUT /api/people/<token>/mesa/interval` | `{ "seconds": 60 }` o `{ "seconds": null }` | `{ intervalSeconds }` |
| `PUT /api/people/<token>/mesa/membership` | `{ "member": false }` | `{ member }` |

`GET /api/people/<token>/mesa/live?since=<id>` es lo que lee el globo en vivo. Sin `since` entrega la ronda más reciente desde su inicio; con `since`, solo lo nuevo. Responde `{ me, now, people: [{ id, name }], round, events, streams, lastEventId }`.

- `events` son los pasos de la ronda, en orden: `ronda_empieza`, `pedido_busca`, `paso` (`tool`, `by`, `state` en `inicio` o `fin`), `hilo_abre`, `hilo_responde` (`help`), `propuesta_nace`, `pedido_cierra` (`outcome` en `propuesta`, `nadie`, `sin_ayuda` o `falla`) y `ronda_termina` (`calls`, `tokens`). Cada uno trae `from` (quien pide), `topic` y `text`.
- `streams` son los mensajes que el modelo está escribiendo en ese momento: `{ kind: ask | reply, from, to, topic, chars, text }`.
- `text` viene para todos los que miran (decisión de Mati, 21-nov-2026). `people` son todas las personas de la mesa.

`POST …/rounds` y `PUT …/interval` responden 403 a quien no opera la mesa. Opera quien entró con un correo de `MESA_OPERATORS`; si el servidor no tiene el ingreso con Google configurado, cualquiera. `POST …/rounds` responde 503 sin credenciales del modelo y 409 con una ronda en curso. `seconds` va de 10 a 86.400; `null` deja la mesa en manual.

Forma de `GET …/mesa`:

| Campo | Contenido |
|---|---|
| `configured`, `operator`, `member`, `publishing` | Si hay modelo, si quien mira opera, si su agente está en la mesa y si su agente tiene algo de sus fuentes |
| `intervalSeconds` | Cada cuántos segundos puede repetirse la ronda, o `null` si es manual |
| `round` | La última ronda, igual que en `GET …/agents` |
| `estimate` | Lo que gastaría una ronda ahora: `{ people, needs, digests, calls: { min, likely, max }, tokens: { input, output, total, max }, measured }`. `measured` es `true` cuando ya se calibró con rondas medidas |
| `usage` | `{ lastRound: { calls, tokens, measured } o null, lastDayTokens, dailyCap }` |
| `asks`, `threads`, `proposals` | Como en `GET …/agents`, para la mesa. En `threads`, `messages` viene para todos |

## Panel del equipo (`/admin`)

La pantalla `/admin` (`frontend/src/AdminPage.tsx`) toma la sesión de Google de quien entra; `/admin/<token>` abre el panel de esa persona. Solo entra quien opera la mesa (un correo de `MESA_OPERATORS`; sin ingreso con Google configurado, cualquiera). En una pantalla:

- **El globo abre en: En vivo / Demo.** Fija con qué abre el globo de la pestaña Equipo para todas las personas. Cada persona puede cambiarlo en su pantalla; no se guarda.
- **Que conversen ahora** y **Que vuelvan a conversar solos.** Usan `POST …/mesa/rounds` y `PUT …/mesa/interval` de arriba.
- **Historial.** Las últimas 40 rondas de la mesa: estado, quién la inició, conversaciones, tokens y llamadas. Al abrir una se ven todas sus conversaciones con el texto completo y las propuestas que dejó. Quien opera ve el texto de todas las personas, no solo el suyo.

| Ruta | Recibe | Responde |
|---|---|---|
| `GET /api/mesa/globe` | — | `{ mode: "mesa" \| "demo" }`. Pública; la lee el globo al abrir. Sin valor guardado, `mesa` |
| `GET /api/admin/<token>` | — | `{ globeMode, configured, intervalSeconds, usage: { lastDayTokens, dailyCap }, people: [{ name, member, publishing }], rounds }` |
| `PUT /api/admin/<token>/globe` | `{ "mode": "demo" }` | `{ globeMode }`. 400 si no es `mesa` ni `demo` |
| `GET /api/admin/<token>/rounds/<id>` | — | `{ round, threads: [{ id, topic, requesterName, helperName, help, messages: [{ fromName, text, createdAt }] }], proposals: [{ id, topic, text }] }`. 404 si la ronda no está entre las últimas 40 |

Cada elemento de `rounds` es `{ id, status, startedAt, finishedAt, problem, startedBy, threads, tokens, calls }`; `startedBy` es el nombre de quien la inició o `null` si la inició el intervalo. Las rutas `/api/admin/…` responden 404 a un token que no existe y 403 a quien no opera. El modo del globo se guarda en `mesa_settings` (clave `globe_mode`). Pruebas: `backend/test/admin.test.ts`.

## Servidor de contexto (datos de prueba)

`GET /api/context/<token>`, `POST /api/context/<token>/push`, `POST` y `DELETE /api/context/<token>/sources/<fuente>` y `POST /api/context/<token>/simulate`. Están descritas en [ARCHITECTURE.md](ARCHITECTURE.md#servidor-de-contexto-datos-de-prueba). Usan tablas propias y no tocan los eventos reales ni las señales.

## Salud del servicio

`GET /api/health` responde `{ "ok": true }`. Es lo que revisa Render.

## Dónde se guarda

Una sola base: Postgres en producción (`DATABASE_URL`) y SQLite en local (`ronda.db`, en la carpeta `DATA_DIR`). Cada pieza crea sus tablas al arrancar; no hay migraciones. Cómo conviven las dos está en [DEPLOY.md](DEPLOY.md#base-de-datos).

| Tablas | Pieza | Archivo |
|---|---|---|
| `people`, `events`, `connections` | Personas, memoria privada y credenciales cifradas | `db.ts` |
| `policies` | Permiso por señal y participación en el pulso | `policy/store.ts` |
| `teams`, `team_members`, `team_join_requests`, `team_join_approvals` | Equipos y solicitudes de ingreso | `teams/store.ts` |
| `board_posts`, `board_replies`, `board_votes`, `board_answers` | Tablero y la respuesta armada de cada pregunta | `board/store.ts` |
| `agent_rounds`, `agent_threads`, `agent_messages` | Rondas y conversaciones entre agentes | `agents/store.ts` |
| `agent_proposals`, `agent_proposal_parties`, `agent_topic_decisions` | Propuestas, respuestas de cada parte y temas permitidos o negados | `agents/store.ts` |
| `hub_connections`, `hub_items` | Servidor de contexto, con datos de prueba | `hub/store.ts` |

El check-in no tiene tabla propia: es un evento con fuente y tipo `checkin`.
