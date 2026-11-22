# Ensayo · Presentación (design/pitch/)

Siete láminas para el pitch de 3 minutos, filmadas con `film.mjs --gate` a 1440 px el 21-nov-2026. Solo escritorio: Mati pidió que no hace falta verla en teléfono (las reglas de teléfono que hay en `pitch.css` no se revisaron después).

- **Gold de partida:** `bento` (tarjetas de vidrio y un dato), `subscriptions` (un total que rueda) y `payout-flow` (llegadas sin cursor). El look es el de `contexto/resumen.html`: `rd-*`, `cx-r`, caras de `RondaCaras`, el globo con `?embed` y la esfera de `montu/entrada.js`.
- **Escenas (`.ss-stage`) y beats:**
  1. Portada: la esfera de puntos se junta y las caras del equipo aparecen mirándote.
  2. «Alinear a un equipo es difícil» → «Hoy todos trabajan con su agente» (aparecen los íconos de cada agente y laten las caras) → «Pero los agentes no se hablan» (las caras se apagan y «0 conversaciones» rueda). Cada tarjeta es su propia escena.
  3. Los seis orígenes de contexto se encienden uno a uno, la cara late con cada uno y queda en «lista»; vuelve a empezar.
  4. El número de personas y de conversaciones rueda de 5 a 300 mientras crecen las barras; mantiene 300 y vuelve a 5.
  5. El globo del equipo conversa sin parar; cada acuerdo suma al total y rueda el tema.
  6. Una decisión: «Permitir» o «Ahora no».
- **Gate:** `rehearsal passed` en las láminas 1 a 6 (la 7 es quieta).
- **Film → arreglo:**
  - `framing` y `uneven gutters` en la decisión y en las tarjetas: la escena era toda la grilla medida contra la página. Cada tarjeta pasó a ser su escena; la decisión va dentro de una tarjeta de vidrio, como en el Resumen.
  - `appears with no entrance` (un dígito nuevo del contador): el dígito que se agrega entra rodando.
  - `steps in its box` (botones y textos): venía de la entrada de lámina con `translateY`. La lámina ahora solo funde.
  - `lands on a transform` (íconos de contexto): `will-change: transform`.
- **Controles:** ← → espacio y clic; N notas; F pantalla completa; V grabación de respaldo (`camino-feliz.mp4`); `?s=` y `&k=`. Pausa, adelantar y velocidad afectan la escena abierta (y el globo por `postMessage`).
- **No revisado:** dentro del `iframe` del globo (el filmador no lo ve; se miró en capturas); el parpadeo de las caras (`jump` de una elipse: es la pieza aprobada); la cobertura a velocidad real queda `inconclusive`; teléfono; Safari.
