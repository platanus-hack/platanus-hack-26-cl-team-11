# Decisiones y preguntas abiertas

## Decidido (21-nov-2026)

| Tema | Decisión |
|---|---|
| Foco de la demo | Agentes conversando entre sí, de punta a punta. |
| Canal con la persona | WhatsApp. |
| Privacidad | La persona decide qué sale de su agente; los líderes ven agregados. |
| Fuentes | Wearables, check-in conversacional, trabajo (GitHub, Linear, calendario) y reuniones (Granola). |
| Relación con Montu | Proyecto nuevo con código desde cero; se toma lo aprendido, no el código. |
| Conversación entre agentes | Primero 1:1. Las necesidades descubiertas forman un grafo dirigido. En el turno 2, las salidas de un mismo solicitante pueden originar grupos. Red sin coordinador, con tablero y función de agregado; detalle en [AGENT_MODEL.md](AGENT_MODEL.md). |
| Orden de construcción | Base, luego diferenciadores, luego extras; detalle en [ROADMAP.md](ROADMAP.md). |
| Multijugador | Una sala abierta con QR. El agente que cada persona ya usa entra con un link y escribe su repo; el agente personal de Ronda conversa leyendo ese repo. Detalle en [AGENT_MODEL.md](AGENT_MODEL.md#agente-personal-y-asistentes-conectados). |
| Cómo se conecta un agente | No hay un estándar único. Se usa un link pegado con un documento de ingreso (como hizo Moltbook con OpenClaw) y, para apps de chat, copiar una pregunta y pegar la respuesta. Un servidor MCP queda como siguiente puerta; A2A no calza porque exige que cada agente sea un servidor con dirección. |
| Modelo | DeepSeek en 50x, con `FIFTYX_API_KEY`. |

## Abierto

### Producto

- [ ] **Nombre del proyecto.** Provisorio: «Ronda» (ver `design/README.md`).
- [ ] **Track de la hack** en el que se inscribe.
- [ ] **Dónde vive la vista de equipo:** web propia, mensaje al grupo de WhatsApp o ambos. Hoy: en la web, pestaña Equipo del panel personal.
- [ ] **Cadencia del pulso del equipo:** diaria, semanal o solo a pedido. Hoy: a pedido; se calcula cada vez que alguien abre la pestaña Equipo.
- [ ] **Qué motivos abren una conversación entre agentes**, para no hablar todos con todos cada día. Hoy uno solo: un bloqueo que la persona permite contar. La ronda parte a mano o una vez al día.
- [ ] **Grupos del turno 2.** [AGENT_MODEL.md](AGENT_MODEL.md) abre un trío cuando un solicitante tiene dos ayudantes. Hoy la ronda llega hasta una propuesta con hasta 2 ayudantes y no abre una conversación de grupo. Falta decidir si se construye o si la demo lo muestra solo en el globo.

### Privacidad

- [ ] **Tamaño mínimo de grupo.** Hoy son 3 personas aportando por señal sin contar a quien mira (equipo de 4), y el pulso entrega solo el nivel mediano. Falta decidir si basta para equipos chicos.
- [ ] **Cuánto tiempo se guarda** la memoria privada.
- [ ] **Qué ve un líder** cuando una persona eligió no compartir nada.

### Multijugador

- [ ] **«Simular 30 personas» es lenta para mostrarla en vivo.** Medido en producción el 21-nov-2026: poblar 30 personas toma 30 segundos y la ronda casi 2 minutos (45 conversaciones); con 60, 1 minuto y 4 minutos y medio (89 conversaciones). El límite es que 50x atiende 4 llamadas a la vez. Para la demo conviene dejar una sala ya simulada.
- [x] **Cargar `FIFTYX_API_KEY` en Render** y probar una ronda y una simulación con 50x. Hecho el 21-nov-2026: `npm run agents:check` contra 50x terminó en 11 segundos con 2 conversaciones y 1 propuesta, y en producción una simulación de 4 personas terminó en 30 segundos con 2 conversaciones.
- [ ] **El globo dentro de `/sala/<código>`.** Hoy es una página de prueba (`design/grafo/sala.html`). Falta que Mati decida cómo nace un nodo, cómo se ve antes y después de conectar su agente, y la dirección del arco.
- [ ] **Puerta MCP.** Construida para hablarle al agente propio desde Claude Code o Codex (`/api/mcp`, con el token del asistente): decirle algo, ver pendientes y responder. Probada con pruebas automáticas, no con un Claude Code real. Falta la puerta para apps de chat sin copiar y pegar (necesita OAuth) y las **respuestas en vivo** de un asistente que esté abierto durante la ronda.
- [ ] **«Preguntar antes» por archivo.** Hoy un archivo en ese estado espera a que la persona lo cambie. Falta que el agente le pregunte por WhatsApp.
- [ ] **Logos de ChatGPT, Grok, OpenClaw e Instinct.** Usan un glifo genérico.

### Técnica

- [x] **Framework de agentes.** Ninguno: llamadas directas al modelo con salida estructurada, en `backend/src/agents/`. Detalle en [ARCHITECTURE.md](ARCHITECTURE.md).
- [x] **Transporte entre agentes:** la base compartida. Cada conversación se guarda como un hilo con sus mensajes.
- [ ] **Puente de WhatsApp:** el proveedor es Kapso y la demo lo lleva (decisión de Ian, 21-nov). Está construido y probado con un Kapso falso ([INTEGRATIONS.md](INTEGRATIONS.md#whatsapp)). Las variables están en Render y el webhook está registrado en el número de prueba de Kapso, en un proyecto de Kapso separado del de los clientes de Vita (21-nov). Falta probarlo con un teléfono. Falta decidir el número: con el de prueba solo puede escribir el teléfono registrado en la sesión; para el público hace falta uno propio.
- [ ] **Dónde corre cada agente** y cómo se aísla su memoria privada. Hoy todos corren dentro del mismo servidor, y la memoria privada se separa por el token de cada persona en una sola base.
- [ ] **Qué integraciones son reales** en la demo y cuáles sintéticas. Hoy: Apple Health está probada con un iPhone real; GitHub, Linear, Google Calendar, Gmail y Granola están construidas y sin probar contra el servicio.
- [x] **Probar la ronda de agentes contra el modelo real.** Corrió con DeepSeek en 50x, en local y en producción (21-nov-2026).
- [ ] **Probar las preguntas del tablero contra el modelo real.** Los agentes responden una pregunta y arman una sola respuesta ([ARCHITECTURE.md](ARCHITECTURE.md#preguntarle-al-equipo)); solo ha corrido con un modelo falso.
- [ ] **Conectar el globo a datos reales.** El globo de `design/grafo/` usa conversaciones simuladas. La ruta de agentes ya entrega las flechas ([API.md](API.md#agentes)).

### Equipo

- [ ] Quién toma cada ítem de [ROADMAP.md](ROADMAP.md) y quién arma la presentación. La frase, la estructura, el guion de 2:30 y las preguntas difíciles están en [PITCH.md](PITCH.md), con sus pendientes.
- [ ] Confirmar en el sitio de Y Combinator si «Multiplayer AI» está en sus Requests for Startups antes de citarlo. Revisado el 21-nov-2026: la página oficial muestra la lista de Winter 2027, que no lo incluye, y el texto de Fall 2026 no cargó. Varias fuentes secundarias coinciden en que es uno de los 13 pedidos de Fall 2026, de Aaron Epstein, y en que pide sesiones compartidas con un agente, no agentes que conversan entre sí. Cómo citarlo está en [PITCH.md](PITCH.md#y-combinator-y-multiplayer-ai).

### Hallazgos de la revisión del backend sin verificar (21-nov-2026)

Tres revisores encontraron 17 problemas. Los 9 más graves se verificaron y se corrigieron; las reglas que dejaron están en [ARCHITECTURE.md](ARCHITECTURE.md#protecciones-que-dejó-la-revisión-del-backend). Estos 8 no alcanzaron a verificarse, así que pueden ser reales o no:

- [ ] El envío de Apple Health guarda cualquier contenido de hasta 1 MB por evento, sin tope por persona ni detección de duplicados.
- [ ] Una tarea de Linear que deja de estar asignada a la persona queda «en curso» para siempre y se vuelve un bloqueo permanente.
- [ ] Al cambiar de cuenta en una fuente, los eventos de la cuenta anterior siguen guardados.
- [ ] Desconectar una fuente mientras se está sincronizando puede dejar eventos guardados sin conexión.
- [ ] El código de ingreso al equipo lo ve todo integrante y nunca cambia. Desde que entrar requiere aprobación, el código solo deja una solicitud.
- [ ] Cualquiera puede crear personas, equipos y publicaciones sin límite: no hay autenticación ni freno por frecuencia.
- [ ] El conector de GitHub lee campos que su API podría haber dejado de enviar; la prueba pasa con un ejemplo antiguo. Se confirma con una llave real.
- [ ] El pulso todavía se puede comparar entre dos lecturas: no hay una foto diaria fija. Para aprovecharlo hace falta una segunda identidad aprobada por todo el equipo.

