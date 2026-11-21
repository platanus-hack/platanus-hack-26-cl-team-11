# tools/grabar · las grabaciones de la demo

Guiones que graban el producto real dentro de un escenario (`design/demo/`) y dejan el video, la
captura final y un resumen en JSON en `docs/demo/`. Las personas son inventadas y un solo guion hace
de todas ellas y de sus agentes; el video lo dice en cada cuadro.

Hay dos grabaciones:

| Grabación | Estado | Guion | Escenario | Resultado |
|---|---|---|---|---|
| **Camino feliz**: sala, QR, agente, repo, ronda y globo, con personas al azar. | Grabada (1 min 34 s). | `grabar.mjs` + `personas.mjs` | `design/demo/escenario.html` | [`docs/demo/README.md`](../../docs/demo/README.md) |
| **Diez personas, sus fuentes y sus agentes**: una persona conecta sus fuentes (envío, cuenta, llave) y su asistente; diez personas conversan por sus agentes. | Grabada (2 min 52 s, toma 2, variante V2). | `grabar2.mjs` y el resto de los `*2` | `design/demo/escenario2.html` + `design/demo/permiso.html` | [`docs/demo/diez-personas.md`](../../docs/demo/diez-personas.md) |

## Archivos

**Camino feliz**

- `grabar.mjs`: graba el camino feliz. Elige sala, personas y agentes al azar.
- `personas.mjs`: las personas inventadas, las salas y qué agente usa cada una.

**Diez personas**

- `elenco2.mjs`: el elenco fijo de diez personas inventadas. Qué conecta cada una, qué responde por
  ella el proveedor simulado y qué debe decir el producto después. Cuentas `<id>@ronda.example`,
  repos en `ronda-demo`. Todas las fechas salen de la hora de arranque.
- `proveedor-demo.mjs`: proveedor simulado de Google, GitHub, Linear y Granola, dentro del mismo
  proceso. Nunca sale a la red. El acceso `demo-<id>` y la llave `grn_demo_<id>` son de mentira.
- `servidor-demo.mts`: el producto con cuatro diferencias declaradas: proveedores de
  `proveedor-demo.mjs`, pantalla de permiso `design/demo/permiso.html`, sin ronda automática y modelo
  fijo (Claude por la terminal, con un reintento). Además calienta el modelo al partir, responde
  `/demo/estado` y no vuelve a sincronizar fuentes cada 15 minutos.
- `preparar2.mjs`: todo lo que el guion hace por HTTP, sin navegador: abre la sala, crea y conecta al
  elenco, compara lo que dice el producto con lo esperado, corre la ronda y elige la variante.
  Nunca imprime una ficha: las rutas salen como `/api/people/…` y `/conectar/…`.
- `grabar2.mjs`: graba el video en el escenario 2. Opciones: `--permiso pantalla|api`,
  `--sin-globo`, `--sin-webgl` (computador sin GPU), `--parcial-vale`, `--toma N`,
  `--max-segundos N`. No borra nada.
- `tiempos2.mjs`: cuánto dura cada cuadro después de las ediciones declaradas (tramo acelerado,
  esperas con tope, cuadros que no se muestran) y en qué segundo parte cada paso.
- `ensayo-respuesta.mts`: sonda previa. Mide qué responden los agentes de Catalina y Felipe cuando
  su ficha dice «disponibilidad: baja». **Llama al modelo real**; la corre solo quien dirige la
  grabación. No cambia prompts.

**Escenario** (en `design/demo/`)

- `escenario2.html`: la pantalla de la sala, un teléfono y el registro del guion, lado a lado.
- `permiso.html`: pantalla de permiso simulada que reemplaza la del proveedor.

## Variantes y puertas de la segunda grabación

`preparar2.mjs` corre la ronda y decide qué se filma:

- **Puertas**: G0 (piden ayuda exactamente las personas esperadas), G1 (la ronda queda «lista», sin
  problema y sin conversaciones sin respuesta), G2 (alguien puede ayudar a Antonia), G2b (Antonia
  tiene el máximo de ayudantes), G3 (hay una variante válida).
- **Variantes**: V1, el agente de Catalina dice que no; V2, el de Felipe dice que no; V3, el de
  Catalina solo ofrece orientar (solo con `--parcial-vale`). Si una puerta falla, la toma es
  «retoma» y se vuelve a correr.

## Cómo grabar la segunda

```bash
npm run build
DATA_DIR=<carpeta nueva fuera del repo> PORT=8797 DEMO_COMMIT=$(git rev-parse HEAD) npx tsx tools/grabar/servidor-demo.mts   # terminal 1
node tools/grabar/preparar2.mjs --ensayo --base http://localhost:8797                                                       # ensayo, sin video
node tools/grabar/grabar2.mjs --base http://localhost:8797 --out docs/demo/diez-personas.mp4 \
  --frames <carpeta fuera del repo> --capturas <carpeta fuera del repo>                                                     # la toma
```

Cada ensayo y cada toma abren una sala nueva; usa un `DATA_DIR` nuevo. Necesita `ffmpeg`, el
Chromium de Playwright y las dependencias de `.agents/skills/stageshow` (de ahí sale Playwright).
Al terminar, llena los corchetes de `docs/demo/diez-personas.md` con `diez-personas.json`.

## Pruebas

Sin puerto, sin red y sin modelo:

```bash
node --test tools/grabar/preparar2.test.mjs tools/grabar/tiempos2.test.mjs
npx tsx --test tools/grabar/proveedor-demo.test.mts tools/grabar/servidor-demo.test.mts
```
