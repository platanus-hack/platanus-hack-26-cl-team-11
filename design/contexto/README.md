# Contexto personal · páginas de prueba

Prototipos en HTML (AGENTS.md regla 5). Todo son datos de prueba: ninguna app se conecta de verdad.
Reemplazan a los dos canvas de `/design` del 21-nov, que ya no se actualizan.

Se abren directo en el navegador, sin servidor:

| Página | Qué muestra |
|---|---|
| `resumen.html` | La semana del equipo como red: conversaciones entre agentes y lo que llegó a ti (escena con Stageshow, ver `REHEARSAL.md`), nueve comparaciones entre tú y la mediana del equipo, pulso del equipo con tu línea, y lo que comparte cada persona. |
| `conexiones.html` | Directorio de 21 apps por categoría, con buscador y filtros. «Conectar» abre la superficie de conexión. |
| `superficies.html` | Las cinco formas de conectar (cuenta, llave, Atajo, asistente, código QR) y los tres estados (conectando, recién conectada, ya conectada), lado a lado. |
| `mapa.html` | Esfera de puntos en 3D que gira y se inclina sola. Las apps y las cinco personas van sobre la esfera y derivan; las de atrás se desenfocan. Cada app conectada tiñe su zona; al llegar un dato, un punto viaja de la app a la cara de la persona. Se arrastra para girar. |

Enlaces directos para revisar un estado:

- `conexiones.html?abrir=whatsapp` abre esa superficie; `&paso=conectando` o `&paso=lista` fija el estado.
- `mapa.html?fuente=github` abre el mapa con esa app al frente; `?persona=ian` abre el de esa persona; `?still` lo deja quieto.
- `resumen.html?still` muestra el estado final sin la escena.

Archivos:

- `contexto.css`: superficies tranquilas (`cx-slab`, `cx-btn`, `cx-chip`). El relieve queda solo en el ícono de cada app (`cx-tile`) y en el botón principal. Usa los tokens de `../tokens.css`; el tinte de cada app va en `--tint`.
- `apps.js`: catálogo de apps (qué lee, qué nunca lee, forma de conectar) y la superficie de conexión.
- Íconos: `../sources/apps/`.

Reglas que salieron de las revisiones de Mati (21-nov):

- titulares de una sola frase simple, íconos reales de las apps, y bajo el nombre de una app va solo su último dato;
- los datos y gráficos muestran el efecto de red (tú frente a tu equipo, lo que hicieron los agentes), no seguimiento personal;
- no toda superficie lleva relieve;
- toda escena pasa por Stageshow (AGENTS.md regla 4).
