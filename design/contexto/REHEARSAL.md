# Ensayo · Resumen (red del equipo)

Escena: `resumen.html`, tarjeta «Conversaciones entre agentes» (`.ss-stage`), filmada con `film.mjs --gate` el 21-nov-2026.

- **Gold de partida:** `subscriptions` (lo que hace el sistema: una ficha vuela a otra tarjeta y un total rueda) y `payout-flow` (coreografía sin cursor). El trazo vivo y la chispa salen de `rd-edge--live` y `rd-edge--spark` de `ronda.css`.
- **Beats:** 1) los agentes conversan de a un par: el trazo toma el degradado y una chispa lo recorre; el total rueda hasta 46. 2) Cuatro veces una ficha «Para ti» sale del trazo y vuela a «Llegó a ti», donde entra su fila y sube el contador. 3) Queda quieto en 46 y 4. Después, cada 5 s conversa un par más y el total sube en 1; lo que llegó a ti no cambia.
- **Capturado:** 1440 px y 390 px (12 cuadros cada 700 ms) y movimiento reducido (`--reduced --still`: estado final, sin escena).
- **Gate:** `rehearsal passed` en los tres.
- **Film → arreglo:**
  - `jump: b "4" width -2.6px`: el contador chico cambiaba de ancho al subir. Ahora usa cifras tabulares.
  - `touching: span.cx-net__label … overlapping b`: salió al fijarle un ancho al contador; se quitó el ancho fijo.
  - La ficha «Para ti» salía en serif porque vive fuera de `.rd-page`: lleva su propia tipografía.
  - El trazo vivo salía gris: `url(#cx-live)` en la hoja de estilos resuelve contra el CSS, no contra la página. El trazo se pinta desde el script.
- **Supuestos:** las cifras son de prueba. El equipo es la mediana de 5 personas; nadie ve el dato de otra (`docs/PRIVACY.md`).
- **No revisado:**
  - el filmador marca la cobertura como `inconclusive` por 3 huecos de muestreo de más de 27 ms;
  - el cruce de texto del total cuadro a cuadro (`manual: same-box content change`);
  - `mapa.html` no pasó por `film.mjs`: es un canvas a página completa. Se revisó con capturas de Playwright a 1440 y 390 px, en reposo, con una app al frente y con un dato llegando;
  - toque real en teléfono y Safari.
