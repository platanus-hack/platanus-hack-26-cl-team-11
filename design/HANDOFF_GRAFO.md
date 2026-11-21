# Handoff: la visual del grafo de agentes

Para el agente que va a trabajar **solo en cómo se ve y se mueve el grafo**. Escrito el 21-nov-2026.

## Alcance

- **Sí:** cómo se dibuja, se ordena, escala y se anima el grafo, y el componente de frontend que lo dibuja.
- **No:** la lógica de los agentes, el backend, los conectores, las demás tarjetas de la pantalla,
  los tokens de color o tipografía, el texto de la interfaz. Si el grafo necesita un dato que no
  existe, usa datos de ejemplo marcados como tales y avisa; no toques el backend.

## Tu trabajo

Mati aprobó la dirección visual («me gusta») y dijo que **«el grafo necesita trabajo»**. No dijo
qué exactamente. Tu trabajo es llevar el grafo de un dibujo fijo a la pieza central de la demo.
Todo lo demás (tarjetas, colores, tipografía, layout) ya está cerrado y no se toca.

## Lee primero, en este orden

1. `AGENTS.md`: reglas 1 a 4. Son obligatorias.
2. `design/DESIGN.md`, completo. Sobre todo «Grafo de agentes (en trabajo)» y «Lo que no se hace».
3. `design/reference.html` abierto en el navegador, y `design/reference.png`.
4. `.agents/skills/stageshow/SKILL.md` y sus `references/motion.md` y `references/rehearse.md`.
   La regla 4 te obliga a usar esta skill para toda animación de demo: el grafo animado lo es.
5. `docs/DEMO.md`: el guion. El grafo aparece en los pasos 1, 2, 4 y 7.
6. `docs/VISION.md` y `docs/AGENT_MODEL.md`: la tesis O(n²) → O(1), y que los agentes conversan
   uno a uno (ya no hay coordinador).

## Cómo está hoy

- Vive solo en `design/reference.html`: un `<svg>` con rutas escritas a mano y cinco nodos puestos
  con porcentajes. No hay componente, no hay datos, no hay código en `frontend/`.
- Primitivas en `design/ronda.css`: `rd-graph`, `rd-node` (`--top`, `--right`, `--bottom`,
  `--left`), `rd-edge`, `rd-edge--live`, `rd-edge--glow`, `rd-edge--spark`, más `rd-face`,
  `rd-person` y `rd-chip`.
- El degradado de las líneas activas es un `<linearGradient id="rd-live">` definido dentro del
  SVG, con coordenadas fijas.
- En teléfono se achican las caras y se ocultan los estados y los chips.
- `design/motion/` tiene escenas en HTML de otra sesión (`chat`, `health`, `calendars`, `help`,
  `permission`). Al escribir esto estaban sin commitear y no las revisé: míralas antes de empezar
  para no duplicar ni pisar ese trabajo, y coordina con quien las hizo por el hilo de correo.
- `design/grafo-dirigido.mp4` es un video de apoyo de otra sesión con conversaciones sintéticas.
  No sigue esta dirección visual; sirve por el contenido, no por el look.

## Lo que ya está decidido (no lo cambies)

- Las personas son nodos con su cara (Vita Faces, `design/faces/`). Nombre y estado junto a la cara.
- Las conexiones son curvas delgadas, nunca rectas.
- Conexión en reposo: 1 px, gris translúcido. Conexión negociando: degradado, con halo y un punto
  de luz que la recorre.
- Sobre una conexión activa va un chip de vidrio con lo que se negocia, en pocas palabras.
- El grafo flota sobre el aura, sin caja alrededor.
- El degradado solo va en las conexiones activas. No en nodos, no en todas las líneas.

## Lo que está abierto (esto es lo tuyo)

1. **Disposición.** Hoy es un pentágono fijo. Tiene que salir de datos (lista de personas y de
   pares), no de coordenadas a mano.
2. **Escala.** El guion pide 5, 10, 50 y 300 personas: 10, 45, 1.225 y 44.850 líneas. Con 300 las
   caras no caben; hay que definir cómo se ve un nodo sin cara y cómo se ve la pantalla «cubierta».
3. **Estados y transiciones.** Reposo → negociando → acuerdo. Y el rearmado: alguien retira su
   disponibilidad y el plan se recompone en vivo. Ese es el momento más fuerte de la demo.
4. **Dirección de las conexiones.** `docs/DEMO.md` habla de flechas (quién le pide a quién) y de
   invertir una. Hoy las líneas no tienen dirección.
5. **Dónde vive.** Falta un componente real en `frontend/` (React + Vite) que use las primitivas.

Estos puntos no los cierres por tu cuenta. Para cada uno: haz una propuesta que se pueda ver
(una captura o una página), muéstrasela a Mati y espera su respuesta. Lo que apruebe se anota en
`design/DESIGN.md` § Grafo y en la tabla «Decisiones».

## Cómo trabajar con Mati en diseño

Esta sesión se equivocó cinco veces antes de acertar. Lo aprendido:

- **Mira tu resultado antes de mostrarlo.** Saca una captura con Chrome sin ventana y ábrela.
  Mati rechazó todo lo que se le mostró sin revisar.
- **Una propuesta por vez**, no tres variantes.
- No inventes referencias. Las suyas son: Apple (keynote bento, Apple Intelligence), Montu, y la
  pantalla de referencia. Dijo que no le gustan las inspiraciones de nicho.
- Rechazó por «tosco» una versión con líneas rectas grises, caras con aro grueso y una caja
  blanca alrededor del grafo. Fino significa: líneas delgadas, mucha luz, poco peso.
- Respuestas cortas y directas. Si una imagen lo explica, ábresela en pantalla
  (`open ruta.png`).

## Reglas técnicas

- **Look: `design/DESIGN.md`. Oficio de la animación: Stageshow.** Filma el grafo con sus scripts
  (`film.mjs --gate`, `jumps.mjs`) y revisa cada cuadro; deja el `REHEARSAL.md` que la skill pide.
  Si chocan, gana `DESIGN.md`.
- Colores, tipografías, pesos, degradados y sombras: solo tokens `--rd-*` de `design/tokens.css`.
  Si te falta uno, agrégalo ahí en un commit propio.
- Clases nuevas del grafo van en `design/ronda.css` con prefijo `rd-`, y se anotan en la tabla de
  primitivas de `design/DESIGN.md`.
- `design/lint.sh` tiene que pasar. Ojo: revisa los `.tsx`, así que los colores de un SVG en JSX
  también van por token (`stroke="var(--rd-edge-idle)"`) o por clase.
- No instales una librería de grafos con look propio. Una de solo cálculo de posiciones (por
  ejemplo d3-force) sí se puede, si el dibujo lo siguen haciendo las primitivas.
- Respeta `prefers-reduced-motion`. Una sola animación continua: la luz en las conexiones activas.
- Cada cambio: commit y push a `main` al tiro. Cada novedad para el equipo: respuesta en el hilo
  de correo «[Hack26] Hilo del equipo», que en este repo se envía sin pedir confirmación.

## Cómo verificar

```bash
# captura de la referencia (o de tu página)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --allow-file-access-from-files --window-size=1440,960 \
  --screenshot=/tmp/grafo.png "file://$PWD/design/reference.html"

design/lint.sh        # tiene que decir OK
npm run dev           # backend + frontend
npm run type-check
```

Pon tu captura al lado de `design/reference.png`: tienen que parecer la misma app. Prueba también
a 500 px de ancho. No des nada por verificado sin haber mirado la captura.

## Plazo

La hack cierra el domingo 22-nov-2026 a las 16:00 (Santiago).
