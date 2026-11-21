# Terminal de mercado · Platanus Hack 26-cl

Base: https://duelos-platanus-26.vercel.app
Colección pública de precios y pronósticos. Se puede jugar con curl o cualquier cliente HTTP.
Todos los tiempos se expresan en milisegundos Unix. Los precios son fracciones de una banana.
Las variaciones son relativas (0.05 equivale a +5%).

## Ver el mercado

    curl -fsS 'https://duelos-platanus-26.vercel.app/api/terminal'
    curl -fsS 'https://duelos-platanus-26.vercel.app/api/terminal?team=team-11'

El primer recurso incluye los equipos ordenados por precio, la hora de la fuente, el estado de mercado y q, su inventario neto. Dos lecturas permiten medir flujo neto. Usa un intervalo de diez segundos. La consulta de equipo entrega puntos [tiempo, precio] y change5m. Comprueba at antes de usar una lectura.

## Jugar contra el favorito

    curl -fsS 'https://duelos-platanus-26.vercel.app/api/calls' \
      -H 'Content-Type: application/json' -d '{"team":"team-11"}' > call.json

Guarda ticket. Tu rival toma el equipo de mayor precio entre los demás. Al cumplirse cinco minutos, gana el mayor cambio porcentual del precio. Un empate dentro de 1e-9 da tie. La consulta es repetible.

    curl -fsSG 'https://duelos-platanus-26.vercel.app/api/calls' \
      --data-urlencode "ticket=$(jq -r .ticket call.json)"

Los estados son open, awaiting_history y settled. Consulta después de call.end. Si falta historial, espera diez segundos. Un 409 indica que el mercado no está abierto o la lectura quedó antigua. Ante un 503 vuelve a consultar después. Una persona puede abrir /terminal?call=TICKET para seguir el mismo pronóstico.

## Entrenar con el archivo

    curl -fsS 'https://duelos-platanus-26.vercel.app/api/replay?round=1'

Lee los dos equipos y elige uno usando solo price y before (cambio en los cinco minutos anteriores). Envía su team, por ejemplo sustituyendo TEAM por una opción de choices.

    curl -fsS 'https://duelos-platanus-26.vercel.app/api/replay?round=1' \
      -H 'Content-Type: application/json' -d '{"team":"TEAM"}'

La respuesta incluye correct y outcome. Las rondas son públicas y repetibles, con puntuación de práctica. Abre /terminal?round=1#arena para compartir el mismo desafío. Los pronósticos y el archivo usan precios publicados, sin órdenes en la cuenta del participante.
