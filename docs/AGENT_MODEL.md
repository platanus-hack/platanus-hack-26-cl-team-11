# Modelo de agentes

Este documento define qué agentes existen y cómo conversan. No fija tecnología: la elección de stack está en [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## Un solo tipo de agente

Hay **un agente personal por persona** y ningún otro agente.

- Su dueño es esa persona.
- Tiene una **memoria privada**: check-ins, datos del wearable, actividad de trabajo, notas de reuniones.
- Tiene una **política de compartir** definida por su dueño ([PRIVACY.md](PRIVACY.md)).
- Habla con su dueño por WhatsApp.
- Habla con cualquier otro agente, de forma directa.

## Agente personal y asistentes conectados

Decisión del 21-nov-2026. El agente personal corre en el servidor de Ronda. Los agentes que la persona ya usa (Claude Code, Codex, ChatGPT, Grok, OpenClaw y otros) entran como **asistentes conectados**.

| | Agente personal | Asistente conectado |
|---|---|---|
| Dónde corre | En Ronda, siempre disponible | Donde la persona lo usa, solo mientras lo tiene abierto |
| Qué hace | Habla con los agentes de los demás | Escribe y ordena el repo de su persona |
| Qué sabe | Las señales y el repo de su persona | Lo que la persona ya le cuenta |

Ningún servidor puede despertar al agente de otra persona: Claude Code o ChatGPT actúan solo mientras su dueño los tiene abiertos. Por eso la voz en una ronda es el agente personal, y el asistente es quien le da contexto. Así la ronda funciona con el computador cerrado y se puede simular una organización completa.

Cómo entra un asistente, el repo y sus permisos: [ARCHITECTURE.md](ARCHITECTURE.md#sala-asistentes-y-repo).

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

### Del 1:1 al grupo de ayuda

**Turno 1.** Cada par que conversa puede descubrir una necesidad en cualquiera de los dos sentidos. Se guarda `G1 → G2` únicamente si del diálogo se desprende que G1 necesita ayuda de G2. La punta señala a quien puede ayudar, incluso si G2 inició el diálogo. Si la necesidad es mutua, se guardan dos flechas. Si nadie necesita ayuda del otro, el par aporta cero flechas. El resultado depende de lo que ocurra en la conversación. En una simulación exhaustiva de 100 agentes se pueden recorrer los 4.950 pares.

**Turno 2.** Para cada solicitante, toma los destinatarios distintos de sus flechas salientes en esa ronda. Con un mínimo de dos ayudantes, cada combinación de dos destinatarios forma un trío con el solicitante. Los ayudantes pueden participar aunque entre ellos no haya surgido una dependencia. En la variante con umbral configurable, se eligen exactamente `k` ayudantes por candidato. Con `d` destinatarios hay `C(d, k)` candidatos y cada grupo tiene `k + 1` agentes. Si `d < k`, ese solicitante sigue con sus 1:1. Una vez fijados el grafo y el umbral, la lista de grupos es reproducible.

| Dependencias descubiertas | Mínimo de ayudantes | Grupos del turno 2 |
|---|---:|---|
| G1 → G2, G1 → G8 | 2 | {G1, G2, G8}. G1 lleva el pedido. |
| G1 → G2, G8 → G1 | 2 | Ninguno. G1 y G8 tienen una salida cada uno. |
| G1 → G2, G8 y G9, y G4 → G5 y G6 | 2 | Tres tríos por G1 y un cuarto por G4. |
| Las mismas flechas de la fila anterior | 3 | Solo {G1, G2, G8, G9}. |
| G1 y G2 se necesitan mutuamente y ambos necesitan a G8 | 2 | Un solo {G1, G2, G8}, con las agendas de G1 y G2. |

Para deduplicar, identifica el grupo por su conjunto de miembros dentro de la ronda y conserva los pedidos de cada solicitante. Cada pedido mantiene la referencia al 1:1 que lo originó. Antes de llevar contenido del 1:1 al grupo, cada agente aplica los permisos para esa audiencia. La presentación entre personas sigue requiriendo su aceptación. El umbral de ayudantes regula la convocatoria y el mínimo de privacidad de un agregado regula la publicación del pulso.

[Ver cómo una conversación da origen a una flecha y cómo se forma un grupo · 1 min 10 s](../design/grafo-dirigido.mp4).

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
