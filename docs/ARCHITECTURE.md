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
    whatsapp/           puente de WhatsApp con Kapso: unir el teléfono, leer mensajes, botones y avisos
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
| `key` | La persona pega una llave y nosotros traemos los datos | Ninguna hoy; Granola pasó a OAuth |
| `oauth` | La persona autoriza con su cuenta y nosotros traemos los datos | Google, GitHub, Linear, Granola |

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

Cada persona tiene un token largo y aleatorio. Su link `/conectar/<token>` es su identidad. Quien tenga el link ve sus registros y actúa como esa persona, así que se entrega solo a su dueño.

Encima del link hay un ingreso con Google (`logins.ts`, rutas en `routes/oauth.ts`). Asocia un correo a una persona, para volver a la misma página desde cualquier dispositivo sin guardar el link y para que una cuenta no abra dos páginas. Entrar por primera vez crea la página, salvo que ya exista una con una integración de ese mismo correo: entonces abre esa. Una página que ya existe también se asocia desde Ajustes o al conectar Google Calendar o Gmail. La sesión queda abierta 60 días en ese navegador y se cierra desde el menú.

El ingreso con Google todavía no reemplaza al link: las rutas siguen aceptando el token sin pedir sesión. Hasta que eso cambie, lo que puede hacer quien administra un equipo lo puede hacer quien tenga su link.

## Pantallas

El frontend no usa un enrutador: `frontend/src/App.tsx` mira la dirección y elige una de tres pantallas.

| Dirección | Pantalla | Archivo |
|---|---|---|
| `/` | Solo el ingreso con Google (`LoginPage.tsx`). Si el servidor no tiene las credenciales de Google, como en un computador, muestra la portada anterior, que crea una persona y abre una sala (`HomePage.tsx`) | `App.tsx` |
| `/sala` | Abre una sala nueva | `RoomStart.tsx` |
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

- **Tablero** (`board/`). Cualquier integrante publica una pregunta, un pedido o una propuesta; los demás responden y votan las propuestas. Una respuesta marcada como no contable solo la leen quien publicó y quien respondió. Una pregunta la responden además los agentes: ver [Preguntarle al equipo](#preguntarle-al-equipo).
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
| Ficha | Lo que el agente puede decir de su persona: las frases con permiso «siempre», lo que salió del repo, en qué trabaja según sus fuentes (tareas iniciadas de Linear, PR abiertos y commits recientes de GitHub), sus temas y una disponibilidad (alta, normal, baja). En qué trabaja sigue el permiso «Temas de trabajo» | `agents/cards.ts` y `signals.ts`, sin modelo |
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

### Cuánto gasta una ronda

Cada llamada al modelo informa sus tokens (`onUsage` en `agents/model.ts`): 50x y Anthropic entregan el número medido; con el Claude de la terminal se aproxima por caracteres. `runRound` suma las llamadas de su ronda y las guarda en `agent_round_usage`. Antes de iniciar, `agents/estimate.ts` calcula lo que gastaría una ronda sin llamar al modelo: arma los prompts reales de cada pedido abierto y los pasa a tokens con la razón medida en las últimas rondas. Sin rondas medidas usa 3,3 caracteres por token y 150 tokens de salida por llamada.

### Mesa pública

`backend/src/mesa/`. Una sola mesa para todas las personas. No es membresía de equipo: es una fila fija en `teams` (`mesa-publica`) sin integrantes guardados, para que el onboarding, el ingreso y «preguntarle al equipo» sigan viendo solo los equipos reales. Participa cada persona no simulada que no haya salido, y a la conversación entra solo quien tiene algo publicado.

La ronda se inicia a mano o sola. Un temporizador revisa cada 5 segundos y parte una ronda solo si se cumplen todas: hay intervalo elegido, no hay ronda en curso, pasó el intervalo desde la última, no se llegó al tope de tokens de las últimas 24 horas (`MESA_DAILY_TOKEN_CAP`, 3.000.000 por defecto) y cambió la huella de lo publicado (versión del repo, frases, temas y pedidos de cada persona). Sin nada nuevo no gasta. Las propuestas llegan a cada persona por los mismos avisos de una ronda de equipo.

### El globo en vivo

Lo que se ve en la pestaña Globo al iniciar una ronda sale de la ronda real, no de un guion. `runRound` registra cada paso en `room_events` (para la mesa, siempre): quién busca ayuda, cada paso de su agente (`paso`: revisar lo que publicó la mesa, leer si su persona puede ayudar, redactar la propuesta), cada mensaje, la propuesta y el cierre. Con 50x, la mesa pide las respuestas en streaming (`onText` en `agents/fiftyx.ts`; si 50x no puede, vuelve sola a la llamada normal y no reintenta por 10 minutos) y `agents/partial.ts` saca del JSON a medio escribir el texto del mensaje, que queda en memoria (`mesa/live.ts`) mientras dura la ronda. `design/grafo/universo-vivo.js` lee `GET …/mesa/live` cada 350 ms durante la ronda: sienta a las personas reales en la esfera, enciende el arco de cada conversación, abre la tarjeta y la miniatura de cada paso y hace crecer cada burbuja con lo que el modelo lleva escrito. Los agentes no llaman herramientas: las tarjetas muestran los pasos reales de cada agente.

### Preguntarle al equipo

Una persona publica una pregunta en el tablero y recibe una sola respuesta armada con lo que saben los agentes de los demás, sin interrumpir a nadie (`agents/ask.ts`).

```
pregunta en el tablero  →  el agente de cada integrante responde  →  el agente de quien preguntó arma una respuesta
```

| Paso | Qué pasa | Dónde |
|---|---|---|
| A quién se le pregunta | A los agentes de los integrantes que comparten algo: una frase o un tema en su ficha, o un archivo del repo en «siempre». Hasta 40. A un agente sin nada que contar no se le pregunta | `respondersOf`, sin modelo |
| Respuesta de cada agente | Recibe la pregunta, la ficha de su persona y sus archivos en «siempre». Dice si su persona sabe algo (sí, parcial, no) y lo cuenta en una a tres frases. Si sabe algo, su respuesta queda en el tablero a nombre del agente | modelo, 4 a la vez |
| Respuesta armada | El agente de quien preguntó junta las respuestas en dos a cinco frases y dice de quiénes salieron | modelo |

Valen las mismas reglas de la ronda: el modelo recibe solo lo que cada persona dejó en «siempre», y la pregunta y los archivos se le entregan como datos, no como instrucciones. Si ningún agente sabe algo, no se arma ninguna respuesta y la pantalla lo dice. Las personas pueden seguir respondiendo a mano.

Parte sola al publicar una pregunta. Quien preguntó puede pedirla de nuevo. Un equipo responde hasta 3 preguntas a la vez; la cuarta queda publicada sin respuesta de agentes hasta que se pida.

El modelo se llama detrás de una sola interfaz, `AgentModel` (`agents/model.ts`). Hay dos proveedores: 50x con DeepSeek (`agents/fiftyx.ts`), que se usa cuando está `FIFTYX_API_KEY`, y Anthropic con su SDK. El de 50x pide la respuesta con el esquema, la valida, la vuelve a pedir una vez si no lo cumple y nunca hace más de 4 llamadas a la vez. Las pruebas usan un modelo falso: nunca salen a la red. **La ronda no se ha probado contra el modelo real.** `npm run agents:check` corre una ronda de demo contra el modelo real y muestra el resultado.

Cada llamada al modelo tiene un límite de 30 segundos en 50x y de 90 en Anthropic. Una ronda que pasa de 10 minutos se da por fallida y deja de bloquear al equipo.

## WhatsApp

Cada persona tiene un solo agente y varias puertas para hablarle: WhatsApp, el agente que ya usa (Claude Code, Codex) y el panel. Las tres hacen lo mismo. La conversación vive en `whatsapp/bridge.ts`, que guarda cada mensaje del agente en una bandeja por persona y lo empuja a WhatsApp cuando corresponde; el agente conectado la lee y responde por `routes/agentDoor.ts`, con llamadas HTTP o como servidor MCP ([API.md](API.md#hablarle-a-tu-agente-desde-otro-agente)).

El puente une un teléfono con una persona y lleva al chat lo que el panel ya hacía: el check-in, el permiso para contar un bloqueo, la respuesta a una propuesta y las preguntas al equipo. El detalle de cada momento está en [INTEGRATIONS.md](INTEGRATIONS.md#whatsapp).

| Pieza | Qué hace | Dónde |
|---|---|---|
| Canal | Envía texto y botones por Kapso, de a un mensaje por teléfono, y comprueba la firma del webhook | `whatsapp/kapso.ts` |
| Almacén | Teléfono de cada persona, códigos para unirlo, botones enviados y entregas ya vistas | `whatsapp/store.ts` |
| Lectura | El modelo clasifica un mensaje de texto en check-in, pregunta u otro, con salida estructurada | `whatsapp/reading.ts` |
| Puente | Decide qué hacer con cada mensaje y manda los avisos | `whatsapp/bridge.ts` |

Reglas:

- **Un botón es una acción con tipo.** Permitir, aceptar y rechazar llegan como el identificador del botón, no como texto que haya que interpretar. Solo vale si lo aprieta el teléfono al que se le envió, y una sola vez.
- **El texto libre lo lee el modelo.** El código solo busca el código de unión, que es un identificador exacto.
- **El mensaje de la persona sí llega al modelo**, porque es su propio agente quien lo lee. Lo que el modelo devuelve se guarda como check-in en la memoria privada y no entra a ningún mensaje entre agentes.
- **Las señales no pasan por el modelo.** La frase «Por tus fuentes veo…» la arma el código.
- **Un teléfono que nadie unió no gasta modelo**: recibe una sola vez por hora la instrucción para conectarse.

## Sala, asistentes y repo

Una persona entra a una sala con un código, conecta el agente que ya usa y ese agente llena su repo. El agente personal de Montu habla en las rondas con lo que hay en ese repo.

**Sala** (`rooms/`). Es un equipo que tiene un código corto y admite sin aprobación. Por ser un equipo, le sirven las rondas, el tablero y el pulso. El código largo de un equipo sigue pidiendo aprobación. La sala guarda un registro de lo que pasa (alguien entra, un asistente se conecta, un repo cambia) para dibujarlo en la pantalla.

| Ruta | Qué hace |
|---|---|
| `POST /api/rooms` | `{ "name": "…" }` crea una sala y devuelve su código |
| `POST /api/rooms/<código>/join` | `{ "name": "…" }` crea a la persona, la deja dentro y devuelve su link. Con `{ "token": "…" }` entra una persona que ya existe |
| `GET /api/rooms/<código>/state` | Quién está, qué asistentes tiene cada uno, la cara que eligió (`face`, o `null`) y los hilos de la última ronda. El globo dibuja con esa cara a cada persona real |
| `GET /api/rooms/<código>/events?since=<id>` | Lo que pasó después de ese punto |

Estas dos últimas rutas no piden link: las lee la pantalla de la sala. Por eso nunca devuelven el link de una persona; cada persona aparece con un identificador derivado.

**Asistente conectado** (`assistants/`). Es el agente que la persona ya usa: Claude Code, Codex, ChatGPT, Grok, OpenClaw u otro. Entra así:

1. La persona pide un código en su página. Dura 15 minutos, sirve una vez y pedir otro anula el anterior.
2. Le pega a su agente una línea con `/a/<código>`. Esa dirección devuelve el documento de ingreso en markdown (`assistants/joinDoc.ts`): qué es Montu, las reglas y las llamadas.
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

## El globo en la sala (propuesta)

El backend sirve bajo `/design/` las piezas del globo: `design/grafo`, `faces`, `logo`, `sources`, `luz` y las dos hojas de estilo (`backend/src/designAssets.ts`). El resto de `design/` no se sirve.

`/design/grafo/sala.html?sala=<código>` abre el globo aprobado y le carga `grafo/sala.js`, que cada 1,5 s lee `GET /api/rooms/<código>/state` y reemplaza los datos de demo: las personas de la sala con su nombre y su agente, y un grupo por cada persona que pidió ayuda en la última ronda. El más reciente va con color. `globo.html` no cambia. La pantalla `/sala/<código>` enlaza a esta página; integrarla dentro de esa pantalla espera la revisión de Mati.

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
