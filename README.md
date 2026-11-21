# platanus-hack-26

Platanus Hack 26: Santiago — 20–22 Nov 2026.

## Qué construimos

Una herramienta para mejorar el rendimiento y la coordinación de equipos: cada persona tiene un **agente personal** que la conoce (sueño, ánimo, carga, en qué trabaja) y los agentes **conversan entre sí** para detectar quién necesita ayuda, quién puede darla y qué guidelines le sirven al equipo. Pensada para que funcione igual en un equipo de 5 que en una organización de 300, donde no hay daily posible.

## Documentos base

| Documento | Contenido |
|---|---|
| [docs/VISION.md](docs/VISION.md) | El problema, la idea y los principios. |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Usuarios, piezas, flujos y resultados. |
| [docs/AGENT_MODEL.md](docs/AGENT_MODEL.md) | Tipos de agente, cómo conversan y cómo escala a 300 personas. |
| [docs/PRIVACY.md](docs/PRIVACY.md) | Qué se comparte, quién ve qué y los derechos de cada persona. |
| [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) | Fuentes de señal y qué deriva el agente de cada una. |
| [docs/DEMO.md](docs/DEMO.md) | Alcance y guion de la demo. |
| [docs/PITCH.md](docs/PITCH.md) | Cómo se explica Montu: la frase, la estructura, el guion de 2:30, las láminas y las preguntas difíciles. |
| [docs/demo/](docs/demo/README.md) | El camino feliz grabado de punta a punta: sala, QR, agente, repo, ronda y globo. Borrador de la segunda grabación: [diez personas, sus fuentes y sus agentes](docs/demo/diez-personas.md). |
| [tools/grabar/](tools/grabar/README.md) | Los guiones que graban las demos, el servidor y el proveedor simulados, y sus pruebas. |
| [design/grafo/universo.html](design/grafo/universo.html) | Demo omnipotente del grafo: ronda uno a uno, grupos en vivo y la semana coordinada (AGENTS.md, regla 6). |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Qué se construye en la hack, en qué orden y contra qué referentes de EE. UU. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Cómo está armado el código y cómo se agrega una fuente. |
| [docs/API.md](docs/API.md) | Todas las rutas del backend: qué reciben y qué responden. |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Despliegue en Render y cómo corre el CI. |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | Cómo entra la señal de cada fuente; el receptor está en `backend/`. |
| [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) | Decisiones tomadas y preguntas abiertas. |
| [design/DESIGN.md](design/DESIGN.md) | Dirección visual, tokens y primitivas de UI. Obligatorio antes de tocar UI. |

## Cómo levantarlo

Requiere Node 22.5 o superior (`nvm use` toma la versión de `.nvmrc`). No hace falta Docker ni base de datos: el backend usa el SQLite que trae Node.

```bash
npm install
npm run dev
```

| Qué | Dónde |
|---|---|
| Frontend (Vite + React) | http://localhost:5173 |
| Backend (Hono) | http://localhost:8787, bajo `/api` |

El frontend le pasa `/api` al backend, así que en desarrollo se usa solo el puerto 5173.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta backend y frontend con recarga automática |
| `npm run dev:back` / `npm run dev:front` | Levanta solo uno |
| `npm test` | Pruebas del backend |
| `npm run type-check` | Revisa tipos en ambos |
| `npm run build && npm start` | Compila el frontend y lo sirve desde el backend en un solo puerto |
| `npm run add-person -- "Nombre"` | Crea una persona y muestra su link |
| `npm run agents:check` | Corre una ronda de agentes de demo contra el modelo real y muestra el resultado |
| `npm run seed` | Crea cinco personas de demo con 14 días de datos sintéticos, juntas en un equipo |
| `npm run sim -- --people 30` | Llena una sala con personas inventadas y corre una ronda entre sus agentes (necesita el modelo) |

Variables opcionales, en `.env.example`: `PORT`, `PUBLIC_BASE_URL` (dirección pública que se muestra para el Atajo) y `DATA_DIR` (carpeta de la base; por defecto `backend/data`, ignorada por git). El backend lee un archivo `.env` en la raíz del repo si existe.

## Estructura

| Carpeta | Contenido |
|---|---|
| `backend/` | API en TypeScript: personas, eventos y conectores (`src/connectors/`) |
| `frontend/` | Web en React. Usa los tokens y primitivas de `design/` |
| `design/` | Tokens, primitivas de interfaz y referencias visuales |
| `docs/` | Definiciones del producto |

## Estado

Funciona: crear una persona, conectar sus fuentes, guardar todo como eventos y derivar sus señales (energía, carga, bloqueos y experiencia). También el check-in diario, los equipos con código y aprobación de ingreso, el tablero compartido y el pulso agregado del equipo.

| Fuente | Estado |
|---|---|
| Apple Health | Probado con un iPhone real |
| GitHub, Linear, Google Calendar y Gmail | OAuth listo; faltan las credenciales de cada aplicación |
| Granola | OAuth listo, por el servidor MCP de Granola; probado solo con respuestas simuladas |

En producción: https://ronda-n8if.onrender.com

**Multijugador.** Una sala se abre desde la portada y muestra un QR en `/sala/<código>`. Quien lo escanea entra con su nombre y conecta el agente que ya usa pegándole una línea con un link; ese agente escribe su repo. Probado el 21-nov-2026 en local con dos agentes reales, Claude Code y Codex. Una app de chat sin herramientas entra copiando una pregunta y pegando la respuesta. Detalle en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#sala-asistentes-y-repo).

Los agentes ya conversan en rondas por equipo y dejan propuestas que cada persona acepta. También responden las preguntas del tablero: quien pregunta recibe una sola respuesta armada con lo que comparten los demás (probado solo con un modelo falso). El modelo es DeepSeek en 50x cuando está `FIFTYX_API_KEY`. La llave está en el servidor desde el 21-nov-2026: la ronda corrió con 50x en local y una simulación de 4 personas corrió en producción. Detalle en [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) y [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

**WhatsApp.** Cada persona puede unir su teléfono y hablar con su agente por WhatsApp, vía Kapso: check-in, permiso para contar un bloqueo, propuestas con botones, presentación al acordar y preguntas al equipo. Construido y probado con un Kapso falso. El servidor ya tiene la llave y el webhook registrado en el número de prueba de Kapso; falta probarlo con un teléfono. Detalle en [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md#whatsapp).

## Remotes

- `origin` — working repo.
- `team` — add the organizers' team repo once it is assigned:
  `git remote add team https://github.com/platanus-hack/<team-repo>.git && git push team main`
