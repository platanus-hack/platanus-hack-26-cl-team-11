# Ensayo · Resumen (red del equipo, con relieve)

Página: `resumen.html`, filmada con `film.mjs --gate` el 21-nov-2026. Tiene dos escenas (`.ss-stage`), las dos tarjetas completas:

1. «Conversaciones entre agentes»;
2. «Llegó a ti», con la tarjeta de herramienta del hilo adentro (`RondaTools.create` de `grafo/hilo/tools.js`, sin recortes).

- **Gold de partida:** `subscriptions` (una ficha vuela a otra tarjeta y un total rueda) y `payout-flow` (coreografía sin cursor). La tarjeta de herramienta es la del hilo, ya aprobada.
- **Beats:**
  1. Los agentes conversan de a un par: el trazo engruesa, toma el degradado y una cuenta lo recorre. El total rueda hasta 46, aparece una cuenta por conversación y suben las barras por día.
  2. Mientras tanto la tarjeta de herramienta trabaja («Consultando»).
  3. Cuatro veces una ficha «Para ti» sale del trazo y vuela a su hueco en «Llegó a ti». El hueco pasa a aviso, sube el contador, se enciende su cuenta y aparece el tramo oscuro en la barra de ese día. Con la primera ficha la herramienta termina («Lian puede»).
  4. Queda quieto en 46 y 4. Cada 5 s conversa un par más: el total sube en 1, entra una cuenta y crece la barra de hoy. Para a las 9 conversaciones nuevas. Lo que llegó a ti no cambia.
- **Capturado:** 1440 px y 390 px (12 cuadros cada 700 ms) y movimiento reducido (`--reduced --still`: estado final, sin escena).
- **Gate:** `rehearsal passed` en los tres, con las dos tarjetas completas como escena. A 390 px y en quieto: `no-issues-detected`.
- **Film → arreglo** (cada línea que imprimió el filmador al tratar «Llegó a ti» entera como escena):
  - `uneven gutters` (tarjeta de herramienta y cada aviso): eran paneles sueltos sobre la tarjeta. Ahora van en una bandeja con el mismo margen a los lados y abajo; adentro son filas de una lista.
  - `near aligned`: el texto de los avisos partía 8 px a la izquierda del título de la herramienta. Ahora comparten borde.
  - `loose list` y `fat row`: una regla general (`.cx button { font: inherit }`) pisaba el tamaño y el interlineado de los avisos. Se corrigió en su origen y los avisos de una línea miden 50 px.
  - `uneven inset`: la cara de cada aviso queda a 7 px del borde por los tres lados.
  - `appears with no entrance` (caras, barras por día, botones «Responder» y «Votar»): lo que arma el script entra con opacidad.
  - `hard edge` (tramo oscuro cortado mientras la barra subía): el tramo aparece cuando llega su aviso.
  - `tight inset` (renglón «Entrada y salida») y `uneven gutters` (escena de la herramienta a 390 px): dos ajustes de caja sobre la tarjeta del hilo, solo en esta página, que no cambian su dibujo. La galería `grafo/hilo/herramientas.html` pasa el mismo control sin ellos.
  - Los avisos empujaban «Pulso del equipo» hacia abajo cuatro veces: cada aviso tiene su hueco desde el principio.
- **Título de la herramienta a 390 px:** 1 línea en los cuatro avisos, con el estado debajo, sin recorte ni solape (antes eran 3 líneas). En un contenedor de menos de 430 px la cabecera pasa a grilla. Se acortaron dos títulos: «Pedir revisión a Ian» y «Buscar quién tiene el guion».
- **Supuestos:** las cifras son de prueba. «Equipo» es la mediana de 5 personas; nadie ve el dato de otra (`docs/PRIVACY.md`). Hoy es sábado 21: el domingo va sin datos.
- **No revisado:**
  - a 1440 px el filmador marca la cobertura como `inconclusive` por huecos de muestreo de más de 27 ms (a 390 px es completa);
  - los cambios en el mismo lugar (`manual: same-box content change`: el total, el contador y el dibujo de la herramienta) se miraron en la tira de cuadros, no cuadro a cuadro;
  - el cambio de herramienta al tocar otro aviso y el filtro de «Tú y tu equipo» se probaron con Playwright (estado, textos y anchos de barra), no se filmaron;
  - toque real en teléfono y Safari;
  - `mapa.html` no pasó por `film.mjs`: es un canvas a página completa y estas rondas no lo tocaron.
