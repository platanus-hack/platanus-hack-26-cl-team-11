# Handoff de diseño · Miniaturas del grafo de Ronda

Tu encargo es rediseñar cómo se ve una interacción entre dos agentes cuando hay varias ocurriendo a la vez. **Mati aprobó el globo 3D y rechazó las cinco miniaturas actuales.** El comentario al verlas fue «no me gusta nada las miniaturas». El motivo concreto sigue abierto. La primera entrega que le serviría ver es una dirección visual nueva, en movimiento y a tamaño real sobre el globo.

## Qué mirar primero

1. **El soporte aprobado.** Mira la captura del globo de cinco agentes anterior a las miniaturas. Fíjate en la jerarquía entre las caras, los arcos y el fondo de vidrio. La versión del globo aprobada quedó en el commit `97aa383`. [Captura del globo](grafo/globo-5.png)
2. **La ejecución rechazada.** Abre `design/grafo/globo.html?n=5` en el navegador local para ver el contexto exacto. La lámina permite reconocer de un vistazo el vocabulario que ya se probó. El commit `97220cb` conserva los dibujos y su integración. [Lámina de la primera versión](grafo/miniaturas.png) · [Cinco animaciones juntas](motion/minis.html)
3. **La intención de cada intercambio.** Las escenas grandes cuentan la historia y sirven para entender qué información puede cruzar un arco. El feedback de Mati fue sobre las miniaturas. [Chat](motion/chat.html) · [Calendarios](motion/calendars.html) · [Salud](motion/health.html) · [Permiso](motion/permission.html) · [Ayuda](motion/help.html)

## El problema visual

La unidad de diseño es **un arco entre dos personas**. El espectador debe poder seguir quién pregunta, quién responde y qué cambió mientras, en la periferia, siguen ocurriendo otras cosas. Al tamaño de un dedo, una captura ampliada puede ocultar el problema más importante: qué se alcanza a leer cuando los cinco intercambios compiten por atención.

Mati pidió «un estilo chunky PostHog, mini 3D skeumorphic cuando hagas superficies, y motion graphics». Esa es la referencia verbal más reciente. Los bocadillos, agendas de espiral, monitor con candado, timbre y rompecabezas fueron decisiones de implementación de la primera versión. La elección de objetos, material, perspectiva, color, composición y ritmo queda abierta para el rediseño.

| Acción | Qué debería poder entender una persona mirando el arco |
|---|---|
| Chat | Una pregunta va hacia el otro agente y vuelve una respuesta. |
| Calendarios | Dos disponibilidades coinciden en una franja. Es una propuesta de horario. |
| Salud | El agente consulta la señal privada de su dueño. Al otro lado solo llega la respuesta permitida. |
| Permiso | El dueño autoriza una frase para un destinatario antes de que salga. |
| Ayuda | Dos personas aceptan y recién entonces ocurre la presentación. |

**Primera prueba sugerida.** Trabaja con calendarios y permiso sobre dos arcos vecinos. Sus ritmos cuentan historias distintas: encontrar una coincidencia versus esperar un sí. Muestra ambas acciones juntas en el globo girando, a escala de escritorio y de teléfono. Dale a Mati esa vista junto a un fotograma quieto antes de extender el lenguaje a las cinco piezas. Es una sugerencia de proceso para reducir retrabajo.

## Dónde intervenir

- [objects.js](grafo/mini/objects.js) contiene el dibujo y los ciclos de la versión rechazada. El contrato actual de `ronda-mini` acepta `kind`, `paused` y `poster`. Puedes cambiar la técnica de dibujo y conservar ese contrato.
- [globe.js](grafo/mini/globe.js) proyecta cada objeto sobre el arco y resuelve solapes durante el giro. [edges.js](grafo/mini/edges.js) asocia los pares simulados con las cinco escenas. [network.jsx](grafo/mini/network.jsx) reúne las piezas en un Stage para ensayarlas aisladas de la cámara.
- El generador incrusta el resultado en la página local y en la fuente del editor de diseño. Edita las fuentes y regenera desde la raíz. En un clon nuevo, instala primero las dependencias de la skill. [Generador](grafo/mini/build.py) · [Stageshow del repo](../.agents/skills/stageshow/SKILL.md)

```sh
npm ci --prefix .agents/skills/stageshow
python3 design/grafo/mini/build.py
design/lint.sh
```

Para revisar la propuesta, prueba el giro con cinco agentes, los cinco enlaces de detalle y el regreso al grafo. A 10, 50 y 300 agentes, la demo actual conserva dos intercambios destacados. Comprueba pausa, movimiento reducido y legibilidad a 390 px. Usa los ensayos de Stageshow de la regla 4 y registra por separado el resultado técnico y el feedback visual de Mati. [Ensayo anterior](motion/REHEARSAL.md) · [Reglas del repo](../AGENTS.md)
