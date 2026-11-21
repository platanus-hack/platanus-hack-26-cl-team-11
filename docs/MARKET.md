# Mercado de predicciones · Santiago 2026

El objetivo de esta sesión es cerrar una operación con ganancia en bananas después de comisiones. El registro incluye el saldo que confirma el servidor. Los precios publicados son marginales y la venta de una posición puede recibir menos que su valorización de pantalla.

## Bitácora del 21 de noviembre

| Hora UTC | Operación | Resultado |
|---|---|---|
| 13:59:39 | Compra previa del participante, team-11 | 284 acciones. La cartola compartida registra 9 bananas de costo, 991 disponibles y 1.000 de valor total. |

[Mercado del evento](https://hack.platan.us/26-cl/market)

## API local

Con Python 3, ejecutar `python3 tools/market/monitor.py`. El proceso consulta los 48 equipos en una sola lectura pública cada 10 segundos y guarda las observaciones en SQLite en el directorio local del usuario. Sirve JSON en `127.0.0.1:18726`.

- `/state` muestra precios, cantidades netas y antigüedad de la lectura.
- `/movers?seconds=60` ordena los equipos por variación y muestra el cambio de acciones de cada uno.
- `/history?team=team-11` devuelve hasta 2.000 observaciones locales.
- `/quote?team=team-11&side=buy&size=25` simula comprar con 25 bananas. Con `side=sell`, la cantidad se expresa en acciones. La estimación usa la curva LMSR y el redondeo de la interfaz. Para ejecutar importa la confirmación del servidor.

## Piloto de operaciones

Una sola posición nueva de hasta 25 bananas. El piloto observa entradas netas y busca un equipo cuyo precio haya subido al menos 12% en dos minutos, medido respecto de la mediana del mercado. Conserva la posición previa en team-11 hasta que liquidarla permita cerrar por encima de las 1.000 bananas iniciales. Para la posición nueva busca una ganancia realizada de dos bananas, con salida por caída estimada de cuatro bananas o por seis minutos transcurridos. Un salto de precio puede ampliar una pérdida. Termina al verificar al menos 1.001 bananas en caja sin posiciones, al cerrar ocho compras nuevas o al acumular una pérdida realizada de 12 bananas en el piloto.

La reproducción histórica de las 48 series públicas, desde la apertura hasta aproximadamente las 14:03 UTC, simuló 35 operaciones con +87 bananas en la primera mitad y 33 con +442 en la segunda. Usó una demora de entrada de diez segundos, comisiones redondeadas y la curva de liquidez. Supone que los demás participantes mantienen sus órdenes ante la compra simulada. Los resultados son hipotéticos y las salidas históricas presuponen ejecución al precio observado.

El proceso `python3 tools/market/pilot.py` usa el monitor local y un checkout dedicado de main. Pide la sesión mediante entrada oculta y registra las órdenes verificadas en [la bitácora](MARKET-ORDERS.md) tras cada cruce. La base SQLite y el registro de recuperación residen fuera de Git.
