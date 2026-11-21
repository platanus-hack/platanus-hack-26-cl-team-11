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
- [ ] **Dónde vive la vista de equipo:** web propia, mensaje al grupo de WhatsApp o ambos.
- [ ] **Cadencia del pulso del equipo:** diaria, semanal o solo a pedido.
- [ ] **Qué motivos abren una conversación entre agentes**, para no hablar todos con todos cada día.

### Privacidad

- [ ] **Tamaño mínimo de grupo.** Hoy es 3 personas aportando por señal, y el pulso entrega solo el nivel mediano, sin distribución. Falta decidir si 3 basta: en un grupo chico, quien conoce su propio nivel todavía puede deducir algo de los demás.
- [ ] **Cuánto tiempo se guarda** la memoria privada.
- [ ] **Qué ve un líder** cuando una persona eligió no compartir nada.

### Técnica

- [ ] **Framework de agentes.** El resto del stack ya está en el repo: TypeScript, Hono y SQLite en `backend/`, React con Vite en `frontend/`.
- [ ] **Transporte entre agentes:** cola de mensajes, base de datos compartida u otro.
- [ ] **Puente de WhatsApp:** qué proveedor y qué número.
- [ ] **Dónde corre cada agente** y cómo se aísla su memoria privada.
- [ ] **Qué integraciones son reales** en la demo y cuáles sintéticas.

### Equipo

- [ ] Quién toma cada ítem de [ROADMAP.md](ROADMAP.md) y quién arma la presentación.
- [ ] Confirmar en el sitio de Y Combinator si «Multiplayer AI» está en sus Requests for Startups antes de citarlo.
