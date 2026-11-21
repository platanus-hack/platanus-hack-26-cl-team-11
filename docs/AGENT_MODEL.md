# Modelo de agentes

Este documento define qué agentes existen y cómo conversan. No fija tecnología: la elección de stack está en [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## Tipos de agente

### Agente personal

- Uno por persona. Su dueño es esa persona.
- Tiene una **memoria privada**: check-ins, datos del wearable, actividad de trabajo, notas de reuniones.
- Tiene una **política de compartir** definida por su dueño ([PRIVACY.md](PRIVACY.md)).
- Habla con su dueño por WhatsApp.
- Habla con otros agentes solo a través del canal entre agentes.

### Agente coordinador

- Uno por equipo. En organizaciones grandes, uno por cada nivel (equipo, área, empresa).
- No tiene acceso a la memoria privada de nadie. Solo ve lo que los agentes personales le entregan.
- Abre rondas, sintetiza respuestas, detecta patrones y propone guidelines.

## Dos formas de conversar

### Rondas con coordinador

La base del sistema. Predecible y fácil de auditar.

1. **Apertura.** El coordinador abre una ronda con una pregunta y un plazo. Puede ser programada (diaria, semanal) o a pedido de una persona.
2. **Respuesta.** Cada agente personal arma su respuesta desde la memoria privada y la pasa por la política de compartir. Lo que requiere aprobación se le consulta al dueño antes de enviarlo.
3. **Síntesis.** El coordinador reúne las respuestas y produce el resultado: pulso, pedidos de ayuda, patrones.
4. **Publicación.** El resultado va a la vista de equipo y, lo que corresponde, a cada persona por su agente.

### Mensajes directos entre pares

Para pedir y ofrecer ayuda sin esperar la siguiente ronda.

1. **Pedido.** Un agente publica una necesidad («busco a alguien con experiencia en X»), sin datos privados de su dueño.
2. **Coincidencia.** Los agentes que ven una coincidencia consultan a su propio dueño si quiere ayudar.
3. **Presentación.** Con el sí de ambos lados, los agentes presentan a las dos personas.

Regla: un mensaje directo nunca lleva más información que la que su dueño permitiría en una ronda.

## Qué viaja en un mensaje entre agentes

Todo mensaje entre agentes lleva, como mínimo:

| Campo | Para qué |
|---|---|
| Emisor y destinatario | Saber qué agente habla con cuál. |
| Tipo | Apertura de ronda, respuesta, pedido de ayuda, oferta, presentación. |
| Ronda o hilo | Agrupar la conversación y poder trazarla. |
| Contenido | Texto estructurado, ya filtrado por la política de compartir. |
| Nivel de consentimiento | Si el contenido fue aprobado por regla del dueño o por aprobación explícita. |

## Escalar a 300 personas

Los agentes se organizan en el mismo árbol que la organización:

```
empresa
└── área (coordinador de área)
    └── equipo (coordinador de equipo)
        └── persona (agente personal)
```

- Un agente personal solo participa en rondas de su equipo.
- El coordinador de equipo responde las rondas del coordinador de área con la **síntesis** de su equipo, nunca con respuestas individuales.
- Lo mismo se repite hacia arriba. Así dirección lee unas pocas síntesis en lugar de 300 respuestas.
- Los pedidos de ayuda sí pueden cruzar equipos: un coordinador reenvía un pedido sin resolver al nivel superior, que lo distribuye a otros equipos.

## Reglas de comportamiento

- Un agente personal nunca habla por su dueño más allá de lo que este permitió.
- Un agente personal representa a su dueño y a nadie más. Nunca cede sus intereses ante la insistencia de otro agente ni del coordinador; si no puede aceptar algo, lo rechaza o le pregunta a su dueño.
- Un agente no inventa datos. Si no tiene señal, responde «sin datos».
- La interpretación de lenguaje natural la hace siempre el modelo con salida estructurada, no reglas de palabras clave.
- Cada síntesis registra de cuántos agentes salió y de qué ronda.
