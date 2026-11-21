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

## Personas

| Ruta | Recibe | Responde |
|---|---|---|
| `POST /api/people` | `{ "name": "Ana" }`, hasta 80 caracteres | 201 `{ token, name }` |
| `GET /api/people/<token>` | — | La página de la persona: `name`, `healthIngestPath`, `publicBaseUrl`, `sources` y `events` (los 12 últimos recibidos) |
| `GET /api/people/<token>/events` | — | `{ name, events }`: los 50 eventos más recientes, con su dato crudo |

Cada elemento de `sources`:

| Campo | Contenido |
|---|---|
| `id`, `label`, `how` | Identificador (`apple_health`, `granola`, `github`, `linear`, `google_calendar`, `gmail`), nombre y forma de conectar en palabras |
| `connect` | `push`, `key`, `oauth` o `soon` |
| `provider` | `google`, `github` o `linear` si es OAuth; si no, `null` |
| `configured` | `false` cuando es OAuth y faltan sus credenciales en el servidor |
| `sync` | `{ last, total }`: último dato recibido y total de eventos; `null` sin eventos |
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
| `POST /api/ingest/health/<token>` | El envío del Atajo de iOS, hasta 1 MB | 201 `{ ok, id, summary }`. Formato en [INTEGRATIONS.md](INTEGRATIONS.md) |

Sobre OAuth:

- `start` solo responde a una navegación que viene de la propia página de Ronda. Desde otro sitio responde 403 «Abre la conexión desde tu página de Ronda.»
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

En `GET …/teams`, cada equipo trae `id`, `name`, `joinCode`, `members` (solo nombres) y `requests`: `[{ id, name, approvals, needed, approvedByMe }]`. `pending` son los equipos donde la persona espera aprobación.

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
| `GET /api/people/<token>/teams/<equipo>/board` | Opcional `?status=abierto` o `cerrado` | `{ posts }` |
| `POST /api/people/<token>/board/<publicación>/replies` | `{ "text": "…", "tellable": true }` | 201 con la respuesta |
| `POST /api/people/<token>/board/<publicación>/votes` | `{ "value": "a_favor" }` o `"en_contra"` | `{ aFavor, enContra, total, myVote }` |
| `POST /api/people/<token>/board/<publicación>/close` | — | La publicación cerrada. Solo la cierra quien la publicó |

`kind` es `pregunta`, `pedido` o `propuesta`. El texto tiene hasta 500 caracteres. Solo se vota en una propuesta, y en una publicación cerrada no se responde ni se vota (409).

Una publicación trae `id`, `teamId`, `authorName`, `kind`, `text`, `createdAt`, `status`, `mine`, `replies`, `tally` y `myVote`. `tally` y `myVote` son `null` salvo en una propuesta.

Una respuesta con `tellable` en falso, que es el valor por defecto, solo la leen quien publicó y quien respondió. El resto del equipo la recibe con `text: null`.

Hoy el tablero lo usan las personas desde la pestaña Equipo. Los agentes todavía no publican ni leen en él.

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

## Servidor de contexto (datos de prueba)

`GET /api/context/<token>`, `POST /api/context/<token>/push`, `POST` y `DELETE /api/context/<token>/sources/<fuente>` y `POST /api/context/<token>/simulate`. Están descritas en [ARCHITECTURE.md](ARCHITECTURE.md#servidor-de-contexto-datos-de-prueba). Usan tablas propias y no tocan los eventos reales ni las señales.

## Salud del servicio

`GET /api/health` responde `{ "ok": true }`. Es lo que revisa Render.

## Dónde se guarda

Una sola base SQLite, `ronda.db`, en la carpeta `DATA_DIR`. Cada pieza crea sus tablas al arrancar; no hay migraciones.

| Tablas | Pieza | Archivo |
|---|---|---|
| `people`, `events`, `connections` | Personas, memoria privada y credenciales cifradas | `db.ts` |
| `policies` | Permiso por señal y participación en el pulso | `policy/store.ts` |
| `teams`, `team_members`, `team_join_requests`, `team_join_approvals` | Equipos y solicitudes de ingreso | `teams/store.ts` |
| `board_posts`, `board_replies`, `board_votes` | Tablero | `board/store.ts` |
| `agent_rounds`, `agent_threads`, `agent_messages` | Rondas y conversaciones entre agentes | `agents/store.ts` |
| `agent_proposals`, `agent_proposal_parties`, `agent_topic_decisions` | Propuestas, respuestas de cada parte y temas permitidos o negados | `agents/store.ts` |
| `hub_connections`, `hub_items` | Servidor de contexto, con datos de prueba | `hub/store.ts` |

El check-in no tiene tabla propia: es un evento con fuente y tipo `checkin`.
