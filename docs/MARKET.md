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
