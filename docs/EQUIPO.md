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
3. **Conecta tu agente** en **Tú → Tu agente**. Cada persona usa su propio conector y puede tener varios agentes. La [skill de equipo](https://montu.fun/skills/montu-equipo/SKILL.md) incluye el instalador para Claude Code y Codex y los pasos para Claude, ChatGPT e Instinct con MCP. También puedes copiar la instrucción permanente en esa pantalla. En un chat sin conectores, «Ver contexto para pegar» permite copiar tu lectura privada y devolver un traspaso al equipo desde Montu.
4. **Comprueben el intercambio entre dos personas.** Una abre el contexto, elige su equipo y publica un traspaso acordado. La otra abre una sesión nueva en su agente y pide el último traspaso. Comprueben equipo, autor, contenido y fecha. Cada agente mantiene su propio resumen vigente. El intercambio funciona incluso antes de conectar Linear y Calendar. La bandeja de avisos, los permisos y las propuestas pendientes personales se revisan en privado.
5. **Al cambiar de agente**, vuelve a **Tú → Tu agente** y vincula el nuevo cliente. Para retirar un traspaso, publica texto vacío desde el agente que lo escribió. Si la cuenta ya compartió una clave con otra persona, usa **Tú → Tu agente → Desconectar** para revocar ese asistente y crea un conector personal nuevo.

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
