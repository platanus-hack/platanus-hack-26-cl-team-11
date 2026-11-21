# Ensayo · Resumen (bento con el globo al centro)

Página: `resumen.html`, filmada con `film.mjs --gate` el 21-nov-2026. Dos escenas (`.ss-stage`), las dos tarjetas completas:

1. «Conversaciones entre agentes»: el globo aprobado, incrustado (`../grafo/globo.html?embed`);
2. «Llegó a ti»: tres avisos y una sola decisión.

- **Gold de partida:** `bento` (un héroe, una ventana, un dato, un objeto), `subscriptions` (un total que rueda cuando el sistema hace algo) y `payout-flow` (coreografía sin cursor).
- **Beats:**
  1. Entran las cinco tarjetas, una tras otra. El globo ya está conversando: tu grupo (Tú, Ian, Lian) negocia a color.
  2. Cada pocos segundos un grupo llega a acuerdo: sus hilos se recogen, aparece «Listo» y renace con otras personas. El total rueda (solo el dígito que cambió) y abajo ruedan el tema y quiénes lo cerraron.
  3. No se detiene: los tres grupos recorren doce temas en vuelta. Se puede pausar, adelantar al próximo acuerdo o apurar a 2× y 4×; el globo se gira arrastrándolo, también en pausa.
  4. «Aceptar» cierra tu decisión: la tarjeta queda como registro y tu grupo en el globo recoge sus hilos, dice «Listo» y abre el tema siguiente. «Ajustar» pide otra opción a los agentes y la trae en su lugar.
- **Capturado:** 1440 px y 390 px (12 cuadros cada 700 ms), una pasada a cámara lenta (`--slow 4`) y movimiento reducido (`--reduced --still`) en los dos anchos.
- **Gate:** `rehearsal passed` en las cinco corridas. En quieto la cobertura es completa.
- **Film → arreglo** (cada línea que imprimió el filmador):
  - `uneven gutters` (tarjeta de decisión y fila de la lista): la decisión estaba a media tarjeta, con 25 px a los lados y 264 px abajo. Ahora cierra la tarjeta, con el mismo margen a los lados y abajo; los avisos resueltos van arriba y su divisor ya no es un borde de fila.
  - `framing` (decisión a 11 px del borde): se probó ensancharla; quedaba ni con margen completo ni a sangre. Volvió al margen completo.
  - `clipped glyph` y `clipped` (caras): aparecieron con una copia propia de las caras. La página pasó a montar la pieza única (`RondaCaras`, `faces/caras.js`) y las líneas no volvieron.
  - `uneven padding` (tarjeta de decisión): el halo de las caras que negocian sobresale de su fila y quedaba a 8 px del borde de arriba, contra 16 px a los lados. La tarjeta lleva más aire arriba.
  - `touching` (un número vivo dentro de una frase): «de 46 conversaciones» pasó a «avisos esta semana». El número que cambia vive solo en el globo.
  - `jump` de 23 px y `lands on a transform` (el total): eran dos textos fundiéndose con desenfoque. Ahora el número rueda dígito a dígito y los textos ruedan como un tambor, sin desenfoque (`Count` y `Roll` de Stageshow, sin React).
  - `handoff shift` (el check del último acuerdo se volvía a crear en cada cambio): la marca queda montada y cambia una sola vez, de punto «en línea» a check.
  - `jump` de 760 px (la tira de dígitos volviendo a su decena): cada dígito pasó a ser un tambor de dos figuras; ya no hay tira.
- **Movimiento, a mano:** a velocidad real el filmador muestrea cada 90 a 110 ms y marca como `jump` el primer cuadro de cada rodada (13 px en los textos, 55 px en un dígito de 76 px). En la pasada `--slow 4` esas líneas no aparecen: la rodada es continua.
- **Probado con Playwright** (estado, textos y cifras): pausa (el total no cambia en 7 s), adelantar (suma en menos de 2 s, también en pausa), 4× (10 conversaciones en 8 s contra 3 a 1×), «Ajustar», «Aceptar», filtro y fila compacta de «Tú y tu equipo», día del pulso y enlaces al mapa. Abierta desde el disco funciona igual.
- **Supuestos:** las cifras son de prueba. El equipo es de 10 personas; «Equipo» es la mediana y nadie ve el dato de otra persona (`docs/PRIVACY.md`). Hoy es sábado 21: el domingo va sin datos.
- **No revisado:**
  - el filmador marca la cobertura como `inconclusive` a velocidad real (la página dibuja WebGL y un lienzo grande, y la cámara alcanza unos 10 cuadros por segundo);
  - lo que pasa dentro del globo: es un lienzo en un `iframe` y el filmador no ve su interior. Se miró en capturas;
  - el movimiento propio de las caras (parpadeo, mirada, salto de «lista») y la línea `translucent icon` sobre sus ojos: es la pieza aprobada de `faces/caras.js`, sin cambios. Esa línea no cuenta para el gate;
  - sin WebGL2 (así corre el filmador por defecto) la lava queda quieta; con WebGL2 se filmó pasando `CHROME_PATH` a un Chrome con `--use-angle=metal`;
  - en teléfono los nombres de los costados del globo se desvanecen en el borde; la versión de teléfono del globo sigue abierta en `DESIGN.md`;
  - toque real en teléfono y Safari;
  - `mapa.html`, `conexiones.html` y `superficies.html` no cambiaron en esta ronda.
