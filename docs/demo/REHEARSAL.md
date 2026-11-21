# Ensayo: «Diez personas, sus fuentes y sus agentes»

Bitácora de la segunda grabación. El guion y los contratos están en [`plan/`](plan/). Este archivo
se completa al filmar: tomas, puertas, lo que no se revisó.

Estado al 21-nov-2026, 15:25 (Santiago): **grabada**. [`diez-personas.mp4`](diez-personas.mp4), toma 2,
variante V2, 2 min 52 s. Lo filmó Claude en una sesión de Claude Code en la nube (4 CPU, sin GPU,
Node 22.23.5), sobre `b78e3ae`; el producto es el mismo de `298419a`.

## Hecho

| Paso | Resultado |
|---|---|
| Pruebas sin servidor (Node 22.23.1) | `proveedor-demo.test.mts` 11 de 11, `servidor-demo.test.mts` 15 de 15, `preparar2.test.mjs` 16 de 16, `tiempos2.test.mjs` 20 de 20 |
| Copia congelada en `50663e5` y `npm run build` | Construyó |
| Arranque del servidor de demo (`servidor-demo.mts`, puerto 8797) | Partió. Calentamiento del modelo: 2,6 s. `/demo/estado` responde, `rondaSola: false` |
| Ensayo 1 (`preparar2.mjs --ensayo`, HTTP real, modelo real) | Sin diferencias en las diez personas ni en la sala. Ronda lista en 26,1 s reales, 19 llamadas, 0 fallidas |

## Ensayo 1: qué decidió el modelo

Sala «Equipo Quillay», modelo `claude-sonnet-5-5` por la terminal.

| Conversación | Tema | Respuesta |
|---|---|---|
| Ignacio → Catalina | Conciliación de cobros con el banco | `parcial` |
| Antonia → Fernanda | guion y ensayo del pitch | `si` |
| Antonia → Nicolás | guion y ensayo del pitch | `si` |
| Javiera → Cristóbal | Animación en canvas | `si` |
| Javiera → Felipe | Animación en canvas | `parcial` |

Propuestas: Antonia con Fernanda y Nicolás; Ignacio con Catalina; Javiera con Cristóbal.

Puertas: G0 pasa, G1 pasa, G2 pasa, G2b pasa, **G3 falla sin `--parcial-vale`**: nadie respondió «no».

Los dos mensajes del hilo Ignacio → Catalina, tal como los escribió el modelo:

- Ignacio: «Hola, mi persona necesita ayuda con la conciliación de cobros con el banco, que lleva 4 días sin avances. Te escribo porque tú trabajas en conciliación de pagos y cobros; ¿puedes ayudar o indicar quién puede?»
- Catalina: «Hola, mi persona conoce la conciliación de cobros y puede orientar, pero no puede hacerse cargo de llevarla. Si nos cuentas qué se ha revisado y dónde está el bloqueo, puede darles ideas de por dónde seguir.»

La respuesta de Catalina no da ninguna causa (ni sueño ni reuniones). La de Felipe tampoco.

## Decisión D1

Con disponibilidad baja, el agente respondió «Puede orientar» las dos veces, no «No puede». Se filma
con `--parcial-vale` (variante V3): la leyenda dice «El agente de Catalina solo ofrece orientar. No
dice por qué» y Catalina responde «Ahora no» en su teléfono. No se cambia ningún prompt ni código del
producto para forzar un «no».

Es una sola ronda, no una tasa. La sonda corrió después, en la sesión en la nube (abajo).

## Sesión en la nube, 21-nov, 14:59 a 15:25

### Entorno

- Node 22.23.5. `npm install` en la raíz y en `.agents/skills/stageshow`. `ffmpeg` 6.1.1.
- La terminal `claude` responde: calentamiento del modelo 2 a 2,2 s en cada arranque del servidor.
- Chromium: `playwright-core` 1.48.2 pide el Chromium 1140 y la red no dejó bajarlo
  (`Download failure, code=1`). Se usó el Chromium 1243 que trae el contenedor (153.0.8010.12),
  enlazado donde lo busca Playwright. Funcionó: capturas, CDP y video.
- Pruebas: `proveedor-demo.test.mts` 11 de 11, `servidor-demo.test.mts` 15 de 15,
  `preparar2.test.mjs` 16 de 16, `tiempos2.test.mjs` 20 de 20. `npm run build` terminó.
  `design/lint.sh`: OK.

### Ensayo 2 (`preparar2.mjs --ensayo --parcial-vale`)

Ronda lista en 17,6 s reales, 19 llamadas, 0 fallidas. Piden exactamente Antonia, Ignacio y
Javiera. Catalina `parcial`, Felipe `no`, los otros tres `si`. Puertas G0, G1, G2, G2b y G3 pasan.
Variante **V2**. Felipe: «Felipe conoce animación en canvas, pero ahora no tiene disponibilidad
para hacerse cargo. Por ahora no puede ayudar a Javiera con esto.» Sin causa.

### Sonda (`ensayo-respuesta.mts --veces 6`, servidor apagado)

| Persona | Disponibilidad | no | parcial | si |
|---|---|---|---|---|
| Catalina | baja | 0 | 6 | 0 |
| Felipe | baja | 2 | 4 | 0 |

14 llamadas, 0 fallidas, 13 s de reloj. Según la tabla de `guion-final.md` 3.2: las dos casi
siempre `parcial`, así que V3 es lo esperable y V2 sale a veces. Ningún `si`.

**Hallazgo de producto**: en una de las seis respuestas de Felipe (la 4, `parcial`) el agente dice
«Hacerse cargo del trabajo no es posible ahora, porque su disponibilidad es baja». No da una causa
(ni cansancio ni check-in), pero sí nombra la disponibilidad, que el prompt pide no explicar. Ninguna
toma filmada tuvo esa frase.

### Escenario (AGENTS.md reglas 3 y 4)

Capturas de `escenario2.html` (normal, `?estado=ronda`, `?estado=cierre`) a 1920 × 1080, mirando
`design/reference.png` al lado: el mismo fondo con aura, vidrio y tipografía. Nada cortado. El rótulo
más largo probado (63 caracteres) mide 910 px de los 1.768 disponibles: uno de 70 cabe en una línea.

- `film.mjs --gate --width 1920`, normal y `?estado=ronda`, última línea tal cual:
  `rehearsal failed: 1 never-intentional line(s) above`. La línea es
  `uneven gutters: section.pantalla sits 24px from the left of div.rd-page, 616px from the right`.
- `?estado=cierre`: `rehearsal failed: 4 never-intentional line(s) above`, las cuatro
  `uneven gutters` de cada `li.rd-item` dentro de `section.cierre`.
- Las cinco salen de que el escenario tiene dos marcos lado a lado (sala y teléfono) y el cierre
  dos columnas: la regla espera una sola ventana por cuadro. No se cambió el escenario. Queda como
  falla declarada, no aprobada. La cobertura de las dos primeras corridas es `inconclusive`
  (huecos de muestreo de hasta 283 ms).
- `layout.mjs --width 1920 --select .escena`: `layout: no-issues-detected; this snapshot is not
  visual approval`, normal y cierre. El iframe no se inspeccionó por dentro.
- La pantalla de permiso se revisó dentro del teléfono de la toma (390 px): cabe entera, con
  «Pantalla de prueba», «Permiso de Google simulado», las dos filas y los dos botones.

### Tomas

| Toma | Opciones | Variante | Largo | Resultado |
|---|---|---|---|---|
| 1 | `--parcial-vale` | V2 | 431 s | No publicable: pasó de 200 s. Sin GPU, la lava de las caras corre por software y cada operación del navegador tarda unos 230 ms (7 ms sin WebGL, medido en la pantalla de la sala). No se armó el video. |
| 2 | `--parcial-vale --sin-webgl` | V2 | 172 s | **Publicada.** Ronda en 20 s reales, 19 llamadas, puertas G0 a G3 pasan. |

`--sin-webgl` se agregó a `grabar2.mjs` en `b78e3ae`. Sin WebGL las caras muestran su mezcla
quieta, con los ojos vivos; es el respaldo que ya tiene el producto. No se usaron `--permiso api` ni
`--sin-globo`: el toque en «Conectar Google Calendar» dentro del marco del teléfono funcionó en las
dos tomas, y el globo con diez personas y movimiento reducido no mostró la marca «Listo».

Revisión de la toma 2:

- `publicable: true`.
- Las 16 capturas de `--capturas`, una por una, y una hoja de contacto del mp4 (un cuadro cada
  4 s). Ningún «Cargando…», ningún link `/conectar/…` ni dirección de Apple Health. La escena 2
  muestra la línea `localhost:8797/a/…` del agente, como pide el guion: sirve una vez y se canjea
  en la misma escena.
- `hiloElegido` (Javiera → Felipe), leído entero: la respuesta de Felipe no da causa.
- El hilo de Ignacio es la conciliación («Conciliación de cobros con el banco»). Su propuesta,
  «Propongo que Catalina oriente a Ignacio de forma puntual en la conciliación de cobros con el banco,
  sin comprometer horas ni fechas», queda por aprobar.

Lo que se ve y no es perfecto:

- En las escenas 7, 10, 11 y 12 asoma bajo la barra flotante de pestañas el borde de la sección que
  sigue («Pulso», «Tablero», la última fila de la lista). Lo que la escena muestra queda siempre
  encima de la barra.
- En la escena 15 el globo queda en la mitad izquierda del marco y el teléfono, apagado, queda vacío.
- El puntero de la escena queda un momento sobre el texto después de cada toque.

### No revisado

- La pantalla de permiso a 390 px fuera de una toma (solo se vio dentro del teléfono).
- La toma con WebGL y la lava en movimiento: necesita un computador con GPU.
- `film.mjs` a 390 px: el escenario es de 1920 × 1080 y no se muestra en un teléfono.
- Una revisión de ojos frescos (`references/review.md` de Stageshow).
- Cuadro por cuadro completo: se miraron las 16 capturas, una hoja de 43 cuadros y tres recortes
  del teléfono a tamaño real, no los 3.554 cuadros.
