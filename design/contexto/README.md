# Contexto personal · páginas de prueba

Prototipos en HTML (AGENTS.md regla 5). Todo son datos de prueba: ninguna app se conecta de verdad.
Reemplazan a los dos canvas de `/design` del 21-nov, que ya no se actualizan.

Se abren directo en el navegador, sin servidor:

| Página | Qué muestra |
|---|---|
| `resumen.html` | Panel bento de la semana: fila de cifras (reuniones, reuniones transcritas, WhatsApps respondidos, correos, pulso en reposo, commits), código, salud, reuniones y comparaciones con el equipo. |
| `conexiones.html` | Directorio de 21 apps por categoría, con buscador y filtros. «Conectar» abre la superficie de conexión. |
| `superficies.html` | Las cinco formas de conectar (cuenta, llave, Atajo, asistente, código QR) y los tres estados (conectando, recién conectada, ya conectada), lado a lado. |
| `mapa.html` | Esfera de puntos en 3D. Cada app conectada tiñe su zona; al llegar un dato, la zona se enciende y un punto viaja al centro. Se arrastra para girar. |

Enlaces directos para revisar un estado:

- `conexiones.html?abrir=whatsapp` abre esa superficie; `&paso=conectando` o `&paso=lista` fija el estado.
- `mapa.html?fuente=github` abre el mapa con esa app al frente; `?still` lo deja quieto.

Archivos:

- `contexto.css`: las piezas chunky (`cx-slab`, `cx-tile`, `cx-btn`, `cx-chip`). Usa los tokens de `../tokens.css`; el tinte de cada app va en `--tint`.
- `apps.js`: catálogo de apps (qué lee, qué nunca lee, forma de conectar) y la superficie de conexión.
- Íconos: `../sources/apps/`.

Reglas que salieron de la revisión de Mati (21-nov): titulares de una sola frase simple, íconos reales de las apps, y bajo el nombre de una app va solo su último dato.
