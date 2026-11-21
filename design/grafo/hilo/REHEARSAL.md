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
- **Lo que no se revisó:**
  - a 390 px: el ancho lo resuelve el hilo de Codex, que dice haberlo probado;
  - las 15 tarjetas juntas sin huecos de muestreo: con 15 escenarios el filmador pierde cuadros;
  - el streaming dentro del hilo real (integrado por Codex en `globo.html`, `82e470a`).
