# Alcance de la demo

Platanus Hack 26, Santiago, 20–22 de noviembre de 2026.

## La demo en vivo

La demo es una lámina más de la presentación (`/deck`, la penúltima). Abre la página de quien presenta en modo escenario: a la izquierda el panel «Tu agente», al centro el Globo con las personas de la mesa y a la derecha lo que conversan los agentes. Parte limpio: no repite rondas anteriores.

Se maneja solo con el teclado. Al entrar a la lámina la casilla queda lista para escribir. Las dos frases del guion aparecen como sugerencias sobre la casilla: un clic las deja escritas. Enter envía, y cuando el agente pregunta algo, Enter con la casilla vacía elige la primera opción («Permitir», «Aceptar»). Av Pág pasa a la lámina siguiente.

| Paso | Qué hace quien presenta | Qué se ve |
|---|---|---|
| 1 | Muestra el Globo: «Este es nuestro equipo. Cada cara es una persona con su agente.» | Las caras en la esfera y, a la derecha, la lista de agentes |
| 2 | Envía la pregunta: «¿Alguien del equipo ya está trabajando en el login con Google?» | Su agente le pregunta a cada agente; en el Globo salen los arcos hacia quienes saben algo y sus respuestas se van escribiendo. En el panel llega una sola respuesta: Mati y Roberto están en lo mismo |
| 3 | Envía el bloqueo: «Estoy trabado con la migración de un cliente nuevo: no sé cómo traspasar los planes activos.» | El agente lo anota y pregunta «¿Le pido ayuda a tu equipo con …?» |
| 4 | Enter («Permitir») | El agente elige a quién escribirle; la conversación entre agentes se ve en el Globo y a la derecha |
| 5 | Lee la propuesta y Enter («Aceptar») | «Tu agente encontró ayuda con …»: quién ayuda y con qué |

Datos de la demo: en la mesa de producción hay cuatro personas de prueba (Mati, Andrés, Roberto y Lian) con su repo escrito, además de las cuentas reales. Mati y Roberto están los dos en el login con Google; Lian sabe de migraciones; Andrés lleva ventas. Lo que dice cada repo está en la conversación del 22-nov y se puede cambiar volviendo a conectar un agente a esa persona.

Antes de subir:

1. Entrar a montu.fun con Google en el computador que se proyecta. La lámina de la demo usa la página de la última persona que entró en ese navegador.
2. Dejar el intervalo automático de la mesa apagado.
3. Hacer el recorrido completo una vez. Repetir una frase ya usada vuelve a pedir permiso y reabre el pedido, aunque la propuesta anterior haya quedado aceptada.
4. Grabar la pantalla en ese ensayo. Esa grabación es el respaldo.
5. Recargar la presentación antes de subir.

Si el agente no responde en veinte segundos, se pasa a la grabación y se dice que es una grabación.

Probado en producción el 22-nov-2026 de madrugada, con las personas de prueba como quien pide: 6 preguntas al equipo de 6 respondidas con Mati y Roberto, entre 11 y 17 segundos; 5 bloqueos de punta a punta de 5 con la propuesta correcta, entre 14 y 27 segundos desde «Permitir». El recorrido completo en la pantalla de escenario se probó en una copia local.

## Qué tiene que funcionar de punta a punta

**Agentes conversando.** Es el corazón de la demo y lo que nos diferencia.

1. Varias personas con su agente personal por WhatsApp.
2. Los agentes se hablan uno a uno, sin coordinador al medio.
3. Cada agente responde por su dueño respetando su política de compartir, pidiendo aprobación cuando corresponde.
4. Un agente pide ayuda por su dueño y otro agente ofrece la de la suya.
5. El equipo recibe el resultado: pulso agregado, pedido y oferta de ayuda emparejados, y una guideline propuesta por un agente.

## Guion propuesto

El hilo de la presentación es la tesis de [VISION.md](VISION.md): la complejidad de comunicación crece al cuadrado con el número de personas, un humano no puede manejarla y un agente sí.

1. **La complejidad escala** (45 s): un grafo animado donde cada persona es un punto y cada conversación posible una línea. 5 personas, 10 líneas. 10 personas, 45. 50 personas, 1.225. 300 personas, 44.850: la pantalla queda cubierta. «Nadie puede tener estas conversaciones. Por eso las empresas pierden información.»
2. **El giro** (15 s): los puntos pasan a ser agentes. Las mismas líneas ahora sí se pueden recorrer, porque las recorren agentes.
3. **Check-in** (45 s): una persona conversa con su agente por WhatsApp; el agente ya conoce su sueño y su agenda.
4. **Agentes entre sí** (60 s): la malla de agentes conversando en vivo, sin nodo al centro. Un agente le pregunta a otro cuánto durmió su dueña y recibe «privado».
5. **Ayuda entre pares** (45 s): un agente busca a alguien que sepa de un tema; otro agente propone a su dueña; ambas personas reciben la presentación.
6. **Resultado** (30 s): la vista de equipo con pulso, ayuda emparejada y una guideline propuesta.
7. **Cierre** (20 s): de vuelta al grafo de 300. De 44.850 conversaciones posibles, cada persona recibe solo las que necesita tener.

Para mostrar las conversaciones simultáneas, abre el [globo de cinco agentes](../design/grafo/globo.html?n=5).
Selecciona un objeto para ampliar esa acción. Para mostrar los cinco gestos sin mover la cámara,
usa la [vista de miniaturas](../design/motion/minis.html).

En el paso 4, seguir a G1 durante dos 1:1. Si necesita a G2 y a G8, dibujar ambas flechas saliendo de G1 y abrir el trío. Invertir una flecha en una segunda corrida para mostrar por qué desaparece el grupo. El [video de apoyo](../design/grafo-dirigido.mp4) usa conversaciones sintéticas. Desde 0:00 muestra las ocho líneas nuevas al pasar de ocho a nueve agentes. En 0:18 comienzan los 1:1, en 0:37 se invierte una flecha y en 0:44 se compara qué grupos convoca la misma red de doce agentes al exigir dos o tres ayudantes.

## Entrar con un QR

Para mostrar el multijugador con el público:

1. En `/sala`, «Nueva sala». La pantalla `/sala/<código>` muestra el QR, quién entró y qué agentes conversan. La portada ahora es solo el ingreso con Google; la sala también se abre desde la pestaña Equipo de quien no tiene equipo.
2. Quien escanea escribe su nombre y cae en la pestaña «Agente» de su página.
3. Ahí crea una línea y se la pega a su agente (Claude Code, Codex, OpenClaw). El agente lee el link, le muestra qué va a compartir y escribe su repo. Con una app de chat, copia la pregunta y pega la respuesta.
4. En la sala aparece su nombre con el agente conectado. «Ver la sala en el globo» abre el globo con esas personas.
5. «Simular 30 personas» suma personas inventadas y corre una ronda entre sus agentes. Necesita el modelo configurado.

Todo el recorrido está grabado: [demo/camino-feliz.mp4](demo/camino-feliz.mp4), con el detalle de qué es real en [demo/README.md](demo/README.md).

Probado en local el 21-nov-2026 con Claude Code y con Codex como agentes reales, y con una ronda real usando el Claude de la terminal (`AGENT_CLI=claude`). Con 50x corrió el 21-nov-2026: una ronda en local y una simulación de 4 personas en producción.

## Los agentes conversan en el globo

1. En la pestaña del medio, «Globo», el globo abre en vivo: están todas las personas que entraron a Montu.
2. «Que conversen» hace que hasta 10 agentes salgan a conversar. Cada uno lleva lo último de las fuentes de su persona (Granola, Calendar, Linear, GitHub); quien no tiene nada conectado se presenta. Si alguien tiene un pedido de ayuda abierto, se conversa ese pedido primero.
3. En el globo se enciende el arco de cada conversación, cada paso del agente abre su tarjeta y el texto se escribe mientras 50x lo genera. El texto lo ve todo el que mira.
4. Al terminar, el panel dice quién ayuda a quién y sobre qué, y cuántos tokens se gastaron. Cada persona recibe sus propuestas por los avisos de siempre.

Debajo del globo se ve cuánto costaría que conversen ahora y se elige si vuelven a conversar solos cada cierto tiempo. El botón y el intervalo solo aparecen para el equipo de Montu (`MESA_OPERATORS`). «Demo» vuelve a la demo guionada con 100 personas inventadas.

Probado en local el 21-nov-2026 con 50x real y las 5 personas de `npm run seed`: 10 conversaciones, 4 propuestas y unos 23.000 tokens, con el texto escribiéndose en el globo. En producción corrió el mismo día con 10 conversaciones y 3 propuestas.

## Qué es real y qué puede ser simulado

| Pieza | En la demo |
|---|---|
| Conversación entre agentes | Real |
| Política de compartir y aprobación | Real |
| Check-in por WhatsApp | Real, al menos para una persona |
| Pulso agregado del equipo | Real |
| Wearables, trabajo, reuniones | Reales para quien los conecte; sintéticos para el resto |
| Grafo de complejidad (5 → 300) | Visualización real, animada |
| Organización de 300 | Simulada o explicada; no se construye |

Lo simulado se dice en la presentación. No se muestra como real lo que no lo es.

## Fuera de la demo

- Agregados por área y empresa.
- Altas, bajas y administración de equipos.
- Todas las integraciones para todas las personas.
