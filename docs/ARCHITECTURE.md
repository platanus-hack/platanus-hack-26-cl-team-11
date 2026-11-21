# Arquitectura

Cómo está armado el código y cómo se agrega una pieza nueva. Cómo levantarlo está en el [README](../README.md). Todas las rutas, con lo que reciben y responden, están en [API.md](API.md).

## Mapa

```
backend/
  src/
    index.ts            arranca el servidor
    app.ts              arma la API y monta las rutas
    context.ts          lo que comparte todo el backend: base, bóveda, fetch y configuración
    db.ts               guardado: personas, eventos y conexiones
    crypto.ts           bóveda que cifra credenciales
    types.ts            contratos: evento, conexión, conector, proveedor OAuth
    sync.ts             trae datos de una fuente conectada
    scheduler.ts        vuelve a sincronizar todas las conexiones cada 15 minutos
    signals.ts          deriva energía, carga, bloqueos y experiencia desde los eventos
    seed.ts             personas de demo con datos sintéticos
    pulse.ts            pulso agregado del equipo: solo totales de grupo
    teams/              equipos y membresías
    board/              tablero compartido: preguntas, pedidos, propuestas y votos
    policy/             qué permite compartir cada persona
    agents/             agentes personales: ficha, conversación 1:1, propuestas y rutina diaria
    hub/                servidor de contexto: catálogo de fuentes, guardado y mapa (datos de prueba)
    rooms/              salas: un equipo abierto con código corto y su registro de lo que pasa
    assistants/         asistentes conectados: código de un uso, token propio y el documento de ingreso
    repo/               repo de cada persona: archivos con permiso e historial
    sim/                simulación: personas inventadas con su repo, para ver una sala llena
    connectors/         un archivo por fuente
      registry.ts       la lista de fuentes
    oauth/              un archivo por proveedor OAuth
    routes/             un archivo por grupo de rutas
  test/                 un archivo de pruebas por pieza
frontend/
  src/                  pantallas en React; estilos solo con design/
design/                 tokens y primitivas de interfaz
docs/                   definiciones del producto
```

## La idea central

Todo lo que entra se convierte en un **evento** con el mismo formato y queda en la memoria privada de la persona. Los agentes leen eventos; nunca hablan con Granola, GitHub o Apple Health.

```
fuente  →  conector  →  evento  →  memoria privada  →  señales  →  agente
```

Un evento tiene fuente, tipo, cuándo ocurrió, un resumen de una línea y el dato crudo. Si trae `externalId`, la misma cosa no entra dos veces.

## Tres formas de conectar una fuente

| Forma | Cómo funciona | Ejemplo |
|---|---|---|
| `push` | La fuente nos manda los datos a una dirección personal | Apple Health |
| `key` | La persona pega una llave y nosotros traemos los datos | Granola |
| `oauth` | La persona autoriza con su cuenta y nosotros traemos los datos | Google, GitHub, Linear |

Una fuente que todavía no existe se lista como `soon` para que aparezca en la página como «Próximamente».

## Agregar una fuente

1. Crea `backend/src/connectors/<fuente>.ts` y exporta un conector de una de las tres formas. El contrato está en `backend/src/types.ts`.
2. Agrégalo a la lista de `backend/src/connectors/registry.ts`.
3. Crea `backend/test/<fuente>.test.ts` con un `fetch` falso. Las pruebas nunca salen a la red.

No hay que tocar rutas, base ni frontend: la página de conexión se arma sola desde el registro.

Reglas para todo conector:

- **Guardar lo mínimo.** De un correo, asunto y remitente; nunca el cuerpo. De una reunión, el resumen; nunca la transcripción.
- **No inventar.** Si la fuente no trae un dato, el evento no lo lleva.
- **Errores en español y cortos**, con `ConnectorError`. Se le muestran a la persona.

## Credenciales

Las llaves y los tokens se guardan cifrados (AES-256-GCM). La llave de cifrado sale de `SECRET_KEY`; si no está definida, se genera una en la carpeta de datos, que git ignora. La API nunca devuelve una credencial: solo el nombre de la cuenta conectada.

Desconectar una fuente borra la conexión y todos sus eventos.

## Identidad

Cada persona tiene un token largo y aleatorio. Su link `/conectar/<token>` es su identidad: no hay cuentas ni contraseñas. Quien tenga el link ve sus registros, así que se entrega solo a su dueño.

## Pantallas

El frontend no usa un enrutador: `frontend/src/App.tsx` mira la dirección y elige una de tres pantallas.

| Dirección | Pantalla | Archivo |
|---|---|---|
| `/` | Portada: crea una persona y muestra su link | `HomePage.tsx` |
| `/conectar/<token>` | Panel personal, con cuatro pestañas | `ConnectPage.tsx` |
| `/contexto/<token>` | Mapa de contexto, con datos de prueba | `ContextPage.tsx` |

El panel personal es una columna de filas con una barra de pestañas abajo. La pestaña activa va en la dirección (`#fuentes`, `#tu`, `#equipo`, `#ajustes`), así que se puede enlazar directo a una. El panel vuelve a leer sus datos cada 5 segundos.

| Pestaña | Qué tiene | Archivos |
|---|---|---|
| Fuentes | Una fila por fuente: conectar, sincronizar, desconectar, y la dirección personal para el Atajo de Apple Health | `SourcesTab.tsx`, `SourceRow.tsx`, `SourceDetail.tsx` |
| Tú | El check-in del día y las señales que salen de tus datos, cada una con su permiso | `YouTab.tsx`, `CheckinSection.tsx`, `SignalsSection.tsx` |
| Equipo | Crear un equipo o pedir entrar con un código, aprobar solicitudes, la ronda de agentes, el pulso y el tablero | `TeamSection.tsx`, `TeamView.tsx`, `RoundSection.tsx`, `PulseSection.tsx`, `BoardSection.tsx` |
| Ajustes | El permiso de cada señal, participar o no en el pulso, y tu link | `SettingsTab.tsx`, `PermissionRow.tsx` |

Las llamadas al backend están en `frontend/src/api.ts`, y en `hubApi.ts` las del mapa de contexto. Las primitivas del panel (`rd-panel`, `rd-list`, `rd-item`, `rd-tabbar`) están en [design/DESIGN.md](../design/DESIGN.md).

## Pruebas

`npm test` corre las pruebas del backend con una base en memoria. `npm run type-check` revisa tipos en backend y frontend. El lint de diseño corre solo antes de cada commit.

## Señales

`signals.ts` convierte los eventos de una persona en lo único que puede salir de su agente: frases como «Energía baja esta semana», nunca el dato crudo. La energía se compara contra el promedio de la propia persona, no contra el equipo. Cada señal lleva su permiso por defecto: el trabajo se comparte, y energía, carga y lo dicho en un check-in piden permiso antes.

Se leen en `GET /api/people/<token>/signals`. Es la entrada que usarán los agentes.

## Equipo: tablero y pulso

No hay agente coordinador. Lo que comparte un equipo son dos piezas que no interpretan ni deciden:

- **Tablero** (`board/`). Cualquier integrante publica una pregunta, un pedido o una propuesta; los demás responden y votan las propuestas. Una respuesta marcada como no contable solo la leen quien publicó y quien respondió.
- **Pulso** (`pulse.ts`). Devuelve el nivel mediano de energía y de carga y el total de bloqueos del equipo. Nunca devuelve una distribución ni un nombre. Se calcula sobre el resto del equipo, sin contar a quien lo mira, y con menos de 3 de ellos aportando a una señal no devuelve nada para esa señal.

Cada persona controla su aporte en `policy/`: un permiso por señal (`siempre`, `preguntar`, `nunca`) y si participa del pulso. `nunca` la saca también del agregado.

Un equipo se crea desde una persona. Los demás piden entrar con un código y quedan dentro cuando cada integrante aprueba. Todas las rutas de equipo verifican la membresía.

## Protecciones que dejó la revisión del backend

El 21-nov-2026 tres revisores independientes revisaron el backend, con un verificador por hallazgo. Lo que se confirmó quedó corregido como estas reglas, cada una con su prueba en `backend/test/`. Lo que no alcanzó a verificarse está en [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

| Regla | Prueba |
|---|---|
| Todo cuerpo tiene tope: 10.000 bytes, y 1 MB para el envío de Apple Health | `fix-body-limit` |
| Entrar a un equipo exige la aprobación de cada integrante. Con el código solo, una persona podía sumar identidades propias y leer el pulso de otra | `fix-pulse` |
| El pulso no cuenta a quien lo mira y no depende de su check-in ni de sus permisos | `fix-pulse` |
| El total de bloqueos solo cuenta a integrantes que tienen datos de bloqueos | `fix-pulse` |
| Una conexión OAuth parte solo desde la propia página, queda amarrada al navegador que la inició, dura 10 minutos y se usa una vez | `fix-oauth-state` |
| Una reunión movida, cancelada o rechazada reemplaza o borra el evento guardado, para que no quede pegada en la carga | `fix-calendar-updates` |
| Las señales leen los últimos 60 días de cada fuente y todo el historial de Linear, así el promedio propio de sueño y una tarea detenida no se pierden cuando llegan muchos eventos nuevos | `fix-signal-events` |
| El pulso del equipo lee los mismos eventos que las señales de cada integrante | `fix-signal-events` |
| La página de la persona muestra lo último recibido, no lo agendado más lejos | `fix-signal-events` |
| Las señales salen con el permiso que guardó la persona, en la ruta de señales y en la respuesta del check-in | `fix-signal-visibility` |

## Agentes

Cada persona tiene un agente y no hay coordinador ([AGENT_MODEL.md](AGENT_MODEL.md)). Los agentes conversan en **rondas**, una por equipo.

```
señales + permisos + repo  →  ficha  →  pedido  →  conversación 1:1  →  propuesta  →  cada persona acepta
```

| Paso | Qué pasa | Dónde |
|---|---|---|
| Lectura del repo | El modelo lee los archivos del repo que la persona dejó en «siempre» y devuelve en qué trabaja, qué ayuda necesita y qué temas maneja. Se hace una vez por versión del repo | `agents/digest.ts`, modelo |
| Ficha | Lo que el agente puede decir de su persona: las frases con permiso «siempre», lo que salió del repo, sus temas y una disponibilidad (alta, normal, baja) | `agents/cards.ts`, sin modelo |
| Pedido | Cada bloqueo que se puede contar es un pedido de ayuda. Uno con permiso «preguntar» espera a que su dueño lo permita | `agents/cards.ts`, sin modelo |
| A quién escribir | El agente de quien pide elige hasta 3 compañeros y le escribe al agente de cada uno | modelo |
| Respuesta | El agente de cada compañero responde si su persona puede ayudar: sí, parcial o no | modelo |
| Propuesta | El agente de quien pide redacta una propuesta con hasta 2 ayudantes | modelo |
| Acuerdo | La propuesta queda «acordada» cuando quien pide y cada ayudante aceptan. Un rechazo la descarta | `agents/store.ts` |

Reglas:

- **El modelo nunca ve un dato privado.** Recibe la ficha y los archivos del repo en «siempre». Un archivo en «preguntar» o en «nunca» no llega al modelo; el de «preguntar» espera a que la persona lo cambie. El sueño, la carga, el ánimo y la nota del check-in no entran a ningún mensaje al modelo; de energía y carga sale solo la disponibilidad, y con permiso «nunca» ni eso.
- **Nada se compromete sin la persona.** El agente propone; cada persona acepta o no.
- **La conversación la leen solo sus dos dueños.** El resto del equipo ve quién le escribió a quién y, cuando se acuerda, la propuesta.
- **Un tema con propuesta abierta o acordada en los últimos 7 días no se vuelve a pedir.**
- **Sin lenguaje natural en el código.** Decidir a quién escribir y si alguien puede ayudar lo hace el modelo con salida estructurada; el código solo valida identificadores y permisos.

Una ronda parte de dos formas: con «Iniciar ronda» en la pestaña Equipo, o sola una vez al día desde la hora `AGENT_ROUND_HOUR` (hora de Santiago, 9 por defecto) para los equipos que tienen algún pedido abierto. Si el servidor se reinicia a mitad de una ronda, esa ronda queda marcada como fallida.

| Ruta | Qué hace |
|---|---|
| `GET /api/people/<token>/teams/<equipo>/agents` | Estado de la última ronda, lo que tu agente te pregunta antes de contar, las conversaciones y las propuestas que puedes ver |
| `POST /api/people/<token>/teams/<equipo>/agents/rounds` | Inicia una ronda. Responde 202 y la ronda corre de fondo |
| `POST /api/people/<token>/agents/asks` | `{ "topic": "…", "allow": true }`: permite o niega que tu agente pida ayuda con ese tema |
| `POST /api/people/<token>/agents/proposals/<id>/answer` | `{ "answer": "acepta" }` o `"rechaza"` |

El modelo se llama detrás de una sola interfaz, `AgentModel` (`agents/model.ts`). Hay dos proveedores: 50x con DeepSeek (`agents/fiftyx.ts`), que se usa cuando está `FIFTYX_API_KEY`, y Anthropic con su SDK. El de 50x pide la respuesta con el esquema, la valida, la vuelve a pedir una vez si no lo cumple y nunca hace más de 4 llamadas a la vez. Las pruebas usan un modelo falso: nunca salen a la red. **La ronda no se ha probado contra el modelo real.** `npm run agents:check` corre una ronda de demo contra el modelo real y muestra el resultado.

Cada llamada al modelo tiene un límite de 30 segundos en 50x y de 90 en Anthropic. Una ronda que pasa de 10 minutos se da por fallida y deja de bloquear al equipo.

## Sala, asistentes y repo

Una persona entra a una sala con un código, conecta el agente que ya usa y ese agente llena su repo. El agente personal de Ronda habla en las rondas con lo que hay en ese repo.

**Sala** (`rooms/`). Es un equipo que tiene un código corto y admite sin aprobación. Por ser un equipo, le sirven las rondas, el tablero y el pulso. El código largo de un equipo sigue pidiendo aprobación. La sala guarda un registro de lo que pasa (alguien entra, un asistente se conecta, un repo cambia) para dibujarlo en la pantalla.

| Ruta | Qué hace |
|---|---|
| `POST /api/rooms` | `{ "name": "…" }` crea una sala y devuelve su código |
| `POST /api/rooms/<código>/join` | `{ "name": "…" }` crea a la persona, la deja dentro y devuelve su link. Con `{ "token": "…" }` entra una persona que ya existe |
| `GET /api/rooms/<código>/state` | Quién está, qué asistentes tiene cada uno y los hilos de la última ronda |
| `GET /api/rooms/<código>/events?since=<id>` | Lo que pasó después de ese punto |

Estas dos últimas rutas no piden link: las lee la pantalla de la sala. Por eso nunca devuelven el link de una persona; cada persona aparece con un identificador derivado.

**Asistente conectado** (`assistants/`). Es el agente que la persona ya usa: Claude Code, Codex, ChatGPT, Grok, OpenClaw u otro. Entra así:

1. La persona pide un código en su página. Dura 15 minutos, sirve una vez y pedir otro anula el anterior.
2. Le pega a su agente una línea con `/a/<código>`. Esa dirección devuelve el documento de ingreso en markdown (`assistants/joinDoc.ts`): qué es Ronda, las reglas y las llamadas.
3. El agente llama a `POST /api/assistants/join` con el código y recibe su token. El servidor guarda solo el hash del token. La persona ve sus asistentes y puede quitar cualquiera.

El documento describe llamadas HTTP y nada más: no pide instalar ni ejecutar nada, ni volver a buscar instrucciones.

**Repo** (`repo/`). Un árbol de archivos por persona, con historial, en la misma base. No es un repo de git: así también puede escribirlo un agente que no usa git.

| Ruta | Quién | Qué hace |
|---|---|---|
| `POST /api/repo/commit` | Asistente | `{ "message", "topics", "files": [{ "path", "content", "share" }], "delete": [] }` |
| `GET /api/repo` · `GET /api/repo/file?path=` | Asistente | El árbol y un archivo |
| `GET /api/people/<token>/repo` · `…/repo/file?path=` | Persona | Lo mismo |
| `PATCH /api/people/<token>/repo/file` | Persona | `{ "path", "share" }` cambia el permiso |
| `DELETE /api/people/<token>/repo/file?path=` | Persona | Borra un archivo |
| `POST /api/people/<token>/repo/paste` | Persona | `{ "kind", "content" }` guarda la respuesta que pegó desde una app de chat |

Reglas:

- **Cada archivo lleva un permiso**: `siempre`, `preguntar` (por defecto) o `nunca`. El asistente lo propone al crear el archivo. Después solo lo cambia la persona; una nueva versión del asistente no lo toca.
- **Lo que se revisa en código es forma, no significado**: la ruta, 8 KB por archivo, 20 archivos por cambio, 200 por repo y formatos conocidos de credenciales. Un cambio que rompe una regla no guarda nada.
- **Cada cambio deja un registro** en el servidor de contexto, bajo el asistente que lo hizo, y avisa a las salas de la persona.
- **Una ronda también deja registro en la sala**: empieza, se abre un hilo, llega la respuesta, nace una propuesta, termina. La pantalla ve quién le escribe a quién y el tema, nunca el texto.

## Simulación

`sim/` llena una sala con personas inventadas para ver a muchos agentes conversar. Cada persona inventada entra por el mismo camino que una real: queda en la sala, recibe un repo de tres archivos y su agente participa en la ronda.

- El modelo inventa a las personas de a 10 por llamada: rol, en qué trabaja, una necesidad en más o menos la mitad y los temas que domina. Los nombres salen de una lista fija.
- Como el servidor ya tiene esos datos ordenados, guarda la lectura del repo sin volver a llamar al modelo.
- Una persona inventada queda marcada. En la pantalla de la sala dice «Persona simulada», y solo de una conversación entre dos personas inventadas se muestra el texto.
- Tope: 60 personas inventadas por sala y 30 pedidos por ronda.

| Cómo | Qué hace |
|---|---|
| `POST /api/rooms/<código>/simulate` con `{ "people": 30 }` | Inventa las personas y parte una ronda. También está como botón en `/sala/<código>` |
| `npm run sim -- --people 30 [--sala <código>]` | Lo mismo desde la terminal, contra la base local. Sin `--sala` crea una sala nueva. Muestra las conversaciones y las propuestas |

## Servidor de contexto (datos de prueba)

`hub/` es el lugar donde los asistentes de cada persona dejan lo que saben de ella: salud, reuniones, correo, agenda, WhatsApp, código, Claude y Codex. **Hoy todo es de prueba**: conectar una fuente no habla con ningún servicio, solo crea la conexión y tres registros de ejemplo. Vive en tablas propias (`hub_connections`, `hub_items`) y no toca los eventos reales ni las señales.

| Ruta | Qué hace |
|---|---|
| `GET /api/context/<token>` | El mapa: cada fuente con su estado, total, último dato y sus 6 registros más nuevos, más las conexiones entre fuentes que comparten un tema. |
| `POST /api/context/<token>/push` | Un asistente deja un registro: `{ "source": "claude", "summary": "…", "topics": ["demo"], "occurredAt": "…" }`. Si la fuente no estaba conectada, la conecta. |
| `POST /api/context/<token>/sources/<fuente>` · `DELETE` | Conecta una fuente con datos de prueba / la desconecta y borra sus registros. |
| `POST /api/context/<token>/simulate` | Agrega un registro de prueba de alguna fuente conectada. La pantalla lo llama cada 6 s para que se vea llegar contexto. |

Los registros que deja un asistente al escribir el repo sí son reales. Las fuentes de asistentes nuevos (ChatGPT, Grok, OpenClaw, Instinct) aparecen en el mapa solo cuando están conectadas.

Dos fuentes quedan unidas cuando sus registros comparten un tema (`topics`); el nombre de cada tema está en `hub/catalog.ts`. La pantalla es `/contexto/<token>` (`frontend/src/ContextPage.tsx`); `?fuente=<id>` abre una fuente directo.
