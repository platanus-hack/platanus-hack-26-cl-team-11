# Diseño de Ronda

Esta es la única dirección visual del proyecto. Mati la aprobó el 21-nov-2026 después de descartar
cinco (están en `archive/`, no se usan). **Toda pantalla, slide o gráfico del proyecto sigue este
documento.** Si algo no está acá, no se inventa: se pregunta a Mati o se agrega acá primero.

![Pantalla de referencia](reference.png)

## Antes de tocar UI: 4 pasos

1. Abre `design/reference.html` en el navegador. Así se ve Ronda.
2. Carga `design/tokens.css` y `design/ronda.css` en tu pantalla. Arma todo con las clases `rd-*`.
3. Si te falta una pieza, agrégala a `ronda.css` (y un token a `tokens.css` si hace falta) en un
   commit propio, y anótala en la tabla de primitivas de este documento.
4. Antes de terminar: corre `design/lint.sh`, saca una captura de tu pantalla y ponla al lado de
   `design/reference.png`. Tienen que parecer la misma app.

## Demos e ilustraciones de producto

Todo lo que muestra el producto funcionando sin ser el producto (hero animado, pantallas del
pitch, recorridos con cursor, teléfonos con una conversación) se hace con la skill **Stageshow**
(`.agents/skills/stageshow/`, AGENTS.md regla 4). Este documento manda en el look; Stageshow manda
en el oficio: encuadre, recorte, ritmo y revisión cuadro a cuadro.

## La idea en una frase

**Los agentes viven en O(n²). Tú vives en O(1).** Muchas conexiones delgadas de fondo, y una sola
cosa brillante al frente: tu decisión. Todo el diseño dice eso.

## Los 7 principios

| # | Principio | En la práctica |
|---|---|---|
| 1 | **Luz, no tinta.** | Fondo casi blanco con un aura de color difuminada. Nada de bloques de color sólido ni fondos negros. |
| 2 | **Vidrio.** | Toda tarjeta, chip y píldora es translúcida (`rd-glass`), sin bordes oscuros. |
| 3 | **El degradado es para lo que importa.** | Solo en cuatro lugares (ver abajo). Si todo brilla, nada brilla. |
| 4 | **Una decisión por pantalla.** | Una sola tarjeta `rd-decision`, con un botón primario. |
| 5 | **Números tipo Apple Health.** | Número grande redondeado, unidad chica y gris, etiqueta chica arriba. |
| 6 | **Tipografía de sistema, un solo peso.** | SF Pro. Peso 600 para todo lo que no es texto corrido. Nunca 700, 800 ni cursiva. |
| 7 | **Personas con cara.** | Donde aparece un nombre, aparece su cara. Nunca un nombre suelto ni una inicial. |

## El degradado: dónde sí y dónde no

Azul → violeta → rosa → rojo → naranjo (`--rd-gradient`).

**Sí, solo acá:**

1. La segunda línea del titular de la pantalla (`rd-gradient-text`).
2. El borde de la tarjeta de decisión y su etiqueta.
3. Las líneas del grafo que están negociando ahora, y el aro de la cara que está en esa
   negociación (`rd-cara` activa o pensando; es la misma señal, no un quinto lugar).
4. El número que representa «lo tuyo» frente a «lo de los agentes» (el `1` de «1 decisión»).

**No:** botones, fondos de tarjeta, íconos, texto corrido, bordes de otras tarjetas, gráficos de
datos. El isotipo usa su propio degradado cálido y es el único otro lugar con color.

## Color

Todos los valores están en `tokens.css`. No se escribe un color a mano en ningún otro archivo.

| Token | Para qué |
|---|---|
| `--rd-bg` | Fondo de toda pantalla. |
| `--rd-ink` | Texto principal y botón primario. |
| `--rd-muted` | Texto secundario, unidades, etiquetas. |
| `--rd-glass`, `--rd-glass-solid` | Superficie de tarjetas. La sólida es solo para la de decisión. |
| `--rd-gradient` | Ver arriba. |
| `--rd-aura-*` | Las cuatro manchas del fondo. Solo dentro de `rd-aura`. |
| `--rd-live` | El punto verde «en línea». Nada más es verde. |

El único color por persona es la luz de su cara (ver «Caras»): vive dentro de la gota y en el
halo que la rodea, y no sale de ahí. El nombre, la fila y la tarjeta de una persona no llevan su
color. No hay rojo de error ni amarillo de alerta. Si una pantalla necesita un estado nuevo
(error, alerta), se define acá antes de usarlo.

## Tipografía

| Uso | Clase | Tamaño | Peso |
|---|---|---|---|
| Titular de pantalla (uno) | `rd-hero` | 62 px | 600 |
| Frase de la decisión | `rd-title` | 24 px | 600 |
| Número grande | `rd-stat` | 40 px, SF Pro Rounded | 600 |
| Texto corrido | (base de `rd-page`) | 17 px | 400 |
| Nombre de persona, botón | `rd-person__name`, `rd-button` | 16 px | 600 |
| Etiqueta, estado, pie | `rd-label`, `rd-note` | 13 px | 600 / 400 |

Sin mayúsculas sostenidas, sin cursiva, sin subrayados, sin serif. El texto va alineado a la
izquierda; solo se centran los nombres bajo una cara.

## Primitivas (`ronda.css`)

| Clase | Qué es | Reglas |
|---|---|---|
| `rd-page` + `rd-page__inner` | Contenedor de toda pantalla. | Siempre el elemento raíz. |
| `rd-aura` | Las cuatro manchas de color del fondo (`<i>` × 4). | Una por pantalla, primer hijo de `rd-page`. |
| `rd-bar`, `rd-brand`, `rd-mark` | Barra superior con isotipo y nombre. | Isotipo: `logo/ronda-mark.svg`, sin modificar. |
| `rd-hero`, `rd-title`, `rd-label`, `rd-note` | Texto. | Ver tabla de tipografía. |
| `rd-gradient-text` | Texto con degradado. | Solo en los cuatro lugares permitidos. |
| `rd-glass` | Superficie de vidrio. | Se combina con `rd-card` o `rd-chip`. |
| `rd-card`, `rd-card--split` | Tarjeta bento. La `--split` tiene dos mitades. | Siempre con `rd-glass`. Radio 28 px. |
| `rd-decision` (+ `__body`, `__label`) | La tarjeta de la decisión. | Una por pantalla. |
| `rd-actions`, `rd-button`, `rd-button--quiet` | Botones píldora. | Un primario (negro) por pantalla. El resto, `--quiet`. |
| `rd-stat`, `rd-stat__unit`, `rd-stat-row` | Número grande con unidad. | Siempre con una `rd-label` arriba. |
| `rd-chip`, `rd-chip--status`, `rd-dot` | Chip de vidrio y píldora de estado. | Frases cortas, sin punto final. |
| `rd-cara` (`--chica`, `__gota`, `__halo`, `__anillo`, `__onda`), `rd-person` | La cara de una persona: gota de vidrio con lava y ojos, con sus estados. La monta `faces/caras.js`; no se escribe el HTML a mano. | Cara y nombre siempre juntos. Estados y uso en «Caras». |
| `rd-face` (`--small`, `--tiny`) | Imagen quieta de una cara (`faces/*.png`), para lo que no monta la cara viva. | Solo en el globo, el universo y la referencia. En pantallas nuevas va `rd-cara`. |
| `rd-graph`, `rd-node`, `rd-edge*` | El grafo de agentes en 2D (referencia). | El grafo de la demo es el globo de `grafo/globo.html`, ver abajo. |
| `rd-input`, `rd-row`, `rd-code` | Campo de texto, fila de lista con divisor y bloque de código. | Para pantallas de configuración. El código usa `--rd-font-mono`, nada más lo usa. |
| `rd-mini`, `rd-mini-link` | Miniatura de una interacción sobre su conexión. | Un objeto, un gesto reconocible y su ejemplo ampliado. |
| `rd-player`, `rd-player__position`, `rd-player__time` | Controles de una escena. | Pausa y repetición, avance de izquierda a derecha y tiempo transcurrido. |
| `rd-source` (`__disc`, `__name`, `__when`, `--off`, `--dim`), `rd-edge--focus`, `rd-edge--dim`, `rd-edge--incoming` | Mapa de contexto: cada fuente (salud, correo, asistentes) es un disco de vidrio con un glifo en tinta alrededor de tu cara. | Glifo de trazo en `currentColor`, nunca el logo de la marca. La seleccionada lleva aro de tinta, no degradado. Un dato que llega se ve como trazos de tinta que viajan hacia tu cara. Propuesta del 21-nov, pendiente de revisión de Mati. |
| `rd-layout`, `rd-stack` | Dos columnas: contenido y columna de tarjetas de 392 px. | En teléfono queda una columna. |
| `rd-head`, `rd-head__end` | Encabezado de sección: un `rd-title`, una píldora de estado opcional (`rd-chip`) y una acción a la derecha. | Sin tarjeta alrededor de la sección. |
| `rd-list`, `rd-item` (`__icon`, `__icon--app`, `__text`, `__title`, `__sub`, `__end`, `__value`, `__detail`, `--off`) | Lista de filas con divisor fino: ícono de 28 px sin recuadro o cara, título, subtítulo gris de una línea y una sola acción al final. | La fila que abre algo es un `button` con chevron; lo que abre va en `__detail`. Una fuente conectable lleva el ícono real de su app, desde `sources/` (`__icon--app` redondea los que son ícono de app completo); todo lo demás, glifo de trazo en `currentColor`. Pedido de Ian del 21-nov, pendiente de revisión de Mati. |
| `rd-panel` | Envoltorio del panel personal: tipografía `--rd-font-panel` (Hanken Grotesk), títulos de sección de 17 px, filas de 14 px en peso 350 y botones compactos de esquinas de 8 px, blancos con borde fino. | Solo en `/conectar/<token>`. Fuera del panel siguen los botones píldora y `--rd-font`. Pedido de Ian del 21-nov, pendiente de revisión de Mati. |
| `rd-iconbutton`, `rd-iconbutton--bare` | Botón redondo de 36 px con un glifo («+» junto a un encabezado, «⋯» del menú). | Siempre con `aria-label`. |
| `rd-button--small` | Botón píldora de 36 px para la acción de una fila. | Un solo verbo: «Conectar», «Cambiar», «Pausar». Va con `rd-button--quiet`. |
| `rd-menu`, `rd-menu__item` | Menú de vidrio que se abre bajo el «⋯». | Se combina con `rd-glass`. |
| `rd-tabbar`, `rd-tabbar__tab`, `rd-tabbar__name` | Barra flotante de pestañas, fija abajo al centro: solo íconos, la activa (`aria-current`) con fondo suave y el nombre aparece arriba al pasar el cursor o enfocar. | Es un `nav` con `rd-glass`. Sin degradado ni botón negro. El contenido deja espacio abajo para que no tape la última fila. |

## Caras

**Cada persona es una gota de luz con ojos** (decisión de Mati, 21-nov-2026). Una gota de vidrio
con su propia lámpara de lava adentro, en cuatro tonos suyos, y solo ojos. La forma de los ojos,
los anteojos, una ceja, un lunar y la manera de mirar y parpadear dicen quién es. No tiene boca,
nariz ni pelo. Para verlas y probarlas: `caras/caras.html`.

- No se usan fotos reales, iniciales, emojis, Vita Faces ni avatares de otro estilo.
- **Una sola pieza.** `faces/caras.js` (carga antes `luz/luz.js`) y las clases `rd-cara` de
  `ronda.css`. El HTML de la cara no se escribe a mano:

      var cara = RondaCaras.mount(nodo, 'Camila Rojas', { size: 40 });
      cara.set('activa');

  En React la envuelve `frontend/src/Face.tsx`: `<Face name="Camila Rojas" state="activa" />`.
- **El mismo nombre da siempre la misma cara y los mismos colores**, en cualquier pantalla y sin
  guardar nada. Una persona nueva no requiere componer ni exportar nada.
- **El equipo** (mati, ian, lian, andres, roberto) tiene ojos y tonos fijos, escritos en `TEAM` y
  `TEAM_LIGHT` de `caras.js`. Se reconoce por el primer nombre, con o sin tilde.
- Las caras no buscan parecerse a cada integrante.

### Estados

Hover y presionada no se fijan a mano: salen solas del puntero, del foco y del teclado. Los otros
cuatro los fija el producto con `cara.set(estado)` según lo que le pasa a la persona.

| Estado | Cuándo | Ojos | Gota |
|---|---|---|---|
| `reposo` | Siempre que no pasa otra cosa. | Miran alrededor y parpadean, cada cara a su ritmo. Si el puntero pasa cerca, lo siguen. Dos vecinas de un mismo grupo se miran cada tanto. | La lava fluye tranquila. |
| hover | El puntero o el foco del teclado está encima. | Se abren un poco, la ceja sube y siguen al puntero. | Se levanta: crece 6 %, sombra más larga, halo de su color y la lava se acelera. |
| presionada | Mientras dura el clic, el dedo o la tecla Espacio o Enter. | Se aprietan. | Se aplasta como gel y la lava se agita. Al soltar rebota, parpadea y sale una onda. |
| `activa` | La persona está en la conversación que se muestra, o es la elegida. | Atentos: miran menos a los lados. | Aro con el degradado de Ronda que gira lento, halo y una respiración suave. |
| `pensando` | Su agente está negociando por ella. | Miran hacia arriba y se pasean, con el párpado algo caído. | El aro es un cometa que gira rápido, el halo late y la lava se mueve más. |
| `lista` | Hay acuerdo o la persona aceptó. | Sonríen: dos arcos, con un rubor de luz debajo. | Un salto corto, una onda y el halo encendido. |
| `ausente` | No está disponible o pausó a su agente. | Cerrados, sin mirada ni parpadeo. | La lava casi se detiene y pierde color. |

- `cara.pulse()` da un saltito con onda y parpadeo: avisa que llegó algo de esa persona, sin
  cambiar su estado.
- Al aparecer, la cara crece suave desde 88 %.
- Con `prefers-reduced-motion` la cara queda quieta y los estados cambian sin transición. El
  estado se sigue leyendo por el aro, el halo, los ojos y el color.
- Con el teclado, la cara o su fila muestran además el contorno de foco.

### Tamaños

La cara decide qué muestra según su tamaño (`size`, en px). No se elige a mano.

| Tamaño | Qué muestra |
|---|---|
| 120 px o más | Todo: ojos con párpado, brillo y sombra, cejas, anteojos con reflejo, lunar o pecas. |
| 64 a 119 px | Lo mismo, con trazos algo más gruesos. |
| 32 a 63 px | Ojos y anteojos. Sin cejas ni marcas. |
| Menos de 32 px | Dos fichas de tinta y el color. El estado se lee por el aro, el halo y el color. |

Tamaños en uso: 40 px en una fila de lista, 72 y 92 px en un nodo, 168 px o más en una portada.

### Reglas de uso

- Donde aparece un nombre aparece su cara (principio 7), con el nombre completo de la persona
  como semilla. No se inventa otra semilla ni se elige la cara a mano.
- Si la cara vive dentro de una fila, un enlace o un botón, ese elemento se pasa en `trigger`
  para que la cara reaccione cuando se toca la fila entera. `Face.tsx` ya lo hace.
- Varias caras que conversan se montan con el mismo `group` (`RondaCaras.group()`): así se miran.
- El aro con degradado es solo para `activa` y `pensando`. No se le pone aro a una cara para
  adornarla. `lista` y `ausente` no llevan aro.
- El color de una persona no sale de su cara (ver «Color»).
- Lava viva a la vez: 36 caras grandes, 64 medianas y 256 chicas. La que no cabe muestra su mezcla
  quieta. Sin WebGL2 pasa lo mismo con todas, y los ojos siguen vivos.
- Lo que no monta la cara viva (el globo, el universo, una lámina) usa las imágenes quietas de
  `faces/`: `mati.png`, `ian.png`, `lian.png`, `roberto.png`, `andres.png` (320 px) y
  `atlas/faces.png` con `atlas/faces-blur.png` (64 caras, 8 × 8 de 128 px). Se sacan del mismo
  dibujo con `python3 design/caras/aplicar.py --out <carpeta>` y se copian a `faces/`. Hay que
  volver a sacarlas cada vez que cambie el dibujo de las caras.

### Historia

Hasta el 21-nov las caras eran Vita Faces. Mati reabrió la pregunta, eligió «Aura» (la gota con
lámpara de lava), descartó las caras dibujadas sobre la gota («goofy and undone») y entre Ojos,
Vita de luz y la luz sola eligió los ojos («me gustaron los ojos»). Las alternativas quedan como
archivo en `caras/sabores.html` y `caras/intentos.html`. No son producto.

## Grafo de agentes: el globo

Aprobado por Mati el 21-nov-2026 («ESTA INCREÍBLE»). Página de trabajo: `grafo/globo.html`
(fuente: `grafo/globo.dc.html`; capturas: `grafo/globo-5.png` … `globo-300.png`). Se abre con
`?n=5|10|50|300` para fijar un tamaño y `&still` para una captura sin animación.

**Qué es:**

- Un globo de vidrio en 3D, dibujado en `<canvas>` con perspectiva propia (sin librerías). Las
  personas viven sobre la esfera; cada conversación posible es un arco que pasa por encima de la
  superficie.
- **Profundidad gradual** (nunca «sí/no»): cada cara se desenfoca, se aclara con niebla y pierde
  sombra de forma continua según su profundidad (`smoothstep` sobre z); los nombres también se
  desvanecen. Encima del fondo va el brillo del vidrio, que se desplaza lento, y un borde blanco.
- **Toda persona tiene cara.** El globo dibuja las imágenes quietas de las caras de Ronda (ver
  «Caras»): el equipo usa `faces/*.png` y el resto sale del atlas de 64 caras
  (`faces/atlas/faces.png`, 8 × 8 de 128 px) y su gemelo desenfocado para el fondo
  (`faces/atlas/faces-blur.png`). Cerca del borde del globo las caras se achican para no
  amontonarse.
- **Luz dentro de la esfera** (Mati, 21-nov): con 10, 50 y 300 personas el interior del globo es una
  lámpara de lava calmada: masas de luz que se funden y se separan (`luz/luz.js`, un sombreador WebGL2
  sin librerías que marcha rayos sobre esferas de cera dentro del vidrio). Las conversaciones posibles
  son hilos de luz blancos. Antes eran líneas de tinta gris y la esfera se veía rayada. `?luz=0` vuelve
  a las líneas; sin WebGL2 también. Con `prefers-reduced-motion` la luz queda quieta.
- **Escala desde datos**, no a mano:
  - 5 personas: pentágono con caras, nombre y estado al costado (como la referencia).
  - 10, 50, 300: esfera (espiral de ángulo áureo). La cámara retrocede, las líneas se adelgazan.
    Con 300 las 44.850 líneas son una neblina de luz dentro del globo. Nunca una mancha oscura.
- **Grupos negociando a la vez** (2 con 5 personas, 3 con 10, 6 con 50, 10 con 300), de hasta 9
  personas, en tres rondas: quien pide ayuda habla con sus ayudantes; cada ayudante suma a
  alguien más; los ayudantes combinan sus respuestas. Algunos grupos comparten una persona que
  hace de puente con otro grupo.
- **Miniaturas** (las de `grafo/mini/motion-paint.js`): cada grupo tiene un tipo (chat, agenda,
  salud, permiso, ayuda, check-in, pulso, propuesta) y su miniatura va sobre el primer hilo, en el
  punto con más espacio entre caras. Solo la del grupo con color va a color; las neutras van en
  escala de grises (máximo 2 con 50 personas y 3 con 300).
- **A lo más un grupo con color a la vez** (Mati, 21-nov). Por defecto es el tuyo (Tú, Ian, Lian,
  con chips); si tocas otro, ese pasa a color y el tuyo a tinta. Los demás grupos van en tinta
  neutra: líneas grises finas y aro gris en sus miembros. El grupo con color lleva líneas con
  degradado y halo, y un aro con degradado que gira lento en cada miembro.
- **Vida de un grupo** (los neutros; el de color se queda negociando):
  - nace: los hilos salen de quien pide ayuda con una punta de luz; cada cara se acerca un poco
    cuando su hilo la alcanza; luego aparecen los hilos de la segunda ronda;
  - negocia: una estela suave recorre cada hilo (blanca en el de color, tinta en los neutros);
  - acuerdo: los hilos se recogen hacia quien pidió ayuda, que se ilumina suave, y aparece un chip
    «Listo» con check; después el grupo se apaga y reaparece en otro sector del globo.
- **Interacción:**
  - Arrastrar gira el globo (con inercia; a los 4 s sin tocarlo vuelve solo).
  - Pasar el cursor por una persona enciende sus n − 1 conversaciones y un chip con su nombre.
  - Tocar a alguien con aro destaca su grupo: el globo gira para dejarlo al frente, el resto se
    atenúa, aparece el tema sobre el grupo y una tarjeta a la derecha con el tema, cada miembro con
    cara, nombre y rol («Pide ayuda» / «Puede ayudar»), y «N agentes, M conversaciones. Nadie más se
    entera.». Tocar fuera o «Cerrar» lo suelta.
- Se reproduce solo 5 → 10 → 50 → 300; tocar un tamaño o un grupo lo detiene.
- **Incrustado en otra página:** `grafo/globo.html?embed` deja solo la esfera, con fondo transparente y encuadrada al
  marco (`grafo/embed.js`; el dibujo del globo no cambia). Muestra un equipo de diez que conversa sin parar, avisa cada
  acuerdo a la página con `postMessage` y acepta pausa, velocidad y adelantar. Lo usa `contexto/resumen.html`.
- `prefers-reduced-motion`: sin vaivén, sin luz que recorre, sin nacimientos ni destellos; todo
  cambio es inmediato.

**Sigue abierto** (proponer y preguntar):

- Paso de «negociando» a «acuerdo», y el rearmado en vivo cuando alguien retira su disponibilidad.
- Dirección de las conexiones (flechas de quién le pide a quién, invertir una).
- Versión para teléfono y el componente real en `frontend/` (React), con sus primitivas `rd-*`.
- Ensayo con Stageshow (`film.mjs --gate`) y su `REHEARSAL.md`.
- Sala en vivo: `grafo/sala.html?sala=CÓDIGO` dibuja en el globo a las personas reales de una sala y sus
  conversaciones (`grafo/sala.js` reemplaza los datos de demo sin cambiar `globo.html`). Quedan por decidir
  cómo nace un nodo, cómo se ve antes y después de conectar su agente, y la dirección del arco.
  Propuesta del 21-nov, pendiente de revisión de Mati.

## Hilo entre agentes

Lo que se ve al abrir una conversación entre agentes (`grafo/hilo/`, integrado por Codex en
`grafo/globo.html`). Especificación completa: `grafo/hilo/README.md`.

- **Streaming** (`grafo/hilo/stream.js`, regla `Stream` de Stageshow): todas las letras se ponen
  desde el inicio en su lugar final, invisibles; una «cabeza» avanza por el texto y las letras se
  encienden con una cola de opacidad de 7 letras. El ritmo pausa tras coma y punto. Sin cursor y sin
  palabras que saltan. Antes de escribir, tres puntos dentro de la burbuja. La burbuja nunca cambia
  de tamaño mientras se escribe.
  El dato privado es un marcador «dato privado» con candado; el valor original nunca llega.
- **Llamadas a herramienta** (`grafo/hilo/tools.js`): una tarjeta chunky por conector (Calendario,
  Tu política, Equipo, Pulso del equipo, Permisos, Presentaciones, Tablero, GitHub, Granola,
  WhatsApp, Salud) con una escena viva de lo que hace: la agenda se escanea, dos agendas se juntan
  hasta coincidir, el candado se cierra, las caras van respondiendo, el sello cae, la rama se une.
  El estado («Consultando» → recibo) cambia en su propio lugar, con un cruce suave.
- **Excepción de color:** cada conector tiene su tinte, como las miniaturas del globo. El tinte vive
  solo en el ícono de la tarjeta, su escena y su recibo. Nunca en texto corrido, botones ni fondos
  de pantalla.
- El pulso del equipo nunca muestra valores individuales: solo aportes contados contra el mínimo
  y un nivel común.
- Galería de trabajo: `grafo/hilo/herramientas.html` (pasa `film.mjs --gate`, ver `REHEARSAL.md`).
- **En el grafo, un solo arco a la vez** (`grafo/hilo/edge.js`, `edge-globe.js`): el arco del hilo
  activo cuenta lo que pasa en él, con el mismo reloj que el hilo. Escriben: tres puntos chicos
  viajan desde quien escribe. Corre la herramienta: su miniatura sobre un plato blanco, con una
  barrita de avance del tinte. Termina: check del tinte que se encoge hasta un punto. Los demás arcos
  con hilo muestran solo un punto chico que se puede tocar. La tarjeta grande vive solo en el hilo.
- Duplas para revisar cada herramienta con su miniatura: `grafo/hilo/duplas.html` (tamaño ajustable).
- **Panel demo omnipotente:** `grafo/universo.html` muestra todo junto en una vuelta de tres pasos:
  (1) **Uno a uno**: las 4.950 conversaciones entre pares destellan en el globo y el panel lista lo
  que saca cada par; se forman los grupos. (2) **Grupos**: la cámara viaja por 6 grupos de 3 a 5 que
  conversan en vivo, con el hilo a la derecha y la miniatura de la herramienta flotando fuera del
  arco, atada con una línea punteada. (3) **Tu semana**: tarjeta de cierre con cifras y calendario
  Lun–Vie de los acuerdos; el panel los lista con check. Globo grande con la luz de lava
  (`luz/luz.js`, `?luz=0` la apaga). Sin titular ni contadores fijos. Los controles y el catálogo de
  herramientas están ocultos por defecto (tecla H o `?ui=1`). Todo lo nuevo se agrega ahí
  (AGENTS.md, regla 6).

## Texto de la interfaz

- Español de Chile, tuteo, frases cortas. Se habla desde el lado de la persona: «Tu decisión de
  hoy», no «Propuesta generada».
- Los botones dicen lo que pasa: «Aceptar», «Ajustar».
- Sin signos de exclamación, sin emojis, sin jerga técnica en pantalla (nada de «agente
  coordinador», «payload», «sync»).
- Horas en formato 24 h con dos puntos (`10:30`). Miles con punto (`44.850`).
- Lo privado se dice: «No sale de tu agente.»
- **El titular nombra la pantalla con una sola frase simple**: «Conexiones», «Tus conexiones»,
  «Resumen», «Mapa». Nada de frases ingeniosas ni de dos tiempos («Conecta lo tuyo. Tu agente hace
  el resto.», «Todo lo tuyo, en un solo mapa.»). Vale también para subtítulos, botones y tarjetas:
  se dice qué es o qué pasa, sin eslogan.

## Movimiento

En las pantallas generales, la animación continua es la luz que recorre las conexiones activas. La coreografía de las miniaturas está en rediseño. Lo demás aparece sin
rebotes ni giros. Las caras son la excepción: tienen vida propia (mirada, parpadeo, lava) y reaccionan
al puntero y a su estado, como dice «Caras». Se respeta `prefers-reduced-motion`.

### Miniaturas de interacción · en rediseño

**Mati rechazó la primera ejecución visual.** La lámina y las especificaciones de esta sección documentan la versión existente para poder reemplazarla. El encargo vigente está en el [handoff de miniaturas](HANDOFF_MINIATURAS.md).

<details>
<summary>Archivo de la primera ejecución e integración técnica</summary>

![Las cinco miniaturas a escala de detalle](grafo/miniaturas.png)

[Globo con actividades](grafo/globo.html?n=5) · [Vista ampliada de los cinco objetos](motion/minis.html)

En el grafo se ven varias acciones a la vez. Cada una se lee por la silueta y por el
movimiento de un objeto físico. La referencia que pidió Mati es el estilo chunky de
PostHog: objetos pequeños de escritorio, con volumen, color local y una mecánica reconocible.

- **Superficies.** Dibujar frente, canto y cara superior. La luz viene de arriba a la izquierda.
  Usar contorno de tinta cálida, brillo corto en el bisel y sombra de contacto suave. Las tapas
  esmaltadas, las hojas de papel y el cristal del monitor tienen acabados distintos. Los colores
  están en los tokens `--rd-mini-*`. Esta paleta se usa en los objetos del grafo.
- **Escala.** Diseñar para leer primero la silueta a 48–88 px. Los detalles explican la acción al
  acercarse. El nombre queda por fuera del objeto y la conexión pasa por debajo. Las caras de las
  personas conservan espacio propio.
- **Movimiento.** Cada mini repite preparación, acción y reposo. Desfasar los inicios para que
  se vean conversaciones independientes. Mantener inmóvil el anclaje al grafo, mover las partes
  del objeto. Pausar conserva la fase actual. Con movimiento reducido se ve el resultado quieto.
- **Significados.** Chat alterna dos bocadillos. Calendarios alinea una ranura de ambas agendas.
  Salud lee en el monitor y cierra el candado. Permisos estampa la autorización antes de que salga
  el papel. Ayuda encaja dos piezas después de que ambas aceptan. Las miniaturas compartidas
  representan la actividad con símbolos y prescinden de valores personales.

En la demo de cinco agentes se dibuja un objeto en cada uno de cinco arcos activos. Al pasar a
10, 50 o 300 se muestran las dos conversaciones destacadas del globo. Cada objeto calcula su
posición sobre la misma curva que se dibuja en el canvas. Si dos proyecciones se superponen al
girar, la miniatura se aparta y un trazo fino conserva el anclaje al arco. Al seleccionarla se
abre la escena completa. La vista ampliada permite comparar las cinco acciones con la red quieta.

La primitiva reutilizable es `<ronda-mini kind="calendars" class="rd-mini">`. Los tipos son
`chat`, `calendars`, `health`, `permission` y `help`. Cada uno acepta los atributos booleanos
`paused` (congela el cuadro) y `poster` (muestra el resultado). Un anfitrión puede ajustar
`--mini-size`, `--mini-cycle` y `--mini-delay`. La geometría y los gestos se editan en
`grafo/mini/objects.js`. La integración con la cámara está en `grafo/mini/globe.js`.
Después de editar, ejecutar `python3 design/grafo/mini/build.py` desde la raíz para actualizar
el HTML portátil y las dos fuentes del globo. El ensayo está en [REHEARSAL.md](motion/REHEARSAL.md).

</details>

## Lo que no se hace

Cada punto es una dirección que Mati ya rechazó.

- Fondo negro u oscuro. Bloques de color sólido. Bordes negros gruesos.
- Tipografía serif (Instrument Serif u otra). Mayúsculas espaciadas tipo etiqueta.
- Grillas tipo Mondrian, círculos de metro, sellos circulares, estética «retro».
- Copiar Montu: tarjetas gris opaco `#f5f5f7` sobre blanco, avatares de arcilla 3D, un color por
  persona (la luz de una cara es de esa persona, pero ese color no sale de la cara). Ronda comparte con Montu solo el bento redondeado y los números tipo Apple Health.
- Degradado morado genérico de «app de IA» en botones o fondos.
- Frases ingeniosas como titular o subtítulo («Conecta lo tuyo. Tu agente hace el resto.»). El
  titular es el nombre de la pantalla.
- Glifos de trazo genéricos para una app que se conecta: va su ícono real. Nombre de una app
  seguido de un tema («Granola» y debajo «Pitch» se lee «Granola Pitch»).

## Decisiones

| Fecha | Decisión | Quién |
|---|---|---|
| 21-nov-2026 | Caras: «me gustaron los ojos», esas son las caras de Ronda. Gota de vidrio con lámpara de lava y solo ojos, con estados (reposo, hover, presionada, activa, pensando, lista, ausente). Reemplazan a las Vita Faces en todo el producto. El único color por persona es la luz de su cara. | Mati |
| 21-nov-2026 | Resumen de `contexto/`, sexta vuelta: bento con el globo al centro. El grafo del Resumen es el globo aprobado, incrustado (`grafo/globo.html?embed`), y no se detiene; la demo se puede pausar, adelantar y apurar. Las personas llevan la cara de Ronda (`RondaCaras`). Relieve solo en lo que se aprieta y en las marcas de los datos: las tarjetas son vidrio, sin canto. Una sola escala de radios (28, 16, 12, 6 y píldora). Una sola decisión por pantalla («no des tantas tareas»). Reemplaza el presupuesto de la fila de abajo. | Mati |
| 21-nov-2026 | Resumen de `contexto/`: la versión sin relieve «perdió todo el sabor». Vuelve el look chunky que gustó, con presupuesto: un canto por tarjeta, un número grande y un objeto o gráfico con relieve por tarjeta; relieve en tarjetas, botones, selector y marcas de los gráficos, no en la barra superior ni en las pestañas; un tinte por tarjeta. Conexiones y Mapa quedan como están: ahí el relieve va solo en el ícono de cada app y el botón principal. | Mati |
| 21-nov-2026 | Los datos y gráficos del producto muestran el efecto de red (tú frente a la mediana de tu equipo, conversaciones entre agentes, lo que llegó a ti). Un panel de seguimiento personal «no agrega valor». No toda superficie lleva relieve; el alcance quedó fijado en la fila de arriba. | Mati |
| 21-nov-2026 | Mapa de contexto aprobado («I love it»): esfera de puntos de vidrio que se mueve sola, apps y personas derivando sobre ella, las de atrás muy desenfocadas. | Mati |
| 21-nov-2026 | Titulares de una sola frase simple que nombra la pantalla («Conexiones»). Sin frases ingeniosas de dos tiempos. | Mati |
| 21-nov-2026 | Contexto personal (`contexto/`): íconos reales de cada app, superficies chunky (tarjeta blanca con canto, ícono como tecla, botón 3D). Mapa como esfera de puntos en 3D, sin cables. El primer mapa plano con cables: rechazado. | Mati |
| 21-nov-2026 | Dirección «Aura»: luz tipo Apple Intelligence, vidrio, bento, red de agentes al centro. | Mati |
| 21-nov-2026 | Se conserva de Montu: tarjetas bento redondeadas y números tipo Apple Health. | Mati |
| 21-nov-2026 | Globo: luz fluida dentro de la esfera e hilos de luz en vez de las líneas grises, que se veían como rayas en el vidrio. Caras: se explora «Aura», gota de luz con cara (`caras/sabores.html`); pendiente de aprobación. | Mati |
| 21-nov-2026 | La primera luz no era lo pedido: Mati quería una lámpara de lava. Se rehace con masas que se funden y se separan. Caras dibujadas sobre la gota, descartadas; quedan Ojos, Vita de luz o la luz sola, a elección de Mati. | Mati |
| 21-nov-2026 | Caras: Vita Faces (alternativas mencionadas: estilo Notion o fotos reales; no elegidas). | Mati |
| 21-nov-2026 | Se piden miniaturas simultáneas en las conexiones y la referencia chunky 3D de PostHog. Mati rechaza la primera ejecución de las cinco piezas. Rediseño pendiente. | Mati |
| 21-nov-2026 | El grafo queda abierto: «necesita trabajo». | Mati |
| 21-nov-2026 | Grafo con anillo/nube en 2D: descartado («horrible»). | Mati |
| 21-nov-2026 | Grafo: menos cosas. Un solo arco activo a la vez, con la miniatura de la herramienta en uso, sincronizada con su tarjeta en el hilo; los demás arcos, un punto chico. Sin Claude Artifacts: prototipos en `design/`. | Mati |
| 21-nov-2026 | Universo: sin titular ni contadores, globo más grande con luz de lava, ronda uno a uno antes de los grupos, controles y catálogo ocultables, chat rediseñado, streaming por letra sin cursor y final «Tu semana, coordinada». | Mati |
| 21-nov-2026 | Hilo: streaming sin reacomodo (Stream de Stageshow) y tarjetas de herramienta chunky con escena y tinte por conector (el tinte solo vive en la tarjeta). | Mati |
| 21-nov-2026 | Globo: grupos de hasta 9 en tres rondas con personas puente; miniaturas sobre los hilos (a color solo en el grupo con color). Hilo de chat diseñado en `grafo/hilo/`. | Mati |
| 21-nov-2026 | Globo: grupos de 3 a 6 en dos rondas; a lo más un grupo con color; desenfoque gradual por profundidad; sin «burbuja» de acuerdo: hilos que se recogen, brillo y chip «Listo». | Mati |
| 21-nov-2026 | Globo: cara en todos los nodos, nodos de atrás desenfocados bajo un velo de vidrio, varios grupos negociando con aro de grupo, tocar un grupo lo destaca, efectos de nacimiento y acuerdo. | Mati |
| 21-nov-2026 | Grafo = globo de vidrio en 3D: escala 5 → 300 desde datos, solo tus conversaciones con cara y degradado, se arrastra para girar y se resalta una persona al pasar el cursor. | Mati |

Abierto: nombre definitivo («Ronda» es provisorio) e isotipo definitivo (el actual, tres órbitas y
un punto, todavía no lo revisó Mati en grande).

## Archivos

| Archivo | Qué es |
|---|---|
| `DESIGN.md` | Este documento. La regla. |
| `tokens.css` | Colores, tipografía, radios, sombras, espacios. |
| `ronda.css` | Primitivas `rd-*`. |
| `reference.html`, `reference.png` | La pantalla de referencia, hecha solo con primitivas, y su captura. |
| `logo/ronda-mark.svg` | Isotipo. |
| `faces/` | Las caras de Ronda: `caras.js` (la cara viva, con sus estados) y sus imágenes quietas (`*.png` del equipo y `atlas/`). |
| `caras/` | `caras.html`: página para ver y probar las caras, sus estados y tamaños. `atlas.html` y `aplicar.py`: sacan las imágenes quietas. `sabores.html`, `intentos.html`, `intentos/`, `ojos.js`, `vita-luz.js`: archivo de las alternativas que no se eligieron. |
| `luz/` | `luz.js`: la lámpara de lava del globo y de las caras. |
| `sources/` | Íconos reales de las apps que se conectan (Apple Health, Granola, Gmail, Google Calendar, GitHub, Linear), sin modificar. Solo para las filas de fuentes. |
| `sources/apps/` | Íconos de app completos (192 px, a sangre) de 21 apps, para las teclas chunky de `contexto/`. Sin modificar, salvo el de Codex, recortado a sangre. |
| `contexto/` | Páginas de prueba del contexto personal: `resumen.html` (bento con el globo al centro), `conexiones.html` (directorio de apps y superficie de conexión), `superficies.html` (las cinco formas de conectar y sus estados) y `mapa.html` (esfera de puntos). Todo con datos de prueba. Detalle en `contexto/README.md`. |
| `lint.sh` | Revisa que ningún archivo de UI se salga de los tokens. |
| `canvas/` | Fuente del tablero en el canvas de diseño. |
| `archive/` | Direcciones descartadas. No usar. |
