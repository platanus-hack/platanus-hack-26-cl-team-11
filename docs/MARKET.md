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

La sala usa la lectura pública de los precios de la edición 26-cl. Las fichas y los recibos viven en SQLite de Montu. La clave privada del monedero vive en el navegador donde se creó. Si se borran sus datos se pierde el acceso. Una transacción SQLite reserva o libera los aportes y registra el resultado. El servidor revisa los duelos activos cada ocho segundos y acepta una cotización de cierre en los primeros 45 segundos desde el vencimiento.

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

## Inventario en equipos baratos · 14:42 UTC

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

### Simulación en vivo · 14:47 UTC

`inventory.py --paper` partió a las 14:41 UTC con el tope de 300 bananas. Entre las 14:44:20 y las 14:45:20 simuló 15 compras de 20 bananas, a 19 bananas cada una. A las 14:46:32 alguien empezó a comprar team-10 de a 10 bananas, una orden por segundo. La simulación vendió el lote de team-10 a las 14:46:37, 50 ms después de la sexta orden: 30 bananas netas contra 19 de costo. El precio siguió hasta 0,0166 a las 14:46:49. Es una venta simulada: las acciones no estaban en el mercado y nadie pudo vender antes.

Se comparó vender apenas se cruza el umbral contra esperar a que el precio deje de subir. Sobre la cinta, con inicios entre las 11:00 y las 13:45, la espera dio entre −23 y +12 bananas respecto de la venta inmediata. El proceso conserva la venta inmediata.

### Herramientas de la cinta · 14:51 UTC

`python3 tools/market/tape.py --refresh` descarga los 48 historiales públicos, reconstruye cada operación y la guarda en `tape.jsonl` junto a la base local. A las 14:50 UTC la cinta tenía 663 operaciones: 559 compras por 52.653 bananas y 104 ventas por 17.817.

`python3 tools/market/backtest.py` repite sobre esa cinta las reglas de `inventory.py` desde un inicio cada 30 minutos. Acepta `--clip`, `--budget`, `--gain` y `--delay`. Con los valores del proceso en vivo, el inicio de las 14:00 no vendió nada y el de las 14:30 cerró dos ventas por +23.

## Bolsa de derivados

La bolsa opera un libro compartido de órdenes limitadas con fichas propias y una billetera inicial de 1.000 fichas por clave. Se pueden crear nueve tipos de contrato sobre los equipos de 26-cl. Hay binarias de precio objetivo, calls, puts, futuros lineales, futuros amplificados, rangos, carreras entre equipos, mariposas y straddles. Cada contrato publicado fija por adelantado sus términos, hora de vencimiento y escala de pago. El participante puede abrir o cerrar exposición mediante órdenes que se cruzan con otro jugador o con la mesa de demostración. Cada cruce inmoviliza la garantía necesaria para financiar los dos pagos complementarios hasta 100 fichas por contrato.

[Abrir la bolsa](https://duelos-platanus-26.vercel.app/bolsa) · [Referencia del agente y ejemplos con curl](https://duelos-platanus-26.vercel.app/exchange.md)

El libro cruza por precio y orden de llegada. Admite ejecución parcial, mejora del precio, cancelación del remanente y recuperación del mismo recibo al reintentar con un nonce. El registro usa un Blob privado de Vercel por edición. Cada actualización lee el origen sin caché ni compresión y escribe con el ETag fuerte de esa lectura. Un conflicto obliga a repetir la transacción sobre el estado más reciente. Las claves de los jugadores permanecen en sus navegadores o en sus agentes. El registro guarda únicamente su hash. El proyecto Vercel ejecuta una revisión por minuto los días 21 y 22 de noviembre. Un límite de fecha en el servidor acota el trabajo a esta edición y su ventana de cierre. Las consultas públicas también activan la revisión.

Cada tipo cuenta con una mesa de demostración, dotada una sola vez con 1.000 fichas. Al abrir una serie horaria publica hasta tres contratos a cada lado según su saldo disponible. Estima el pago inicial en cinco escenarios de precio igualmente ponderados (−20%, −8%, sin cambio, +8%, +20%). En carreras combina los cinco escenarios de ambos equipos. Abre un margen de tres fichas a cada lado de esa referencia, sujeto a los límites del libro. Todos los jugadores pueden tomar esas cotizaciones. Un contrato creado por un participante se puede compartir por enlace y parte con las órdenes que sus contrapartes decidan poner.

El oráculo toma el último precio publicado hasta el vencimiento y exige que el historial cubra ese instante. El servidor registra el precio, las marcas de tiempo, el pago largo y el abono de cada monedero. Si durante una hora desde el primer intento fallido el historial sigue sin permitir la verificación, se anula el contrato y se devuelven los aportes. Al anular también se revierten las diferencias contingentes de las posiciones ya compensadas. Los resultados estimados en la cartera usan punto medio, último cruce o costo al abrir la posición, en ese orden.

Para desplegar se usa el mismo script de la terminal con el proyecto Vercel de la sala. La bolsa requiere un almacén Vercel Blob privado conectado a producción. El manifiesto y el lockfile del directorio web fijan la versión del cliente. Las credenciales se leen desde las variables del despliegue. Las pruebas de caja, órdenes y oráculos se ejecutan con `npm test`.

### Primer contrato verificado en producción · 14:53 UTC

Dos billeteras nuevas recibieron 1.000 fichas cada una. En el contrato de team-11 con objetivo de 2,74%, la primera publicó una venta de tres unidades a 44. La segunda envió dos veces en paralelo la misma compra de dos con límite 51. Se registró un único cruce, `f17`, por dos a 44. La primera billetera canceló la unidad restante y recuperó 56 fichas de reserva. Al vencimiento, la última cotización publicada fue 2,699064%, equivalente a 270 puntos base. La binaria pagó 0 al comprador y 100 por unidad al vendedor. Los saldos finales fueron 912 y 1.088. Consultar las dos series de datos por separado (libro y fuente de Platanus) reprodujo el precio y los abonos.

[Contrato liquidado y evidencia de cierre](https://duelos-platanus-26.vercel.app/bolsa?marketId=px-0672a60fddd538ab4158f2bf)

## Inventario en vivo · 14:57 UTC

`inventory.py` partió con sesión a las 14:51 UTC y leyó 979 bananas en caja. Entre las 14:54:21 y las 14:55:25 compró 15 lotes de 20 bananas. Cada uno costó 19, igual que la cotización. Caja: 694. Los 15 recibos están en [órdenes verificadas](MARKET-ORDERS.md), donde la columna de valor total queda vacía para estas filas.

En 8 de los 15 equipos otro participante vendió entre 5.652 y 7.871 acciones dentro de los 20 segundos siguientes a nuestra compra. Esos equipos (12, 22, 41, 48, 34, 6, 20 y 19) bajaron de cerca de 0,0090 a cerca de 0,0051. Las cantidades vendidas en team-12, 22, 41 y 6 coinciden con lotes comprados a las 12:04 con órdenes de 33 bananas. Nuestra compra de 20 bananas sube el precio cerca de 20% y eso bastó para cruzar el umbral de venta de ese participante. La reproducción sobre la cinta no modela esa reacción.

A las 14:56 UTC los 15 lotes se podían vender por 197 bananas contra 285 de costo. No hay ventas ni pérdida realizada. Las compras nuevas quedaron en pausa con `{"buying": false}`. Las ventas siguen activas.

## Análisis de mercado · 15:07 UTC

Cuatro analistas de solo lectura trabajaron sobre la cinta de 663 operaciones, la tabla de posiciones y el reglamento. No hicieron órdenes ni consultas al sitio. Sus cifras son reproducciones hipotéticas. Dos de ellas se comprobaron aparte sobre la misma cinta y coinciden: la venta ajena más rápida tras una compra fuerte tardó 1,45 segundos, y los lotes de 33 bananas se vendieron cuando su venta ya valía 1,68 veces su costo o más.

**Competencia.** Un participante compró lotes de 33 bananas en 22 equipos baratos a las 12:04 y vende el lote entero entre 1,45 y 2,56 segundos después de una compra que lo deje en cerca de 1,65 veces su costo. Es quien vendió sobre 8 de nuestras 15 compras. A las 14:59 recompró esos 8 equipos a 0,0051 con órdenes de 33. Otro participante compra los equipos baratos en orden de precio, uno por segundo, y más tarde vende el 40% de cada posición. De 11 ventas ajenas dentro de los 5 segundos siguientes a una compra fuerte, ninguna llegó antes de 1,45 segundos. Nuestro proceso reacciona en unos 0,3.

**Predicción.** Ninguna característica del equipo predice cuál será comprado: nombre, integrantes, compras previas o caja de sus miembros. Las compras de 400 bananas o más bajaron de unas 9 por hora a 1 por hora desde las 13:00. Las de 50 a 399 subieron a unas 19 por hora.

**Reglas.** Ningún ajuste elegido con las operaciones anteriores a las 13:00 superó a los valores actuales al medirlo después de las 13:00. El único factor que mejora en ambos tramos es cubrir más equipos. La ventaja decae: un inicio a las 14:00 no vende nada.

**Cierre.** El reglamento premia a quien tenga más bananas al cierre «conforme a las predicciones acertadas». No dice cuánto paga cada acción ni a qué hora cierra. Si solo paga el equipo ganador, casi todos los participantes que hoy están arriba quedan en cerca de 1 banana, porque tienen todo en un equipo. Con 979 en caja el modelo da cerca de 99% de quedar dentro del 40% superior. Con 300 bananas de inventario sin vender al cierre da entre 20% y 30%. Seis rivales tienen más de 979 en caja.

### Decisiones

- El umbral de venta del proceso en vivo bajó de 50% a 30% sobre el costo, con un mínimo de 5 bananas. Así vende justo antes del umbral del participante de los lotes de 33.
- Las compras siguen en pausa en el proceso que corre.
- La versión nueva de `inventory.py` lee `trader.json`. Vende todo el domingo a las 15:00 UTC, o 45 minutos antes de un cierre publicado, y no compra en los 90 minutos previos. Con `cheap` bajo 1 compra solo equipos que cayeron bajo esa fracción de la mediana, que es donde otro acaba de vender. Acepta listas `only`, `skip` y `sell`, y guarda la cinta del socket en `feed-tape.jsonl`. Al partir releva al proceso anterior mediante `inventory.stop`.
- No se hacen compras pensadas para activar la venta de otro participante.

## Primera venta y segunda ronda de análisis · 15:30 UTC

A las 15:24:00 UTC alguien empezó a comprar team-34 con órdenes de 10 bananas, una cada 0,6 segundos. El proceso vendió nuestro lote a las 15:24:07, después de la octava orden: 25 bananas netas contra 19 de costo, +6. La racha siguió 12 órdenes más, hasta 0,0217. El participante de los lotes de 33 vendió el suyo a las 15:24:18, 1,4 segundos después de la última orden, por 88 bananas. Vender al cruzar el umbral dejó cerca de 15 bananas sin cobrar.

Cinco analistas de solo lectura revisaron por qué no hay más ganancia. Sus conclusiones:

- En la última hora no hubo ninguna compra de 400 bananas o más. Las compras fuertes fueron a los equipos caros: 11 de 19. En los baratos hubo 3.
- Entre las 14:20 y las 15:11 solo cuatro participantes aumentaron su caja. Las subidas grandes de la tabla son posiciones en team-9 valorizadas, sin vender.
- Comprar un equipo después de su primera compra grande no paga: −18, −22 y −59 bananas con entradas de 20, 50 y 100 en 14 casos.
- Mantener el equipo que va primero durante 30 a 120 minutos perdió en 9 de 11 inicios.
- Comprar un equipo que otro acaba de botar bajo 0,7 veces la mediana rindió cerca de +12 por lote en 8 casos. Es poco dinero y es la única regla adicional que se sostiene.
- La aritmética del proceso coincide con todos los recibos. La auditoría encontró cinco fallas que podían detenerlo: un error pasajero del sitio lo daba por sesión terminada, la conciliación podía pisar una orden recién ejecutada, un archivo de detención viejo lo cerraba al partir, una venta rechazada se reenviaba sin pausa y una compra de resultado incierto quedaba con costo equivocado.

### Cambios en `inventory.py`

- Mientras otros siguen comprando un equipo con órdenes chicas, el proceso espera. Vende cuando pasan 0,8 segundos sin compras (`quiet`), cuando alguien más vende, o de inmediato si la compra fue de 30 bananas o más (`strong`).
- El umbral de venta quedó en 20% sobre el costo con un mínimo de 4 bananas.
- `guard` y `patience`: si la caja más el valor de venta del inventario se mantiene bajo 912 durante 10 minutos, vende todo. Hoy esa suma es 943.
- Las cinco fallas de la auditoría quedaron corregidas.

## Ganancia realizada · 16:13 UTC

Entre las 15:28 y las 16:00 UTC volvieron las compras grandes: 49 operaciones de 140 bananas o más y 141 operaciones en los diez minutos más activos. El proceso cerró 11 ventas con ganancia por un total de +277 bananas. Las mayores:

| Equipo | Compra | Costo | Venta | Recibido | Ganancia |
|---|---|---:|---|---:|---:|
| team-34 | 15:47:41, justo después de una venta ajena de 627 que lo dejó en 0,0041 | 19 | 15:48:40, tras una compra ajena de 329 | 110 | +91 |
| team-2 | 14:54:49 | 19 | 15:42:30, un segundo después de una compra ajena de 492 | 91 | +72 |
| team-20 | 14:55:20 y un segundo lote tras una caída | 38 | 15:56:57, tras una compra ajena de 197 | 93 | +55 |

Las otras ocho ventas dejaron entre +4 y +14 cada una. Todas están en [órdenes verificadas](MARKET-ORDERS.md).

A las 16:11 UTC Mati aprobó subir el tope de inventario de 300 a 500 bananas para cubrir más equipos baratos. El proceso compró 11 lotes más. A las 16:13 la cartola mostraba 762 en caja y 21 lotes que costaron 494 y se podían vender por 362. La tabla del evento marcaba 1.214 en total, puesto 15 de 84, con el corte del 40% superior en el puesto 34 con 990. La partida empezó en 979.

## Apuestas Sí / No

La portada muestra preguntas, su hora de cierre y el precio de cada lado. Al elegir una respuesta, el jugador ve el costo y el pago si acierta antes de confirmar. La instrucción `bet` exige que el libro pueda ejecutar toda la cantidad dentro del precio máximo de ese lado. Los instrumentos de la bolsa anterior siguen disponibles en la vista avanzada.

[Apuestas](https://duelos-platanus-26.vercel.app/bolsa) · [Vista avanzada](https://duelos-platanus-26.vercel.app/avanzado)

### Sesiones de agentes

Desde su navegador, el jugador puede dar a un agente acceso de lectura o acceso para apostar, poner órdenes y cancelarlas en su propia billetera. El token de sesión se muestra al crearlo. El registro privado conserva su hash, alcance, vencimiento y billetera propietaria. El jugador puede revocarlo. Por defecto dura cuatro horas o hasta que cierre el evento, lo que ocurra primero. La clave original permanece en el navegador. La bolsa y sus agentes consultan los precios públicos del evento.

[Conectar un agente](https://duelos-platanus-26.vercel.app/agentes)

### Panel del organizador

En el Mac del organizador, ejecutar `python3 tools/market/owner.py` abre el panel y copia la clave para pegarla en el formulario de acceso. `python3 tools/market/owner.py stats` devuelve los contadores por consola. La clave de producción está en el estado privado local del organizador. Vercel recibe su hash mediante la variable sensible `EXCHANGE_OWNER_KEY_SHA256`. Las páginas de jugadores y agentes comparten únicamente enlaces públicos.

El panel cuenta navegadores o billeteras activos en cinco minutos y billeteras con al menos una ejecución en quince minutos. También muestra visitantes y operadores en veinticuatro horas, conexiones de agentes, órdenes abiertas y actividad acumulada. Un navegador que abre una billetera cuenta una vez. Los integrantes de una misma billetera aparecen juntos. El número de visitantes depende de los dispositivos y del uso de los identificadores de presencia. Los datos no permiten contar personas exactas. Los contadores de cruces usan el libro real y excluyen las mesas de demostración como jugadores.

El organizador puede publicar preguntas Sí/No con regla, fuente y cierre visibles. Solo se pueden resolver después del cierre. Sí, No y anulación llevan motivo público y un comprobante definitivo. Si pasan veinticuatro horas desde el cierre sin decisión, se devuelven los aportes. Los contratos creados con oráculo de precios conservan su liquidación automática con el historial de Platanus.

### Verificación del 21 de noviembre, 13:23 de Santiago

La portada pública mostró seis preguntas abiertas. En terreno, una billetera de prueba de esta bolsa partió con 1.000 fichas. Un agente compró una participación de Sí por 63 fichas en `px-c410754d761077b51c2d489d`. Repetir el envío con el mismo nonce produjo el mismo recibo, un único cruce y saldo 937. El token de lectura recibió 403 al intentar la apuesta. Tras revocar los dos tokens de prueba, ambos recibieron 401. Esta ejecución cuenta en el panel de actividad.

En Chrome se verificaron el gráfico móvil, el formulario de apuesta, las páginas de agentes y organizador, el acceso privado a los contadores y el libro avanzado. El servidor respondió 401 al pedir el panel sin la clave de organizador. La creación y la decisión de preguntas de Mati se probaron con almacenamiento local aislado, incluido el reembolso por decisión vencida. Pasaron 179 pruebas del backend y 44 del mercado.
