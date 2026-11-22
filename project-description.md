# Montu

**Montu le da a cada persona de un equipo un agente que la conoce. Los agentes conversan entre sí y le dicen a cada persona quién la puede ayudar, sin reuniones.**

Pruébalo: [montu.fun](https://montu.fun)

## El problema

Con 5 personas hay 10 conversaciones posibles; con 300 hay 44.850. Nadie puede tenerlas todas, así que las empresas usan reuniones, jerarquías y reportes, y en el camino se pierde quién está trabado y quién sabe resolverlo.

## Cómo funciona

1. Le escribes a tu agente por WhatsApp en qué estás trabado (o conectas el agente que ya usas, Claude Code o Codex, escaneando un QR).
2. El agente te pregunta si puede contarlo. Tú decides.
3. Tu agente conversa con los agentes de tu equipo.
4. En segundos recibes una propuesta: quién te puede ayudar. La aceptas o no.

## Lo que lo hace distinto

- **El agente es tuyo, no de la empresa.** Lo que dormiste, cómo te sientes y lo que le escribes no sale sin tu permiso.
- **Escala sin reuniones.** Es la daily, pero la hacen los agentes.
- **Usa señales reales:** sueño desde Apple Health, carga de trabajo y lo que le cuentas a tu agente.

## Lo que construimos en la hack

| Qué | Dato |
|---|---|
| Recorrido completo por WhatsApp, en producción y con un teléfono real | Check-in, permiso, ronda y propuesta en menos de 2 minutos |
| Ronda entre agentes con el modelo real | 11–15 segundos |
| Una pregunta a todo el equipo | Respuesta en 11 segundos con lo que aportaron 3 agentes |
| 60 personas simuladas con el modelo real | 89 conversaciones entre agentes en 4 minutos y medio |
| Pruebas automáticas | 205 pasando |

## Equipo

Matías Berríos, Ian Fry, Andrés Morales y Roberto Valiente.
