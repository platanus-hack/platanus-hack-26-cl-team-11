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

### Técnica

- [x] **Framework de agentes.** Ninguno: llamadas directas al modelo con salida estructurada, en `backend/src/agents/`. Detalle en [ARCHITECTURE.md](ARCHITECTURE.md).
- [x] **Transporte entre agentes:** la base compartida. Cada conversación se guarda como un hilo con sus mensajes.
- [ ] **Puente de WhatsApp:** qué proveedor y qué número. Hoy no está construido: el check-in, los permisos y la aprobación de propuestas se hacen en el panel web. Ian avisó en el hilo del equipo (21-nov, 06:00) que WhatsApp queda fuera por ahora. Falta decidir si la demo lo lleva, porque [DEMO.md](DEMO.md) todavía lo cuenta como real.
- [ ] **Dónde corre cada agente** y cómo se aísla su memoria privada. Hoy todos corren dentro del mismo servidor, y la memoria privada se separa por el token de cada persona en una sola base.
- [ ] **Qué integraciones son reales** en la demo y cuáles sintéticas. Hoy: Apple Health está probada con un iPhone real; GitHub, Linear, Google Calendar, Gmail y Granola están construidas y sin probar contra el servicio.
- [ ] **Probar la ronda de agentes contra el modelo real.** Solo ha corrido con un modelo falso. Faltan las credenciales del modelo en Render; `npm run agents:check` la prueba en local.
- [ ] **Conectar el globo a datos reales.** El globo de `design/grafo/` usa conversaciones simuladas. La ruta de agentes ya entrega las flechas ([API.md](API.md#agentes)).

### Equipo

- [ ] Quién toma cada ítem de [ROADMAP.md](ROADMAP.md) y quién arma la presentación.
- [ ] Confirmar en el sitio de Y Combinator si «Multiplayer AI» está en sus Requests for Startups antes de citarlo.

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

