# Hilo entre agentes: diseño de referencia

Handoff visual para portar a `design/grafo/mini/threads.css` y `threads.js` (dueño: Codex).
Fuente viva: `hilo.dc.html` (tablero «Hilo» del canvas de diseño). Mismo contrato de
`threadScript`: `message` y `call` con `at`/`end`, `author` como índice, `tokens`, y
`name`/`label`/`input`/`output`/`receipt`. Agrega dos tipos de evento: `ask` (permiso esperando
al dueño) y `human` (mensaje escrito por la persona, no por su agente).

## Contenedor

- Panel de vidrio (`rd-glass`), radio 28 px, 440 × 860 dentro de un margen de 20 px.
- Teléfono (≤ 749 px): hoja desde abajo, radio 28 px solo arriba, asa de 36 × 5 px, el globo
  queda detrás.
- Encabezado: dos caras superpuestas (34 px, −10 px de traslape, aro blanco de 2 px),
  `rd-label` «Tu agente y el de Ian», título 20 px/600. A la derecha una píldora de estado:
  «Negociando» con un punto de degradado, «Te espera» mientras hay un `ask` pendiente,
  «Acuerdo» con el punto verde `--rd-live` al final.
- Lista: anclada abajo (los mensajes nuevos empujan a los viejos hacia arriba), sin barra de
  scroll; el borde de arriba se desvanece con una máscara de 56 px.

## Mensajes

- Cara de 26 px junto a cada mensaje. Nombre del autor 12 px/600 `--rd-muted`.
- Agente de la otra persona: a la izquierda, burbuja blanca (`--rd-glass-solid`), radio
  6/18/18/18, sombra suave.
- Tu agente: a la derecha, burbuja `--rd-fill-soft`, radio 18/6/18/18.
- **Mensaje humano** (`human`): a la derecha, burbuja blanca con borde de 1,5 px `--rd-ink`,
  y el autor dice «Tú, en persona». Aparece casi sin «escribiendo».
- **Antes de escribir:** tres puntos de 6 px que suben y bajan (0,7 s para agentes).
- **Streaming:** por letra. Una cabeza continua avanza entre `at` y `end`; cada letra pasa de
  opacidad 0 a 1 en una cola de 7 letras detrás de la cabeza. El ritmo no es parejo: pausa tras
  coma (×4) y punto (×7) y ráfagas suaves. Sin cursor. Las letras de una palabra no se separan en
  el salto de línea. API igual que antes: `RondaStream.create(text)` → `{ el, update(fraction, done),
  finish() }`. Nada de degradado en el texto.
- Cada evento entra con `opacity`, `translateY(10px)` y escala 0,985 → 1 en 500 ms, con el
  origen en su esquina de abajo.

## Dato privado

- Se escribe `[[x]]` en el texto del evento. **El valor original nunca llega al cliente**: se
  dibuja solo un marcador: píldora `--rd-fill-soft` con candado de 10 px y «dato privado»
  13 px/600 `--rd-muted`.

## Llamada a herramienta (`call`)

- Tarjeta indentada 34 px, radio 16, fondo blanco 72 %, borde `--rd-hairline`.
- Ícono en cuadro de 28 px radio 9 `--rd-fill-soft`:
  - en curso: anillo que gira (0,9 s) y un brillo blanco que barre la tarjeta (1,5 s, en loop);
    recibo provisional «Consultando» en gris;
  - terminado: check que se dibuja (`stroke-dashoffset` 15 → 0 en 450 ms) y el recibo pasa a
    píldora `--rd-fill-soft` con escala 0,92 → 1;
  - resultado privado: candado en vez de check, recibo «Privado».
- Título = `label` 14 px/600; debajo `name` en `--rd-font-mono` 12 px `--rd-muted`.
- Se pliega y despliega con el chevrón: grilla «Entrada» / «Salida» en mono 12 px, una línea
  por clave (`clave: valor`).

## Permiso del dueño (`ask`)

- Mini tarjeta de decisión: borde con `--rd-gradient` de 1,5 px (es lo que te toca a ti),
  etiqueta «Tu decisión» en degradado, pregunta 16 px/600, línea «Tu agente espera tu
  respuesta. Ian no ve esta pregunta.» con los tres puntos, y botones «Aceptar» (negro) y
  «Ajustar» (`--rd-button--quiet`).
- Al aceptar: los botones se reemplazan por «✓ Aceptado por ti · 8:46».

## Pie

- Pausa/reproducir (36 px), barra de progreso de 4 px (`--rd-ink` sobre `--rd-fill-soft`),
  tiempo transcurrido y «Repetir». Estado final quieto: todo visible, «Acuerdo».

## Movimiento reducido

Sin parpadeo, sin puntos, sin giro ni brillo; se muestra el estado final completo.

## Futuro

Fallo recuperable de una herramienta: variante visual pendiente.
