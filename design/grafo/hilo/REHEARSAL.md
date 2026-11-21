# Ensayo · tarjetas de herramienta y streaming

Filmado con `film.mjs --gate` sobre `herramientas.html` (21-nov-2026).

- **Gold de partida:** `form-error` (el estado cambia en su lugar), `parts` (States, Stream, Check), `loading`.
- **Resultado:** `rehearsal passed` con las tres primeras tarjetas como escenarios (1440 px).
- **Corregido en el ensayo:**
  - la galería se reiniciaba sin causa a los 7 s: ahora se reproduce una vez y queda quieta, con «Repetir»;
  - el recibo aterrizaba sobre una transformación: tiene capa propia;
  - íconos a medio píxel: van en una caja par de 16 px;
  - el plegable de entrada y salida terminaba a 1 px del borde: ahora llega al borde;
  - el aro del spinner era translúcido: ahora es opaco.
- **Movimiento reducido** (`--reduced`): `rehearsal passed`. El único salto es el candado al cerrarse al terminar la consulta; es intencional porque con esta preferencia los cambios son inmediatos.
- **Hilo real** (`globo.html?motion=calendars`, Codex `5d2bfe3`): revisado a 1440 y 390 px con Playwright. Los recibos ocupan una línea bajo conector y método; las burbujas no cambian de tamaño al escribirse. Codex midió 14 cuadros de cruce entre «Consultando» y el recibo.
- **Lo que no se revisó:**
  - las 15 tarjetas juntas sin huecos de muestreo: con 15 escenarios el filmador pierde cuadros;
  - el cruce de estados cuadro a cuadro dentro del hilo real (lo midió Codex, no yo).

## Duplas arco + herramienta (`duplas.html`) y globo

- `film.mjs --gate` sobre los arcos de las dos primeras duplas: `rehearsal passed`.
- Corregido en el ensayo:
  - el borde de avance alrededor de la miniatura parecía un corchete roto: ahora es una barrita del tinte bajo la miniatura;
  - el arco se apagaba a gris un instante entre que escribían y arrancaba la herramienta: queda encendido toda la conversación.
- Globo (`globo.html?motion=all|calendars|permission`): un solo arco activo a la vez; con un hilo abierto, su arco va con el reloj del hilo. Revisado con Playwright a 1440 px (ambiental y con hilo abierto).
- Todas las pestañas del playground cargan sin errores de consola ni de red a 1440 y 390 px.
- Sin revisar: el ensayo cuadro a cuadro del globo (la escena es un canvas grande dentro de la página) y el toque en el punto chico a 390 px.
