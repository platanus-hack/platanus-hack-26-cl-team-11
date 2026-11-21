# Ensayo · Universo (panel demo omnipotente)

Página: `universo.html`, filmada con `film.mjs --gate` el 21-nov-2026 (Chrome sin ventana, WebGL por
software). La escena filmada es el panel del hilo (`.ss-stage`); el globo es un lienzo y se revisó en
capturas.

- **Gold de partida:** el Resumen de `contexto/` (tarjeta de vidrio, listas con cara, números grandes)
  y `Stream` / `States` de Stageshow para el hilo.
- **Beats:**
  1. Uno a uno: los pares destellan en el globo y el panel los lista (cara, título, una línea gris).
     Al cerrar, «Se forman 6 grupos» con check y quien no está en un grupo retrocede.
  2. Grupos: la cámara gira al grupo; el panel muestra tema y miembros con rol de inmediato, y el hilo
     se escribe abajo con sus tarjetas de herramienta. La miniatura flota fuera del arco activo.
  3. Tu semana: tarjeta con cuatro números que ruedan y el calendario; el panel lista los acuerdos.
- **Capturado:** `?s=2` a 1440 px y a 390 px (12 cuadros cada 700 ms). Capturas sueltas de `?s=0`,
  `?s=2..4`, `?s=7`, `?luz=0`, teléfono (390 × 844) y `?speed=8&ui=1`.
- **Gate:**
  - 1440 px: `rehearsal failed: 8 never-intentional line(s) above`, cobertura `inconclusive`.
  - 390 px: `rehearsal failed: 11 never-intentional line(s) above`, cobertura `inconclusive`.
  - Referencia: `main` antes de este cambio daba `rehearsal failed: 6` a 1440 px.
- **Film → arreglo:**
  - `settle snap` de 24 a 38 px (todo el hilo saltaba al terminar de irse la escena anterior): lo que
    sale ahora se fija fuera del flujo mientras se desvanece. La línea no volvió.
  - `lands on a transform` y `appears, then moves` (el recibo de la herramienta): capa propia y la
    entrada se desvanece durante todo el movimiento.
  - `steps in its box` (burbujas): cada fila del hilo tiene capa propia.
- **Lo que sigue fallando y por qué:**
  - `jump` de 66 a 203 px: es el deslizamiento (FLIP de 560 ms) cuando llega una fila nueva. El
    filmador saca unos 4 cuadros por segundo con el globo dibujado por software y ve el deslizamiento
    en uno o dos cuadros. No se pudo filmar más rápido en esta máquina.
  - `uneven gutters` en las burbujas: el chat alterna lados (lo tuyo a la derecha) y la burbuja deja
    lugar a la cara. Es el diseño aprobado del hilo; no se cambió.
- **Regla 6:** con `?speed=8&ui=1` la vuelta llega a «Tu semana» a los 70 s de reloj real en esta
  máquina, con 15 de 15 herramientas y 8 de 8 miniaturas marcadas.
- **No revisado:** el globo cuadro a cuadro, movimiento reducido, Safari y toque real en teléfono.
