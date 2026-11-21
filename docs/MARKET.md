# Mercado de predicciones · Santiago 2026

El objetivo de esta sesión es cerrar una operación con ganancia en bananas después de comisiones. El registro incluye el saldo que confirma el servidor. Los precios publicados son marginales y la venta de una posición puede recibir menos que su valorización de pantalla.

## Bitácora del 21 de noviembre

| Hora UTC | Operación | Resultado |
|---|---|---|
| 13:59:39 | Compra previa del participante, team-11 | 284 acciones. La cartola compartida registra 9 bananas de costo, 991 disponibles y 1.000 de valor total. |
| 14:04 aprox. | Lectura autenticada de cartera | 991 en caja, 284 acciones de team-11 y 999 de valor total según el mercado. |
| 14:05:44 | Inicio del piloto | Observación de los 48 equipos con corte cada diez segundos. |

[Mercado del evento](https://hack.platan.us/26-cl/market)

## API local

Con Python 3, ejecutar `python3 tools/market/monitor.py`. El proceso consulta los 48 equipos en una sola lectura pública cada 10 segundos y guarda las observaciones en SQLite en el directorio local del usuario. Sirve JSON en `127.0.0.1:18726`.

- `/state` muestra precios, cantidades netas y antigüedad de la lectura.
- `/movers?seconds=60` ordena los equipos por variación y muestra el cambio de acciones de cada uno.
- `/history?team=team-11` devuelve hasta 2.000 observaciones locales.
- `/quote?team=team-11&side=buy&size=25` simula comprar con 25 bananas. Con `side=sell`, la cantidad se expresa en acciones. La estimación usa la curva LMSR y el redondeo de la interfaz. Para ejecutar importa la confirmación del servidor.

## Piloto de operaciones

Una sola posición nueva de hasta 25 bananas. El piloto observa entradas netas y busca un equipo cuyo precio haya subido al menos 12% en dos minutos, medido respecto de la mediana del mercado. Conserva la posición previa en team-11 hasta que liquidarla permita cerrar por encima de las 1.000 bananas iniciales. Para la posición nueva busca una ganancia realizada de dos bananas, con salida por caída estimada de cuatro bananas o por seis minutos transcurridos. Un salto de precio puede ampliar una pérdida. Termina al verificar al menos 1.001 bananas en caja sin posiciones, al cerrar ocho compras nuevas o al acumular una pérdida realizada de 12 bananas en el piloto.

La reproducción histórica de las 48 series públicas, desde la apertura hasta aproximadamente las 14:03 UTC, simuló 20 operaciones con +61 bananas en la primera mitad y 25 con +431 en la segunda después de aplicar la pausa de dos minutos entre lotes y excluir la posición previa. La mejor salida de la segunda mitad explica 278 bananas y la peor perdió 21. Esta comparación histórica siguió operando después de la primera ganancia. Para repetirla con datos nuevos, ejecutar `python3 tools/market/replay.py --refresh`. Usó una demora de entrada de diez segundos, comisiones redondeadas y la curva de liquidez. Supone que los demás participantes mantienen sus órdenes ante la compra simulada. Los resultados son hipotéticos y las salidas históricas presuponen ejecución al precio observado.

El proceso `python3 tools/market/pilot.py` usa el monitor local y un checkout dedicado de main. Pide la sesión mediante entrada oculta y registra las órdenes verificadas en [la bitácora](MARKET-ORDERS.md) tras cada cruce. La base SQLite y el registro de recuperación residen fuera de Git.

## Resultado del primer piloto

A las 14:13:44 UTC se compraron 2.501 acciones de team-42 por 24 bananas, comisión incluida. El historial publicó un precio de 0,010618 inmediatamente después de la compra y 0,006033 a las 14:13:45.945, antes de nuestra venta. La venta de las 14:13:50 devolvió 12 bananas. La pérdida realizada del lote fue de 12 bananas. La cartola quedó con 979 en caja y 284 acciones de team-11, valorizadas en 9. El piloto alcanzó su límite de pérdida y detuvo las compras. El monitor público sigue recolectando precios. Los comprobantes figuran en [órdenes verificadas](MARKET-ORDERS.md).

## Validación con demora de salida

Tras el movimiento de team-42, se evaluó una variante de 15 bananas con un intervalo adicional de diez segundos antes de ejecutar la salida y un límite de impacto propio del 30%. En las dos mitades históricas registró +10 en 17 operaciones y +11 en 14 operaciones. Una sola operación aportó +54 en la segunda mitad. Exigir una subida en dos minutos consecutivos dio −5 y −11. La evidencia aún es insuficiente para atribuir una ventaja estable a esa señal.

`python3 tools/market/forward.py` prueba la variante de 15 bananas contra las observaciones que llegan a partir de su arranque, con un intervalo de demora en cada lado. Lee la misma SQLite que el monitor y escribe las ventas simuladas en `forward.jsonl` junto a la base. Solo los recibos de la cartola del evento aparecen en la bitácora de órdenes verificadas.

Con `python3 tools/market/pilot.py --exits-only`, el piloto sigue cotizando las 284 acciones existentes y puede venderlas cuando el crédito neto lleve la caja a 1.001 bananas. Tras la primera pérdida, esto requiere recibir al menos 22 bananas en la venta. Este modo puede ejecutarse al mismo tiempo que la simulación.

## Pausa de operaciones · 14:17 UTC

Se detuvo toda ejecución de órdenes del piloto, incluida la venta automática de team-11. El registro quedó con dos recibos, una pérdida realizada de 12 bananas y 979 en caja. La posición previa de 284 acciones de team-11 sigue abierta. Continúan la lectura pública y la simulación local.

## Duelo de equipos

Dos jugadores comparan el rendimiento de dos equipos durante cinco minutos. Cada monedero recibe 100 fichas de juego. Una oferta reserva 10 fichas del creador. Al aceptarla, el rival aporta otras 10 y se fijan los dos precios iniciales. El ganador recibe las 20. Un empate, un cierre anticipado o la falta de cotización al vencimiento devuelve los aportes. Una oferta sin rival vence a los diez minutos. El enlace de una oferta permite invitar a otra persona desde su propio navegador.

La sala usa la lectura pública de los precios de la edición 26-cl. Las fichas y los recibos viven en SQLite de Ronda. La clave privada del monedero vive en el navegador donde se creó. Si se borran sus datos se pierde el acceso. Una transacción SQLite reserva o libera los aportes y registra el resultado. El servidor revisa los duelos activos cada ocho segundos y acepta una cotización de cierre en los primeros 45 segundos desde el vencimiento.

[Abrir la sala de duelos](https://ronda-n8if.onrender.com/duelos)

## Terminal de agentes

La terminal consulta el estado público de 26-cl y la serie de cada equipo directamente desde funciones de Vercel. `GET /api/terminal` entrega el instante del servidor en milisegundos, los precios marginales y el inventario neto por equipo. `GET /api/terminal?team=team-11` entrega treinta minutos de historia y el cambio relativo a cinco minutos.

Un agente puede enviar `POST /api/calls` con JSON `{"team":"team-11"}`. Recibe un comprobante firmado con los precios de entrada y el vencimiento. El rival toma el equipo de mayor precio entre los demás. `GET /api/calls?ticket=…` comprueba la firma y compara los rendimientos relativos con el último precio publicado hasta el vencimiento. Espera hasta que ambas series cubran ese instante. El comprobante es compartible y el mismo resultado se puede recalcular desde el historial del evento. Las llamadas son pronósticos sin apuestas ni comisiones.

[Terminal pública](https://duelos-platanus-26.vercel.app/terminal) · [Guía para conectar un agente](https://duelos-platanus-26.vercel.app/agent.md)

La mesa actualiza los 48 equipos cada diez segundos. El cambio y el flujo neto de la tabla parten de la primera observación de la sesión. El flujo agrupa el cambio de inventario entre lecturas, que puede contener varias operaciones. El gráfico muestra los últimos treinta minutos del equipo seleccionado. Si cae la fuente, la mesa indica la antigüedad de la lectura y suspende la apertura de pronósticos.

El archivo tiene 21 rondas reconstruidas con las series públicas del 21 de noviembre. Cada quince minutos se eligen dos candidatos usando solo datos disponibles en ese instante. Impulso toma el mayor retorno de los cinco minutos anteriores. Favorito toma el mayor precio entre los demás equipos. El resultado se evalúa cinco minutos después. El navegador guarda los aciertos y compara ambos agentes en las mismas rondas. Para jugar por HTTP se consulta `GET /api/replay?round=1` y se envía la elección con `POST` al mismo recurso. El archivo sigue jugable durante una caída de la fuente.

Para regenerarlo, descarga los datos con `python3 tools/market/replay.py --refresh` y ejecuta `python3 tools/market/build_rounds.py`. Para publicar, usa Node 22 y `tools/market/build_web.sh <directorio-de-staging>` desde el repo. En ese directorio enlaza el proyecto Vercel `duelos-platanus-26` y ejecuta `vercel deploy --prod`. La variable sensible de producción `CALL_SECRET` conserva la validez de los comprobantes entre despliegues.

La ruta anterior de duelos usa el libro SQLite de Render. La prueba local de cinco minutos dejó 110 y 90 fichas en los dos monederos. Los monederos se guardan por origen web. La terminal, el archivo y los pronósticos firmados funcionan en Vercel con lecturas públicas de Platanus.

El archivo también admite pronosticar empate con `{"team":"tie"}`. Dos equipos que conservan la misma proporción de precios pueden moverse juntos cuando se negocia un tercero. La misma tolerancia absoluta de 1e-9 en la diferencia de rendimientos se usa para pronósticos en vivo e históricos. El marcador solo acredita la elección que coincide con el resultado.

### Verificación pública · 14:36 UTC

El pronóstico de prueba se fijó a las 14:31:35 UTC. Al vencer a las 14:36:35, team-11 registró −7,10% y el favorito team-9 +33,53%. La API devolvió `settled` y `winner=rival`. La última observación de ambas series anterior al cierre fue de las 14:34:33.500 UTC. Una lectura independiente de esas dos series reprodujo ambos rendimientos. Se verificaron también el comprobante compartido entre dos navegadores, la selección y seguimiento de equipos, la resolución de una ronda histórica y el archivo jugable con la fuente en pausa. La prueba usó pronósticos sin gasto de bananas.

## Inventario en equipos baratos · 14:45 UTC

El historial público trae un punto por operación. La variación de precio de cada punto identifica el equipo y la cantidad, así que la cinta completa se puede reconstruir: 627 operaciones hasta las 14:38 UTC. La cinta muestra por qué perdió el piloto de impulso. Otros participantes mantienen lotes chicos en los equipos baratos y los venden uno o dos segundos después de cada compra fuerte. La compra del piloto en team-42 a las 14:13:44 fue seguida un segundo después por la venta de 6.839 acciones que alguien había comprado a las 12:05.

`tools/market/inventory.py` opera desde ese lado. Compra un lote de 20 bananas en cada uno de los equipos más baratos, hasta 300 bananas en total, y vende el lote completo cuando la venta neta supera su costo en 50% y en al menos 4 bananas. No compra team-11 ni vende esa posición. Lee los precios por el socket público del sitio (`tools/market/feed.py`), que entrega cada operación en unos 100 ms, y concilia con la cartola cada dos minutos.

Reproducción sobre la cinta con ese tope de 300 bananas, comisiones y redondeo incluidos, con un segundo de demora antes de cada venta:

| Inicio UTC | Ventas | Ganancia realizada | Inventario al final, costo → venta neta |
|---|---:|---:|---|
| 11:00 | 25 | +958 | 285 → 304 |
| 12:00 | 33 | +888 | 285 → 340 |
| 13:00 | 7 | +110 | 285 → 342 |
| 13:30 | 7 | +88 | 285 → 340 |
| 14:00 | 0 | 0 | 285 → 276 |
| 14:15 | 0 | 0 | 285 → 285 |

Con tres segundos de demora, el inicio de las 13:00 baja a +34. Ninguna venta simulada cerró bajo su costo. La ganancia depende de que alguien compre fuerte un equipo barato: entre las 14:00 y las 14:38 no hubo ninguna compra así en los 15 equipos más baratos. El inventario sin vender baja de valor si el grupo barato baja, cuesta cerca de 1,5 bananas por lote liquidarlo y vale cero al cierre salvo que ese equipo gane. La reproducción supone que los demás participantes repiten sus órdenes. Son resultados hipotéticos.

`python3 tools/market/inventory.py --paper` simula las órdenes contra los precios en vivo, sin sesión, y escribe en `paper-orders.jsonl`. Sin `--paper` pide la sesión por entrada oculta, opera y escribe los recibos en `inventory-orders.jsonl`. Los límites se leen de `inventory.json` en el mismo directorio local mientras el proceso corre: `{"buying": false}` detiene las compras y `{"liquidate": true}` vende todo el inventario salvo team-11. Crear `inventory.stop` detiene el proceso y deja las posiciones como están.

El [reglamento del juego](https://hack.platan.us/26-cl/market/bases) dice que las bananas no son transferibles entre participantes y prohíbe la colusión, las cuentas múltiples, la manipulación de la plataforma y el intercambio de bananas por dinero o favores, con descalificación inmediata. Este proceso usa una sola cuenta y las mismas órdenes que la página.
