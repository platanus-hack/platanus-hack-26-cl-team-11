# Arquitectura

Cómo está armado el código y cómo se agrega una pieza nueva. Cómo levantarlo está en el [README](../README.md).

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

## Agentes

Cada persona tiene un agente y no hay coordinador ([AGENT_MODEL.md](AGENT_MODEL.md)). Los agentes conversan en **rondas**, una por equipo.

```
señales + permisos  →  ficha  →  pedido  →  conversación 1:1  →  propuesta  →  cada persona acepta
```

| Paso | Qué pasa | Dónde |
|---|---|---|
| Ficha | Lo que el agente puede decir de su persona: las frases con permiso «siempre», sus temas y una disponibilidad (alta, normal, baja) | `agents/cards.ts`, sin modelo |
| Pedido | Cada bloqueo que se puede contar es un pedido de ayuda. Uno con permiso «preguntar» espera a que su dueño lo permita | `agents/cards.ts`, sin modelo |
| A quién escribir | El agente de quien pide elige hasta 3 compañeros y le escribe al agente de cada uno | modelo |
| Respuesta | El agente de cada compañero responde si su persona puede ayudar: sí, parcial o no | modelo |
| Propuesta | El agente de quien pide redacta una propuesta con hasta 2 ayudantes | modelo |
| Acuerdo | La propuesta queda «acordada» cuando quien pide y cada ayudante aceptan. Un rechazo la descarta | `agents/store.ts` |

Reglas:

- **El modelo nunca ve un dato privado.** Solo recibe la ficha. El sueño, la carga, el ánimo y la nota del check-in no entran a ningún mensaje al modelo; de energía y carga sale solo la disponibilidad, y con permiso «nunca» ni eso.
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

El modelo se llama desde `agents/model.ts` con el SDK de Anthropic. Las pruebas usan un modelo falso: nunca salen a la red. **La ronda no se ha probado contra el modelo real.** `npm run agents:check` corre una ronda de demo contra el modelo real y muestra el resultado.

Cada llamada al modelo tiene un límite de 90 segundos. Una ronda que pasa de 10 minutos se da por fallida y deja de bloquear al equipo.

## Servidor de contexto (datos de prueba)

`hub/` es el lugar donde los asistentes de cada persona dejan lo que saben de ella: salud, reuniones, correo, agenda, WhatsApp, código, Claude y Codex. **Hoy todo es de prueba**: conectar una fuente no habla con ningún servicio, solo crea la conexión y tres registros de ejemplo. Vive en tablas propias (`hub_connections`, `hub_items`) y no toca los eventos reales ni las señales.

| Ruta | Qué hace |
|---|---|
| `GET /api/context/<token>` | El mapa: cada fuente con su estado, total, último dato y sus 6 registros más nuevos, más las conexiones entre fuentes que comparten un tema. |
| `POST /api/context/<token>/push` | Un asistente deja un registro: `{ "source": "claude", "summary": "…", "topics": ["demo"], "occurredAt": "…" }`. Si la fuente no estaba conectada, la conecta. |
| `POST /api/context/<token>/sources/<fuente>` · `DELETE` | Conecta una fuente con datos de prueba / la desconecta y borra sus registros. |
| `POST /api/context/<token>/simulate` | Agrega un registro de prueba de alguna fuente conectada. La pantalla lo llama cada 6 s para que se vea llegar contexto. |

Dos fuentes quedan unidas cuando sus registros comparten un tema (`topics`); el nombre de cada tema está en `hub/catalog.ts`. La pantalla es `/contexto/<token>` (`frontend/src/ContextPage.tsx`); `?fuente=<id>` abre una fuente directo.
