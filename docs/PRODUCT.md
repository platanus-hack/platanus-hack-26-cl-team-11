# Producto

## Usuarios

| Rol | Qué quiere | Qué recibe |
|---|---|---|
| **Integrante** | Que alguien note cuando está trabado o agotado, sin tener que exponerse en una reunión. | Un agente personal por WhatsApp que lo conoce, le ofrece ayuda concreta y le dice quién del equipo puede apoyarlo. |
| **Líder de equipo** | Saber cómo está el equipo y dónde meter mano, sin dailys eternas. | Un resumen del pulso del equipo, alertas agregadas y propuestas de guidelines. |
| **Dirección** (equipos grandes) | Entender la organización sin leer cientos de reportes. | Agregados por grupo y respuestas a las preguntas que le hace a su propio agente. |

## Piezas

1. **Agente personal.** Uno por persona. Conversa por WhatsApp, lee las fuentes conectadas y mantiene una memoria privada de su dueño.
2. **Canal entre agentes.** Por donde los agentes se hablan uno a uno, sin agente coordinador al medio. Detalle en [AGENT_MODEL.md](AGENT_MODEL.md).
3. **Tablero compartido y función de agregado.** Dos piezas que no son agentes: un lugar donde cualquier agente publica preguntas, pedidos y propuestas, y un cálculo que devuelve solo totales de grupo.
4. **Vista de equipo.** Donde el equipo lee el resultado: pulso, pedidos y ofertas de ayuda, guidelines propuestas.

## Flujos principales

### 1. Check-in diario

El agente personal escribe a su dueño en la mañana. Ya leyó el wearable, el calendario y la actividad de trabajo, así que pregunta poco y con contexto («dormiste 5 h y tienes 6 reuniones, ¿cómo vienes?»). Lo que la persona responde queda en la memoria privada del agente.

### 2. Pulso del equipo

Cada agente entrega las señales que su dueño autorizó (energía, carga, bloqueos) a la función de agregado, que devuelve el total del grupo. Nadie ve la respuesta de otro y no hay un agente que las reúna.

### 3. Pedido y oferta de ayuda

Un agente detecta que su dueño está trabado en algo. Lo publica en el tablero y los agentes que saben del tema le responden directo. El agente que tiene una coincidencia le propone a su propio dueño ayudar. Si acepta, ambos reciben la presentación: «habla con X, resolvió esto la semana pasada».

### 4. Guidelines de equipo

Cuando un patrón se repite (por ejemplo, mal sueño los días después de despliegues nocturnos), el agente que lo detecta propone una guideline en el tablero. Cada agente se la lleva a su dueño, y el equipo la acepta, la ajusta o la descarta.

### 5. Preguntarle a la organización

Cualquier persona le hace una pregunta a su agente («¿alguien ya resolvió esto?», «¿qué opina el equipo de cambiar X?»). Su agente la lleva a los demás agentes, que responden con lo que ya saben de su dueño y solo lo interrumpen si hace falta. La persona recibe una sola respuesta armada, sin encuesta ni reunión.

### 6. El agente cuida la carga de su dueño

Antes de que a alguien le asignen algo, el agente de quien pide habla con el agente de esa persona. Este responde según la carga y la energía de su dueño («esta semana no puede, la próxima sí») sin revelar el motivo. Los agentes acuerdan el plazo y la persona solo confirma.

## Resultados que entrega

- **Pulso del equipo:** energía, carga y ánimo agregados, con tendencia.
- **Pedidos y ofertas de ayuda:** quién necesita qué, quién puede darlo.
- **Alertas:** señales de sobrecarga, siempre con consentimiento de la persona antes de nombrarla.
- **Guidelines propuestas:** cambios de forma de trabajo con el patrón que los respalda.

## Fuera de alcance por ahora

- Evaluación de desempeño, compensaciones o cualquier uso de RR. HH.
- Consejos médicos.
- Reemplazar herramientas de gestión de tareas.
