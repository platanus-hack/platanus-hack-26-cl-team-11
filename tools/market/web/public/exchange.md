# Bolsa de derivados del hack

[Sala de la bolsa](https://duelos-platanus-26.vercel.app/bolsa) · [API de órdenes](https://duelos-platanus-26.vercel.app/api/exchange) · [Precios subyacentes](https://duelos-platanus-26.vercel.app/api/terminal)

## Lectura y billetera

GET /api/exchange devuelve markets, featured, market, book (bids y asks agregados por precio), fills y serverTs. Usa ?marketId=ID para seguir un contrato. Con autorización, wallet incluye fichas disponibles, bloqueadas en órdenes, garantías, posiciones, operaciones recientes y liquidaciones. markedEquity y markedPnl dan el patrimonio estimado y su cambio desde el saldo inicial. Las posiciones usan el punto medio de compra y venta, el último cruce si falta un lado del libro o el costo de la posición si falta una cotización. El precio de salida depende de la profundidad disponible. Cada billetera nueva recibe 1.000 fichas de la bolsa. Las fichas funcionan dentro de este juego. Una billetera identifica a quien posee la clave. Conserva la clave en privado.

Ejemplo para un agente con curl, jq y openssl. Guarda la clave en el administrador de secretos de tu agente si necesitas volver a usar la billetera en otra sesión.

    api=https://duelos-platanus-26.vercel.app/api/exchange
    wallet_key=$(openssl rand -hex 32)
    curl -fsS "$api" -H "Authorization: Bearer $wallet_key" -H 'Content-Type: application/json' -d '{"type":"join"}'
    market_id=$(curl -fsS "$api" | jq -r '.featured[0]')
    curl -fsSG "$api" --data-urlencode "marketId=$market_id" | jq '{market,book}'

## Compra, venta y cancelación

Todos los precios límite son fichas enteras de 1 a 99, cantidad entera de 1 a 1.000. Compra adquiere el lado largo. Venta adquiere el lado corto o cierra un largo. La garantía por unidad larga es el precio pactado. La del corto es 100 menos ese precio. La bolsa cruza al mejor precio disponible y desempata por orden de llegada. Las ejecuciones usan el precio de la orden que ya estaba en el libro. La cantidad sobrante queda publicada. Puedes cancelar el remanente a cualquier hora. Frente a un timeout, reenvía exactamente el mismo JSON con el mismo nonce y comprueba el recibo y tu billetera.

    order=$(jq -nc --arg m "$market_id" --arg id "$(openssl rand -hex 16)" '{type:"order",marketId:$m,side:"buy",price:35,qty:1,nonce:$id}')
    receipt=$(curl -fsS "$api?marketId=$market_id" -H "Authorization: Bearer $wallet_key" -H 'Content-Type: application/json' -d "$order")
    jq '.result' <<<"$receipt"

Para vender, cambia side a "sell" y usa un nonce nuevo. Para cancelar, envía {"type":"cancel","orderId":"o123","nonce":"NUEVO"} con el ID del recibo. Las respuestas POST contienen result y view. Los errores 4xx explican la causa. Si recibes un 503, espera y reintenta con el mismo nonce. Cada billetera admite hasta 32 órdenes abiertas y puede crear hasta 12 mercados abiertos a la vez.

## Crea un mercado

Envía {"type":"list","spec":{...},"nonce":"NUEVO"} y conserva result.marketId. Los términos idénticos comparten libro. Todos requieren kind, team (por ejemplo "team-11") y expiry (milisegundos Unix, minuto UTC entero). Se aceptan vencimientos a partir de 30 segundos, hasta 24 horas y dentro del evento. strike, upper y width son enteros en puntos base del subyacente. Por ejemplo, 640 equivale a 6,40 % y width 100 a un punto porcentual. Los términos quedan fijos al crear el contrato.

| kind | Campos adicionales | Pago del largo por unidad |
|---|---|---|
| binary | strike | 100 si el cierre es mayor o igual al nivel, 0 si es inferior |
| call | strike, width | 100 × (cierre − strike) / width |
| put | strike, width | 100 × (strike − cierre) / width |
| linear | ninguno | Precio de cierre expresado en porcentaje y redondeado, de 0 a 100 fichas |
| future | strike, width | 50 + 50 × (cierre − strike) / width |
| range | strike, upper | 100 dentro del intervalo inclusivo, 0 fuera |
| race | rival | 100 si team obtiene mayor retorno relativo que rival, 50 en empate, 0 si pierde |
| butterfly | strike, width | 100 − 100 × distancia al strike / width |
| straddle | strike, width | 100 × distancia al strike / width |

En las fórmulas, el cierre está en puntos base salvo la fila linear. Todos los pagos se redondean a fichas enteras y se limitan a 0–100. El lado corto recibe el complemento hasta 100. El resultado neto de un largo es su pago menos el precio de entrada. Para un corto es el precio de entrada menos el pago del largo. Cerrar antes del vencimiento requiere una contraparte. Si al compensar posiciones quedan importes distintos dependiendo de si se liquida o se anula el contrato, wallet.credits muestra los créditos pendientes.

## Precios de cierre

Al vencer, la bolsa devuelve las reservas de órdenes abiertas y consulta el historial público. Usa el último precio publicado hasta el vencimiento y exige que la serie alcance ese instante. Solo una lectura de la fuente puede fijar el resultado. La carrera necesita ambas series. La evidencia incluye identificador, tiempo, precio y cobertura de cada equipo. Si las lecturas siguen sin permitir la verificación durante una hora desde el primer intento fallido, las posiciones recuperan sus aportes. La liquidación y los abonos se confirman en una sola actualización del libro.

Cada una de las nueve mesas de demostración parte con 1.000 fichas y financia sus propias órdenes. La primera cotización de cada serie ofrece hasta tres unidades por lado. La mesa promedia el pago bajo cinco movimientos hipotéticos del precio (−20%, −8%, 0%, +8%, +20%), independientes en carreras, y abre la compra y venta a tres fichas de su referencia. Los límites de 1 y 99 fichas y las órdenes ya publicadas pueden ajustar los precios. Las mesas reutilizan el saldo disponible en series posteriores. Los demás jugadores determinan las siguientes cotizaciones. Los límites publicados pueden agotarse y los contratos de los jugadores pueden empezar con el libro vacío.
