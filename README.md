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
| [docs/ROADMAP.md](docs/ROADMAP.md) | Qué se construye en la hack, en qué orden y contra qué referentes de EE. UU. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Cómo está armado el código y cómo se agrega una fuente. |
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
| `npm run seed` | Crea cinco personas de demo con 14 días de datos sintéticos |

Variables opcionales, en `.env.example`: `PORT`, `PUBLIC_BASE_URL` (dirección pública que se muestra para el Atajo) y `DATA_DIR` (carpeta de la base; por defecto `backend/data`, ignorada por git).

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
| Apple Health | Recibe envíos; falta probar el Atajo en un iPhone |
| Granola, GitHub, Linear | Se conectan con llave; probados solo con respuestas simuladas |
| Google Calendar y Gmail | OAuth listo; falta crear las credenciales en Google Cloud |

Los agentes y su conversación no están construidos. Detalle en [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) y [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Remotes

- `origin` — working repo.
- `team` — add the organizers' team repo once it is assigned:
  `git remote add team https://github.com/platanus-hack/<team-repo>.git && git push team main`
