# Contexto personal · páginas de prueba

Prototipos en HTML (AGENTS.md regla 5). Todo son datos de prueba: ninguna app se conecta de verdad.
Reemplazan a los dos canvas de `/design` del 21-nov, que ya no se actualizan.

Se abren directo en el navegador, sin servidor. También están publicadas en
`https://ronda-n8if.onrender.com/design/contexto/resumen.html` (el servidor entrega `design/contexto/`).

| Página | Qué muestra |
|---|---|
| `resumen.html` | Bento con el globo al centro. **Conversaciones entre agentes** es el globo aprobado (`../grafo/globo.html?embed`), con las caras de Montu, y no para: los grupos nacen, acuerdan y renacen con otras personas, y cada acuerdo suma al número. Abajo, el último acuerdo y los controles de la demo: pausar, adelantar al próximo acuerdo y velocidad 1×, 2×, 4×; el globo se gira arrastrándolo. Alrededor: **Llegó a ti** (3 avisos: dos resueltos sin ti y una sola decisión con «Aceptar» y «Ajustar»), **Tu agente habló con** (cuatro personas, cada una abre su mapa), **Pulso del equipo** (bloques por día) y **Tú y tu equipo** (nueve comparaciones con la mediana, filtro Todo / Salud / Trabajo / Mensajes). Ensayo con Stageshow en `REHEARSAL.md`. |
| `conexiones.html` | Directorio de 21 apps por categoría, con buscador y filtros. «Conectar» abre la superficie de conexión. |
| `superficies.html` | Las cinco formas de conectar (cuenta, llave, Atajo, asistente, código QR) y los tres estados (conectando, recién conectada, ya conectada), lado a lado. |
| `mapa.html` | Esfera de puntos en 3D que gira y se inclina sola. Las apps y las cinco personas van sobre la esfera y derivan; las de atrás se desenfocan. Cada app conectada tiñe su zona; al llegar un dato, un punto viaja de la app a la cara de la persona. Se arrastra para girar. |

Enlaces directos para revisar un estado:

- `conexiones.html?abrir=whatsapp` abre esa superficie; `&paso=conectando` o `&paso=lista` fija el estado.
- `mapa.html?fuente=github` abre el mapa con esa app al frente; `?persona=ian` abre el de esa persona; `?still` lo deja quieto.
- `resumen.html?still` deja todo quieto: el globo en una pose, sin controles de demo.

Archivos:

- `contexto.css`: en Conexiones y Mapa las superficies son tranquilas y el relieve queda en el ícono de cada app (`cx-tile`) y en el botón principal. El Resumen vive bajo `.cx-r`: tarjetas de vidrio (`rd-card rd-glass`), una sola escala de radios (28, 16, 12, 6 y píldora) y relieve solo en lo que se aprieta y en las marcas de los datos. Usa los tokens de `../tokens.css`; el tinte va en `--tint`.
- Caras: la pieza única de Montu, `RondaCaras.mount` de `../faces/caras.js` (con `../luz/luz.js` y las clases `rd-cara`). El Resumen solo les da tamaño (`.cx-face`) y estado: quien negocia tu decisión va en `pensando`, quien ya cerró algo va en `lista`, y al aceptar pasan a `lista`.
- `../grafo/embed.js`: el modo incrustado del globo. `globo.html` lo carga solo con `?embed`; no cambia cómo se dibuja. Habla con la página por `postMessage` (acuerdos hacia afuera; aceptar, pausa, velocidad y adelantar hacia adentro). Sirve igual abierto desde el disco.
- El número grande y los textos que cambian usan `counter()` y `roll()` de `resumen.html`: las versiones sin React de `Count` y `Roll` de Stageshow (gira solo el dígito que cambió; el texto anterior sale hacia arriba y el nuevo entra desde abajo, sin desenfoque).
- Ojo con `.cx button { font: inherit }`: pisa el tamaño de letra de cualquier botón con un selector de una sola clase. Los botones del Resumen llevan `.cx-r` delante.
- Ojo con los nombres: `.cx-globe` es de `mapa.html`. La tarjeta del globo en el Resumen se llama `.cx-hero`.
- `apps.js`: catálogo de apps (qué lee, qué nunca lee, forma de conectar) y la superficie de conexión.
- Íconos: `../sources/apps/`.

Reglas que salieron de las revisiones de Mati (21-nov):

- titulares de una sola frase simple, íconos reales de las apps, y bajo el nombre de una app va solo su último dato;
- los datos y gráficos muestran el efecto de red (tú frente a tu equipo, lo que hicieron los agentes), no seguimiento personal;
- sin relieve «pierde el sabor», y con relieve en todo «se ve descuidado»: el relieve va solo en lo que se aprieta (botón principal, tecla del selector) y en las marcas de los datos (barras, bloques, ícono de cada app); las tarjetas son vidrio, sin canto;
- una sola escala de radios; radios distintos entre superficies vecinas «se ve descuidado»;
- el grafo del Resumen es el globo que construye el equipo, no un dibujo aparte, y la demo no se detiene sola: se puede pausar, adelantar y apurar;
- las personas llevan la cara de Montu (la gota de luz con ojos), montada con `RondaCaras`, no una copia propia;
- pocas tareas: de todo lo que conversan los agentes, a la persona le llega una sola decisión;
- toda escena pasa por Stageshow (AGENTS.md regla 4).
