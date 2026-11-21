# Ensayo de las cinco escenas de Ronda

Cada enlace abre una escena independiente. Descarga el HTML y ábrelo en un navegador. El archivo contiene el reproductor, las caras, el favicon y los estilos. Todos los ejemplos usan datos simulados.

| Escena | Referencia de Stageshow | Secuencia ensayada |
|---|---|---|
| [Chat](chat.html) · 12 s | `messages` | Pregunta → viaje → respuesta → intercambio completo junto a los agentes. |
| [Calendarios](calendars.html) · 11 s | `calendar` | Dos agendas sobre la misma escala → ambos libres a las 10:30 → propuesta de media hora. |
| [Salud](health.html) · 12 s | `chart-scrub` | Lectura privada del sueño → consulta de otro agente → respuesta «Ese dato es privado». |
| [Permisos](permission.html) · 12 s | `share` y `messages` | Destinatario y frase → aprobación de un solo uso → recepción limitada a actuar. |
| [Ayuda](help.html) · 12 s | `payout-flow` | Pedido → oferta → dos aceptaciones independientes → presentación. |

La primera imagen es la referencia de Ronda. Las otras cinco muestran el resultado que queda en pantalla cuando termina cada escena.

![Referencia de Ronda junto a los cinco estados finales](rehearsal.jpg)

## Verificación

- En Chrome sobre macOS, las cinco escenas pasaron los tres ensayos de `film.mjs --gate` por pieza, en 1280 px, en 390 px y por estados. El resultado de los quince fue `rehearsal passed`.
- Algunas hojas de contacto registraron intervalos sin muestras mientras Chrome capturaba imágenes. Se comprobó el movimiento por separado con `jumps.mjs`, con cobertura completa de 12,5 s por escena. Se revisaron además el viaje de la respuesta y el cambio del botón de permiso a intervalos de 80 ms.
- `layout.mjs --strict` verificó los controles y los márgenes de las cinco páginas en ambos anchos. Una revisión visual independiente detectó texto detrás de una cara, burbujas al borde del recorte y controles fuera de la primera pantalla del teléfono. Se corrigieron y se volvió a revisar el permiso completo a 390 × 844.
- Cada archivo se probó por separado desde disco, con Chrome sin red. Se comprobó la carga de imágenes y favicon, navegación con teclado, pausa en el mismo cuadro, reinicio y cambio de preferencia de movimiento. Con movimiento reducido se abre el resultado final y se puede reproducir manualmente. Stagehand también abrió cada HTML en un navegador local y comprobó pausa y reinicio.
- Pasaron `design/lint.sh` y el chequeo de tipos del kit. La revisión móvil usó emulación de Chrome. Safari y teléfonos físicos quedan fuera de esta verificación.

## Regenerar y ensayar

Desde la raíz del repositorio:

```sh
npm ci --prefix .agents/skills/stageshow
python3 design/motion/src/build.py
design/lint.sh
```

El generador incorpora la versión instalada de Stageshow y su licencia en cada HTML. Usa las primitivas, el logo, los tokens y las caras de Ronda. Los guiones y controles de tiempo están en `src/player.jsx`. Para repetir el ensayo de una pieza, cambia `chat.html` en estos comandos.

```sh
page_url="file://$PWD/design/motion/chat.html"
skill_dir=".agents/skills/stageshow"
node "$skill_dir/scripts/film.mjs" "$page_url" --gate --width 1280 --every 1700 --count 8 --out /tmp/ronda-wide.png
node "$skill_dir/scripts/film.mjs" "$page_url" --gate --width 390 --every 1700 --count 8 --out /tmp/ronda-mobile.png
node "$skill_dir/scripts/film.mjs" "$page_url" --gate --states --states-for 12600 --out /tmp/ronda-states.png
node "$skill_dir/scripts/jumps.mjs" "$page_url" --ms 12500
node "$skill_dir/scripts/layout.mjs" "$page_url" --width 390 --strict
```
