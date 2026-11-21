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
| `key` | La persona pega una llave y nosotros traemos los datos | Granola, GitHub |
| `oauth` | La persona autoriza con su cuenta y nosotros traemos los datos | Google |

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
