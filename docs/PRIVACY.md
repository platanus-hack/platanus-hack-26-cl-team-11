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
