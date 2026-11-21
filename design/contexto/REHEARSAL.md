# Ensayo · Resumen (red del equipo, con relieve)

Página: `resumen.html`, filmada con `film.mjs --gate` el 21-nov-2026. Tiene dos escenas (`.ss-stage`):

1. la tarjeta «Conversaciones entre agentes»;
2. la tarjeta de herramienta dentro de «Llegó a ti» (`RondaTools.create` de `grafo/hilo/tools.js`, igual que en `grafo/hilo/herramientas.html`).

- **Gold de partida:** `subscriptions` (una ficha vuela a otra tarjeta y un total rueda) y `payout-flow` (coreografía sin cursor). La tarjeta de herramienta es la del hilo, ya aprobada.
- **Beats:**
  1. Los agentes conversan de a un par: el trazo engruesa, toma el degradado y una cuenta lo recorre. El total rueda hasta 46, aparece una cuenta por conversación y suben las barras por día.
  2. Mientras tanto la tarjeta de herramienta trabaja («Consultando»).
  3. Cuatro veces una ficha «Para ti» sale del trazo y vuela a su hueco en «Llegó a ti». El hueco pasa a aviso, sube el contador, se enciende su cuenta y aparece el tramo oscuro en la barra de ese día. Con la primera ficha la herramienta termina («Lian puede»).
  4. Queda quieto en 46 y 4. Cada 5 s conversa un par más: el total sube en 1, entra una cuenta y crece la barra de hoy. Para a las 9 conversaciones nuevas. Lo que llegó a ti no cambia.
- **Capturado:** 1440 px y 390 px (12 cuadros cada 700 ms) y movimiento reducido (`--reduced --still`: estado final, sin escena).
- **Gate:** `rehearsal passed` en los tres.
- **Film → arreglo:**
  - `uneven gutters` (5 líneas): marqué toda la tarjeta «Llegó a ti» como escena y el filmador juzgó cada aviso como un panel mal centrado. La escena es la tarjeta de herramienta; lo demás es una lista.
  - `appears with no entrance: button "Responder"` y `"Votar"`: la transición propia del botón tapaba la del aviso. Ahora entran con opacidad.
  - `hard edge: i is cut by span.cx-days__bar's edge`: el tramo oscuro se cortaba mientras la barra subía. Ahora aparece cuando llega su aviso.
  - Los avisos empujaban «Pulso del equipo» hacia abajo cuatro veces. Ahora cada aviso tiene su hueco desde el principio y la tarjeta no cambia de alto.
- **Supuestos:** las cifras son de prueba. «Equipo» es la mediana de 5 personas; nadie ve el dato de otra (`docs/PRIVACY.md`). Hoy es sábado 21: el domingo va sin datos.
- **No revisado:**
  - el filmador marca la cobertura como `inconclusive` por huecos de muestreo de más de 27 ms;
  - los cambios en el mismo lugar (`manual: same-box content change`: el total, el contador y el dibujo de la herramienta) se miraron en la tira de cuadros, no cuadro a cuadro;
  - el cambio de herramienta al tocar otro aviso se probó con Playwright (estado y recibo), no se filmó;
  - toque real en teléfono y Safari;
  - `mapa.html` no pasó por `film.mjs`: es un canvas a página completa y esta ronda no lo tocó.
