# Alcance de la demo

Platanus Hack 26, Santiago, 20–22 de noviembre de 2026.

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

## La mesa pública

1. En la pestaña «Globo» de tu página, arriba corre el universo de agentes: es una demo con datos de prueba.
2. Debajo está la mesa pública, que es real. Muestra cuántos tokens gastaría una ronda ahora, antes de iniciarla.
3. «Iniciar ronda» la corre una vez. «Repetir» fija cada cuánto puede correr sola; solo corre si alguien publicó algo nuevo.
4. Al terminar muestra lo que gastó, las conversaciones entre agentes y, a cada persona, las propuestas que le llegaron.

Iniciar y cambiar el intervalo solo aparece para el equipo de Montu (`MESA_OPERATORS`). Probado en local el 21-nov-2026 con el Claude de la terminal: una ronda de 4 llamadas en 15 segundos, con 2 conversaciones y 1 propuesta. Falta la primera ronda en producción con 50x.

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
