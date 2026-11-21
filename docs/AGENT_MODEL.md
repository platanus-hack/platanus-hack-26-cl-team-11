# Modelo de agentes

Este documento define qué agentes existen y cómo conversan. No fija tecnología: la elección de stack está en [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## Un solo tipo de agente

Hay **un agente personal por persona** y ningún otro agente.

- Su dueño es esa persona.
- Tiene una **memoria privada**: check-ins, datos del wearable, actividad de trabajo, notas de reuniones.
- Tiene una **política de compartir** definida por su dueño ([PRIVACY.md](PRIVACY.md)).
- Habla con su dueño por WhatsApp.
- Habla con cualquier otro agente, de forma directa.

## Por qué no hay agente coordinador

Decisión del 21-nov-2026. Un coordinador al medio es una estructura de humanos: las jerarquías existen porque una persona no puede conversar con todas las demás. Un agente sí puede. Poner un agente coordinador sería reconstruir con agentes la misma jerarquía que la tesis de [VISION.md](VISION.md) dice que sobra.

Lo que hacía el coordinador lo cubren dos piezas que **no son agentes**: no interpretan, no deciden y no tienen memoria de nadie.

| Pieza | Qué hace |
|---|---|
| **Tablero compartido** | Lugar donde cualquier agente publica una pregunta, una necesidad o una propuesta, y los demás la leen. |
| **Función de agregado** | Cálculo que recibe las señales que cada agente autorizó y devuelve solo totales de grupo. Nunca devuelve una respuesta individual. |

## Cómo conversan

### Uno a uno, cuando hay motivo

Cualquier agente puede hablarle a cualquier otro. Que puedan hablar todos con todos no significa que lo hagan todos los días: en 300 personas serían 44.850 intercambios por vuelta. Un agente abre una conversación cuando tiene un motivo: su dueño necesita algo, tiene algo que ofrecer o hay una pregunta abierta en el tablero.

### Pedido y oferta de ayuda

1. **Pedido.** Un agente publica una necesidad en el tablero («busco a alguien con experiencia en X»), sin datos privados de su dueño.
2. **Respuesta.** Los agentes que tienen algo que aportar le responden directo. Uno puede responder «sabe del tema, pero esta semana no puede».
3. **Consulta.** El agente que puede ayudar le pregunta a su propio dueño si quiere hacerlo.
4. **Presentación.** Con el sí de ambos lados, los agentes presentan a las dos personas.

### Preguntas a todo el equipo

Cualquier persona, líder o no, le hace una pregunta a su agente. El agente la publica en el tablero y los demás responden con lo que su dueño permite. Quien preguntó recibe una sola respuesta armada.

### Pulso del equipo

Cada agente entrega a la función de agregado las señales que su dueño autorizó (energía, carga, bloqueos). La función devuelve el total del grupo. Nadie, ni agente ni persona, ve la respuesta de otro.

### Guidelines

El agente que detecta un patrón repetido publica una propuesta en el tablero. Cada agente se la lleva a su dueño, y las personas la aceptan, la ajustan o la descartan.

## Qué viaja en un mensaje entre agentes

| Campo | Para qué |
|---|---|
| Emisor y destinatario | Saber qué agente habla con cuál. |
| Tipo | Pregunta, respuesta, pedido de ayuda, oferta, presentación, propuesta. |
| Hilo | Agrupar la conversación y poder trazarla. |
| Contenido | Texto estructurado, ya filtrado por la política de compartir. |
| Nivel de consentimiento | Si el contenido fue aprobado por regla del dueño o por aprobación explícita. |
| Uso permitido | Si el agente que lo recibe puede contárselo a su dueño o solo usarlo para actuar. |

## Escalar a 300 personas

No hay árbol de coordinadores. La red es plana: un agente de un equipo le habla directo a uno de otro equipo.

- El tablero y la función de agregado se pueden consultar por grupo (un equipo, un área, toda la empresa). Son filtros sobre los mismos datos, no niveles de agentes.
- Un agregado se entrega solo si el grupo supera el tamaño mínimo ([PRIVACY.md](PRIVACY.md)).
- Los pedidos de ayuda cruzan equipos sin que nadie los reenvíe.

## Reglas de comportamiento

- Un agente nunca habla por su dueño más allá de lo que este permitió.
- Un agente representa a su dueño y a nadie más. Nunca cede sus intereses ante la insistencia de otro agente; si no puede aceptar algo, lo rechaza o le pregunta a su dueño.
- Lo que un agente aprende de otro lo usa para actuar. Solo se lo cuenta a su dueño si el mensaje lo permite.
- Un agente no inventa datos. Si no tiene señal, responde «sin datos».
- La interpretación de lenguaje natural la hace siempre el modelo con salida estructurada, no reglas de palabras clave.
- Cada agregado registra de cuántos agentes salió.
