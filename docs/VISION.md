# Visión

## El problema

En un equipo, saber cómo está cada persona es caro. Hoy depende de reuniones, de mensajes sueltos y de que alguien se anime a decir que necesita ayuda.

Lo que vivimos como equipo chico:

- La comunicación cuesta. Lo importante se pierde entre chats y reuniones.
- No sabemos cómo está el ánimo, el sueño ni la carga de cada uno.
- Coordinar gente es difícil: no sabemos quién está trabado ni en qué.
- No sabemos cuándo alguien necesita ayuda, ni quién del equipo podría darla.

En un equipo de 5 esto se parcha con una daily. En una empresa de 300 no hay daily posible: nadie puede escuchar a 300 personas, y los resúmenes que suben por la jerarquía llegan tarde y filtrados.

## La tesis: la complejidad crece más rápido que la gente

Para que todos sepan cómo están todos, cada persona tendría que conversar con cada una de las demás. El número de conversaciones uno a uno posibles es `n × (n − 1) / 2`:

| Personas | Conversaciones uno a uno |
|---:|---:|
| 5 | 10 |
| 10 | 45 |
| 50 | 1.225 |
| 150 | 11.175 |
| 300 | 44.850 |

La gente crece en línea recta; la comunicación crece al cuadrado. Pasar de 5 a 300 personas es multiplicar el equipo por 60 y las conversaciones por casi 4.500.

Ningún humano puede sostener eso. Por eso las empresas inventan jerarquías, reuniones y reportes: son formas de **perder información a propósito** para que la comunicación quepa en el día de una persona.

Un agente sí puede. Puede conversar con cientos de pares, todos los días, sin cansarse y sin perder contexto. **La complejidad de comunicación de una organización debería ser manejada por agentes**, y las personas deberían recibir solo las pocas conversaciones que de verdad necesitan tener.

## La idea

Cada persona tiene un **agente personal**. El agente conoce a su dueño: cómo durmió, cómo se siente, en qué trabaja, qué lo traba y en qué es bueno.

Los agentes **conversan entre sí** en lugar de que lo hagan las personas. De esas conversaciones sale lo que el equipo necesita:

- quién necesita ayuda y quién puede darla;
- cómo está el pulso del equipo (energía, carga, ánimo);
- qué guidelines o cambios de forma de trabajo conviene adoptar;
- qué debería saber cada líder, sin leer 300 reportes.

Es un multijugador de agentes personales: la coordinación ocurre entre agentes, y las personas reciben solo lo que les sirve para actuar.

## Principios

1. **El agente trabaja para su dueño, no para la empresa.** Si la persona no confía en su agente, no le cuenta nada y el sistema se queda sin señal.
2. **La persona decide qué se comparte.** Los datos crudos (sueño, ánimo, salud) nunca salen del agente sin permiso. Detalle en [PRIVACY.md](PRIVACY.md).
3. **Ayudar, no vigilar.** El sistema no es una herramienta de evaluación de desempeño. Su salida son ofertas de ayuda y mejoras de equipo, no rankings de personas.
4. **Cero trabajo extra.** El agente vive donde la persona ya está (WhatsApp) y saca la señal de fuentes que ya existen. Nadie llena formularios.
5. **Escala por niveles.** Lo que funciona para un equipo de 5 debe funcionar para 300 agregando niveles (equipo → área → empresa), no reuniones.
6. **Toda conclusión es trazable.** Cada recomendación de equipo indica de qué ronda y de cuántos agentes salió, sin exponer datos privados.

## Qué no es

- No es un tablero de vigilancia para jefes.
- No reemplaza la conversación entre personas: la provoca cuando hace falta («habla con X, sabe de esto»).
- No es un producto médico ni da diagnósticos de salud.
