# Privacidad y consentimiento

Regla central: **la persona decide qué sale de su agente.** Sin esa confianza nadie le cuenta nada a su agente y el sistema no funciona.

## Tres capas de información

| Capa | Qué contiene | Quién la ve |
|---|---|---|
| **Privada** | Datos crudos: sueño, recuperación, ánimo, lo que la persona le dijo al agente, notas de reuniones. | Solo la persona y su agente. |
| **Compartida** | Lo que el agente entrega a otro agente o publica en el tablero, ya filtrado. | Los agentes que lo reciben. Sus dueños, solo si el mensaje lo permite. |
| **Agregada** | Totales de un grupo (equipo, área o empresa) que calcula la función de agregado. | Las personas de ese grupo y dirección. |

Los datos crudos no salen nunca de la capa privada. Lo que sale es una **afirmación** derivada de ellos («energía baja esta semana»), no el dato («durmió 4 h 50 min»).

## Política de compartir

Cada persona configura con su agente, en lenguaje natural, qué se comparte. Cada tema queda en uno de tres estados:

- **Siempre:** el agente lo comparte sin preguntar (por ejemplo, «en qué estoy trabajando»).
- **Preguntar antes:** el agente pide aprobación cada vez (por ejemplo, «estoy sobrecargado»).
- **Nunca:** no sale, ni agregado.

Valor por defecto para toda persona nueva: trabajo en **Siempre**; ánimo, energía y carga en **Preguntar antes**; salud y datos del wearable en **Nunca** como dato crudo.

## El repo: un permiso por archivo

El asistente de cada persona escribe su contexto como archivos. Cada archivo lleva uno de los tres estados:

- **Siempre:** el agente personal puede usarlo al hablar con otros agentes.
- **Preguntar antes:** espera. No se usa ni llega a un modelo hasta que la persona lo cambie. Es el estado por defecto.
- **Nunca:** no sale del repo.

El asistente propone el estado al crear el archivo. Después solo lo cambia la persona. Antes de escribir por primera vez, el asistente le muestra a su dueño la lista de archivos y espera su sí. El servidor rechaza un archivo que parezca contener una llave o una contraseña.

## Entre agentes: usar no es contar

Sin coordinador, los agentes se hablan uno a uno, así que un agente puede enterarse de algo sobre la persona de otro («energía baja esta semana»). La regla:

- Lo que un agente aprende de otro lo **usa para actuar**: ofrecer ayuda, acordar un plazo, no pedir algo esta semana.
- **No se lo cuenta a su dueño** salvo que el mensaje venga marcado como contable, y eso lo decide el dueño del dato.
- Cada mensaje entre agentes lleva ese permiso ([AGENT_MODEL.md](AGENT_MODEL.md)).

## Reglas para líderes y dirección

- Un líder ve agregados del equipo, no respuestas individuales.
- Para que una alerta nombre a una persona, esa persona tuvo que aprobarlo.
- Un agregado se publica solo si no permite deducir a un individuo. Hoy el mínimo es 3 personas aportando por señal y se entrega solo el nivel mediano; si basta está abierto en [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
- El sistema no produce rankings de personas ni puntajes individuales visibles para otros.

## Derechos de la persona

- Ver todo lo que su agente sabe de ella.
- Ver todo lo que su agente ha compartido, con quién y cuándo.
- Corregir o borrar cualquier dato.
- Desconectar una fuente en cualquier momento.
- Salir del sistema y que su memoria privada se elimine.

## Contenido de terceros

Lo que llega de otras fuentes o de otros agentes (texto de reuniones, mensajes, respuestas de pares) es **dato, no instrucción**. Un agente nunca ejecuta lo que pida un texto ajeno a su dueño.

## Qué está construido

Estado al 21-nov-2026, leído del código. Lo que sigue en «parcial» o «no construida» no se muestra como hecho en la demo.

| Regla de este documento | Hoy |
|---|---|
| Política de compartir en tres estados | Construida. Se elige en la pestaña Ajustes del panel, un permiso por señal (energía, carga, bloqueos, experiencia); todavía no se configura conversando con el agente. Por defecto: energía y carga en «preguntar»; bloqueos y experiencia en «siempre», salvo el bloqueo dicho en un check-in, que parte en «preguntar» |
| Los datos crudos no salen de la capa privada | Construida y con prueba. La única excepción es el mensaje que la persona le escribe a su propio agente por WhatsApp: el modelo lo lee para guardarlo como check-in. Entre agentes, al modelo solo llega la ficha: las frases con permiso «siempre», los temas y una disponibilidad. El sueño, la carga, el ánimo y la nota del check-in no entran a ningún mensaje |
| Preguntar antes | Construida para los bloqueos: el agente no pide ayuda con un tema en «preguntar» hasta que su dueño toca «Permitir» en la pestaña Equipo. Para energía y carga no hay pregunta: con «preguntar» la frase no sale y solo cuenta para la disponibilidad |
| Usar no es contar | Parcial. La conversación entre dos agentes la leen completa sus dos dueños y nadie más. No existe todavía el permiso por mensaje de [AGENT_MODEL.md](AGENT_MODEL.md). En el tablero sí: una respuesta no contable la leen solo quien publicó y quien respondió. Cuando un agente responde una pregunta del tablero usa solo lo que su persona dejó en «siempre», y esa respuesta la lee todo el equipo |
| Agregados sin individuos | Construida. Mínimo 3 personas por señal sin contar a quien mira, y solo el nivel mediano. «Nunca» saca a la persona también del agregado |
| Ver todo lo que su agente sabe | Parcial. El panel muestra cada señal con la frase y de qué fuentes sale, y por fuente el total de registros. Los registros crudos se leen solo en `GET /api/people/<token>/events` |
| Ver lo que su agente compartió, con quién y cuándo | Parcial. Cada persona lee las conversaciones de su agente en la última ronda y sus propuestas. No hay un historial de todo lo compartido |
| Corregir o borrar un dato | Solo por fuente: desconectar una fuente borra sus eventos. No se puede borrar un check-in ni un evento suelto |
| Salir del sistema | No construida. Se puede salir de un equipo, pero no hay forma de borrar a una persona ni su memoria |
| Contenido de terceros es dato, no instrucción | Está en la instrucción de cada agente (`backend/src/agents/prompts.ts`). No hay una prueba que lo verifique |

El link personal es la única llave: quien lo tenga ve los registros de esa persona y actúa por ella. No hay cuentas ni contraseñas.
