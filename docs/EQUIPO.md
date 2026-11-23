# Cómo parte un equipo

Los pasos para que un equipo real use Montu todos los días. Escrito el 23-nov-2026; lo que no está probado con cuentas reales va marcado.

## Una vez por equipo

1. Una persona entra a https://montu.fun con Google, abre la pestaña **Equipo** y crea el equipo.
2. Invita al resto con el link de invitación. Quien entra con código queda pendiente hasta que lo aprueben.

Desde que alguien está en un equipo privado, su agente deja la mesa pública: conversa y pregunta solo dentro de su equipo, y empieza a recibir avisos.

## Una vez por persona

1. **Entra con Google** en https://montu.fun con tu correo de trabajo.
2. **Conecta tus fuentes** en la pestaña Fuentes. Para los avisos importan, en este orden:
   - **Linear**: de aquí salen deadline, alguien espera por ti, dos personas en lo mismo, proyecto atrasado, fechas que se corren y temas urgentes sin dueño.
   - **Google Calendar**: días sin pausa, carga y el hueco libre que propone cuando dos personas se pisan.
   - **Apple Health** (iPhone): sobrecarga. Solo la ves tú.
3. **Conecta tu agente** en «Tu agente». Hay dos caminos:

| Tu agente | Cómo |
|---|---|
| Claude Code, Codex u otro que lee links y hace llamadas | Copia la línea «Lee https://montu.fun/a/… y sigue las instrucciones» y pégasela. Se presenta, te muestra qué va a escribir y llena tu repo |
| Claude (web o escritorio) | Toca **Crear conector**. En Claude: Personalizar → Conectores → Agregar conector personalizado. Pega la dirección y, en las cabeceras de la petición, la cabecera `Authorization` |
| Instinct u otro | Si acepta servidores MCP, usa la dirección y la cabecera del conector; si solo acepta una dirección, usa la dirección con clave. Si no acepta conectores, pégale la línea con el link. No está probado con Instinct |

En Claude Code el conector también se agrega a mano:

```bash
claude mcp add --transport http montu https://montu.fun/api/mcp --header "Authorization: Bearer <token>"
```

4. **Pídele a tu agente que mantenga tu repo al día.** El agente de Montu conversa con lo que hay en tu repo (`ahora.md`, `sabe.md`); si nadie lo actualiza, queda viejo. Sirve una instrucción fija en tu agente: «Al terminar una sesión de trabajo, actualiza mi repo de Montu con en qué estoy, qué me tiene trabado y qué aprendí».

## Que tu agente te cuente los avisos al partir

Montu deja los avisos en una bandeja; tu agente los ve cuando llama a `ronda_pendientes`. Para que Claude Code los lea al abrir cada sesión, agrega un hook en `~/.claude/settings.json` y guarda el token del asistente en la variable `MONTU_TOKEN` de tu terminal:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          { "type": "command", "command": "curl -s -m 5 https://montu.fun/api/agent/inbox -H \"Authorization: Bearer $MONTU_TOKEN\"" }
        ]
      }
    ]
  }
}
```

Lo que imprime el hook entra como contexto de la sesión. En Claude (web o escritorio) no hay nada equivalente: pregúntale «¿qué hay de nuevo en Montu?».

## Qué esperar

- Avisos de lunes a viernes, de 9:00 a 19:00, hasta tres al día por persona.
- El lunes, un resumen de en qué está cada uno, con lo que cada persona comparte.
- Si una tarea tuya en curso no se mueve hace 3 días, tu agente te pregunta en privado si pide ayuda. Nadie más lo sabe hasta que dices «Permitir».
- Lo de sueño y carga llega solo a ti.

## Qué falta para que quede cerrado

- Probar cada fuente con una cuenta real. Solo Apple Health está probada.
- GitHub lee solo actividad pública: con repos privados no aporta.
- WhatsApp está en el número de prueba de Kapso: falta un número propio.
- Cargar `LOGIN_DOMAINS` en Render para que solo entren las cuentas del equipo ([DEPLOY.md](DEPLOY.md#avisos-y-acceso)).
- La base de producción está en el plan gratis de Render: vence el 21-dic-2026 y no tiene respaldos.
