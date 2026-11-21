# Diez personas, sus fuentes y sus agentes

> **Borrador.** Lo que está entre corchetes se llena con el resumen de la toma (`diez-personas.json`) y con lo que pasó al grabar. El link al video se agrega cuando la toma esté revisada.

[M min SS s] · 1920 × 1080 · grabado el [DD-mmm-2026] · toma [M] de [N]

Una persona conecta sus fuentes de tres formas (un envío, una cuenta y una llave) y su asistente. Después hay diez personas en la sala, cada una con otra mezcla, y sus agentes conversan. Dentro de los marcos corre el producto real: a la izquierda la pantalla de la sala, a la derecha un teléfono y abajo lo que hace el guion en lugar de cada agente y de cada fuente. Las personas y sus datos son inventados, y el video lo dice en cada cuadro.

## Qué se ve

Los minutos salen de `pasos[].segundo` del resumen.

| Minuto | Paso |
|---|---|
| [0:00] | 1. La pantalla de la sala «Equipo Quillay», con el QR y con Antonia adentro, todavía sin agente. |
| [m:ss] | 2. En el teléfono de Antonia se crea la línea para su agente. El guion hace de su Claude Code: abajo quedan sus tres llamadas. En el teléfono aparecen el asistente y cuatro archivos, y en la sala, «Claude Code» bajo su nombre. |
| [m:ss] | 3. Llega una noche de sueño a Apple Health. Antonia toca «Conectar» en Google Calendar, aparece una pantalla de permiso simulada y, al permitir, quedan conectados Google Calendar y Gmail. Abajo se lee un correo y una reunión que quedaron guardados. [Si se grabó con `--permiso api`: la pantalla de permiso no aparece y el registro dice «el guion autoriza por Antonia, sin pantalla de permiso».] |
| [m:ss] | 4. Granola entra con una llave escrita en el teléfono: «Conectado como antonia@ronda.example. 2 registros nuevos.» |
| [m:ss] | 5. Check-in desde el teléfono: «Normal» y, como bloqueo, «guion y ensayo del pitch». |
| [m:ss] | 6. En «Tú», la fila «Carga» dice «Carga alta hoy» y de dónde sale: Google Calendar y Granola. |
| [m:ss] | 7. En «Equipo», su agente pregunta «¿Pido ayuda con «guion y ensayo del pitch»?». Antonia toca «Permitir». |
| [m:ss] | 8. Entran nueve personas más. El registro dice con qué asistente y con qué fuentes llega cada una. En la sala quedan diez nombres, ocho tipos de asistente y una persona sin agente. |
| [m:ss] | 9. Antonia inicia la ronda y los agentes conversan. Este tramo va acelerado ×6; el reloj muestra el tiempo real. |
| [m:ss] | 10. [Dos personas pueden / Una persona puede] ayudar a Antonia. Ella lee lo que conversó su agente y acepta la propuesta; el guion acepta por las demás personas y la propuesta queda «Acordada». |
| [m:ss] | 11. El teléfono de Ignacio: su bloqueo «Sin avances en «Conciliación de cobros con el banco» desde hace 4 días» sale de Linear. Nadie lo escribió. |
| [m:ss] | 12. La conversación entre el agente de [Ignacio / Javiera] y el de [Catalina / Felipe]: [dijo que no puede / solo ofrece orientar] y no dio la razón. |
| [m:ss] | 13. El teléfono de [Catalina / Felipe]: [«Energía baja esta semana», que sale de Apple Health / «Energía baja hoy», que sale de su check-in]. Esa frase la ve solo [ella / él]. |
| [m:ss] | 14. [«Carga alta hoy», que sale de Google Calendar, Granola y Linear.] Su agente usa esas frases para decidir y a los otros agentes no les llega ninguna. |
| [m:ss] | [Solo en la variante V3] 14b. Catalina toca «Ahora no» y la propuesta queda «Descartada». |
| [m:ss] | 15. De 45 conversaciones posibles, los agentes tuvieron [N]. [La misma sala en el globo, con un arco por conversación. / La pantalla de la sala, si se grabó con `--sin-globo`.] |
| [m:ss] | 16. Qué fue real y qué fue actuado en esta grabación. |

Esta toma: variante [V1 / V2 / V3], [N] conversaciones y [N] propuestas ([estado de cada una]). La ronda tardó [NN] s reales y usó [NN] llamadas al modelo. Los dos mensajes de la conversación que se muestra están en `hiloElegido`, dentro de `diez-personas.json`.

## Qué es real y qué no

**Real**

- El producto: el frontend y el backend de `main`, sin cambios, corriendo en un computador.
- La línea para el agente, el canje del código, el repo y el permiso de cada archivo.
- El código de conexión de cada fuente: el inicio y la vuelta del permiso, el guardado cifrado del acceso, el formulario de la llave de Granola, la ruta de Apple Health, los conectores, los registros y las frases que salen de ellos.
- El check-in de Antonia, la pregunta «¿Pido ayuda con…?» y su «Permitir»: toques sobre el producto, en un marco del tamaño de un teléfono.
- Que una tarea de Linear detenida se vuelve un pedido sin que nadie lo escriba.
- La ronda: qué agente le escribe a cuál, cada respuesta y cada propuesta las escribió el modelo en esa toma. Nada de eso está guionado.
- Que el agente de [Catalina] recibió solo «disponibilidad: baja». Ningún mensaje entre agentes lleva horas de sueño ni reuniones: el código no las pone.

**Inventado o actuado**

- Las diez personas, sus repos, reuniones, correos, notas, tareas, commits, check-ins y horas de sueño. Salen de una lista escrita a mano (`tools/grabar/elenco2.mjs`). No son personas reales.
- No se conectó ninguna cuenta real de Google, GitHub, Linear ni Granola. Un proveedor simulado, dentro del servidor de demo, respondió cada llamada. Las cuentas `…@ronda.example` y los repos `ronda-demo/…` no existen.
- La pantalla de permiso es simulada. No es la de Google.
- El dato de Apple Health lo mandó el guion, en el mismo formato que manda el Atajo de un iPhone. No hubo iPhone.
- Un solo guion hizo de las diez personas y de sus asistentes. No corrió ninguna sesión de Claude Code, Codex, Cursor ni OpenClaw, y los textos «pegados» de ChatGPT, Grok, Claude y Gemini los escribimos nosotros.
- Nueve personas se crearon y se conectaron antes de grabar. En cámara solo entran a la sala. Sus aceptaciones las mandó el guion.
- El correo queda conectado y guarda asunto y remitente. Hoy no alimenta ninguna señal y ningún agente lo lee.
- La disponibilidad no se muestra en ninguna pantalla del producto. El video muestra las frases de donde sale y la respuesta del agente.
- En el globo, las cinco primeras caras son las ilustraciones del equipo, bajo nombres inventados. El globo se grabó quieto (movimiento reducido), para que no aparezca la marca «Listo», que es una animación y no un estado.

**Ediciones del video**

- El tramo de la ronda va acelerado ×6. La ronda tardó [NN] s reales; el reloj en pantalla los muestra.
- Las esperas con la pantalla quieta se cortaron a 1,2 s, y la recarga del teléfono después del permiso no se muestra.
- Tomas: se grabaron [N]. Esta es la toma [M]. En las otras, [qué pasó en cada una].

**El servidor de demo**

- Es `tools/grabar/servidor-demo.mts`, no el arranque del producto. Usa el mismo código y cambia cuatro cosas: las respuestas de los proveedores, la pantalla de permiso, la ronda automática de las 9:00 (apagada) y el modelo (fijo).
- Reintenta una vez una llamada al modelo que falla y hace una llamada de calentamiento al partir. El producto no hace ninguna de las dos.

**Con qué modelo y dónde**

- Claude Sonnet por la terminal (`claude`), [NN] llamadas. En `localhost`, no en producción. 50x sigue sin probarse.

Notas para llenar esta parte:

- El reloj en pantalla parte con el toque en «Iniciar ronda» y se detiene cuando el guion ve terminada la ronda. Ese número queda en `ronda.segundosEnPantalla`. `ronda.segundosReales` es lo que midió el producto entre el comienzo y el fin de la ronda, y puede ser hasta 2 s menor.
- `ronda.llamadas` son las llamadas al modelo durante la ronda. `ronda.servidor` trae el total del servidor desde que partió, con las fallidas y los reintentos.
- `ediciones.omitidos` es la cantidad de cuadros que no se muestran (la recarga después del permiso). Con `--permiso api` es 0.
- Si la toma se grabó con `--permiso api` o con `--sin-globo`, se dice aquí y se borra lo que no aplica. Las opciones usadas quedan en `opciones`, dentro del resumen.

## Cómo volver a grabar

Hace falta Node 22, `ffmpeg` y la terminal `claude` con sesión iniciada. Un solo proceso pesado a la vez: no se corre un ensayo junto con una toma, ni dos servidores.

```bash
nvm use
npm run build

# Las pruebas, sin servidor, sin navegador y sin modelo
node --test tools/grabar/tiempos2.test.mjs tools/grabar/preparar2.test.mjs
npx tsx --test tools/grabar/proveedor-demo.test.mts tools/grabar/servidor-demo.test.mts

# 1. El servidor de demo, con una carpeta de datos nueva y fuera del repo
DATA_DIR="$(mktemp -d)" PORT=8797 DEMO_COMMIT="$(git rev-parse --short HEAD)" npx tsx tools/grabar/servidor-demo.mts

# 2. Un ensayo: el guion completo con una ronda real, sin navegador y sin video
node tools/grabar/preparar2.mjs --ensayo

# 3. La toma. Antes se reinicia el servidor con otro DATA_DIR
node tools/grabar/grabar2.mjs --base http://localhost:8797 --out docs/demo/diez-personas.mp4 --frames "$(mktemp -d)" --capturas "$(mktemp -d)" --toma 1
```

Opciones de `grabar2.mjs`:

| Opción | Por defecto | Qué hace |
|---|---|---|
| `--base` | `http://localhost:8797` | Dónde está el servidor de demo. |
| `--out` | `docs/demo/diez-personas.mp4` | El video. Al lado deja el `.png` del último cuadro y el `.json` con el resumen. |
| `--frames` | una carpeta nueva en la carpeta temporal del sistema | Dónde quedan los cuadros. Tiene que estar vacía y fuera del repo. El guion no la borra. |
| `--capturas` | ninguna | Si se indica, deja una imagen por escena (`e01.png`, `e02.png`…) en esa carpeta, vacía y fuera del repo. |
| `--permiso` | `pantalla` | Con `api`, el guion autoriza Google por Antonia sin mostrar la pantalla de permiso, y lo dice en el registro. |
| `--sin-globo` | apagada | La escena 15 se queda en la pantalla de la sala. |
| `--parcial-vale` | apagada | Acepta la variante V3, en que el agente de Catalina solo ofrece orientar. |
| `--toma` | `1` | El número de la toma. Queda en el resumen. |
| `--max-segundos` | `170` | Si el video pasa de ese largo, no se arma y el resumen queda con `publicable: false`. |

Qué revisar antes de publicar una toma:

- El resumen dice `publicable: true`. Si dice `false`, `motivo` explica por qué: una puerta de la ronda no pasó, la grabación se detuvo o el video quedó muy largo.
- Una persona lee los dos mensajes de `hiloElegido`. Si la respuesta da una causa (sueño, cansancio, reuniones o agenda), la toma no se publica y se avisa como un hallazgo del producto.
- Cada imagen de `--capturas`: nada cortado por la barra de pestañas, ningún «Cargando…» y ningún link personal en pantalla.
- No se graba entre las 23:30 y las 00:30. Los datos del elenco se calculan con el día en que parte el servidor; después de medianoche se reinicia con un `DATA_DIR` nuevo.

Los prompts y el código del producto no se cambian para que la demo resulte. Si después de cuatro tomas ninguna variante es publicable, se detiene y se conversa.
