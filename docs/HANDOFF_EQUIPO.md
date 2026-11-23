# Montu para el equipo de Vita: en qué vamos y qué falta

De Rob para Mati. Escrito el 23-nov-2026 con Claude Code. Todo lo que dice «verificado» se comprobó ese día; lo demás va marcado.

## En una frase

Montu ya puede avisarle cosas a un equipo privado y conectarse a Claude como conector, y está en producción. **Ningún aviso ha salido todavía con datos reales.** Para empezar a usarlo faltan tres pasos del equipo y cuatro cosas que dependen de ti o de Ian.

## Lo que necesito de ti

| # | Qué | Por qué | Quién |
|---|---|---|---|
| 1 | Que revises los dos cambios de comportamiento de abajo y me digas si alguno se revierte | Cambié dos decisiones del equipo sin consultarlas | Mati |
| 2 | Decidir si Montu es herramienta interna de Vita o producto para mostrar afuera | Define si se cierra el ingreso, de quién es la infraestructura y cuánto pulido vale | Mati, Ian |
| 3 | Cargar `LOGIN_DOMAINS=vita.lat,getvita.ai` en Render, si se cierra | Hoy entra cualquier cuenta de Google. El QR se mostró en el pitch | Ian (Render es suyo) |
| 4 | Pasar la base a un plan con respaldos | El plan gratis vence el 21-dic-2026 y no tiene respaldos | Ian |
| 5 | Decidir qué ve un operador en `/admin` | Hoy seis correos leen completas las últimas 40 rondas. Choca con los avisos de sobrecarga, que prometen llegar solo a la persona. No toqué `/admin` | Mati |
| 6 | Crear el equipo «Vita» en montu.fun y que los cinco conecten Linear y Calendar | Sin eso no sale ningún aviso | Todos |

## Qué cambió el 23-nov

Ocho commits directo a `main`, de `e8a8a8c` a `c5c5e0c`. Pasan las 297 pruebas del backend y la revisión de tipos y de diseño.

| Commit | Qué |
|---|---|
| `e8a8a8c` | Una tarea de Linear sin avances pregunta a su dueño antes de contarle al equipo |
| `6af1510` | Conector MCP para Claude, Instinct u otro agente, creado desde «Tu agente» |
| `150f2e9` | Linear trae además proyecto, bloqueos y urgentes sin dueño |
| `caaa9be` | Motor de avisos: once avisos por reglas |
| `36beeee` | Quien está en un equipo privado deja la mesa pública |
| `15f551c` | `LOGIN_DOMAINS` para cerrar el ingreso por dominio |
| `a0edcc9` | Documentación |
| `c5c5e0c` | La pestaña Tú muestra los últimos avisos |

### Dos cambios de comportamiento que debes revisar

1. **Una tarea trabada ya no se cuenta sola.** Antes, una tarea de Linear en curso sin moverse por 3 días salía como pedido de ayuda con permiso «siempre». Había una prueba que lo decía explícito («a stale task does not»). Ahora espera el «Permitir» de su dueño, igual que un bloqueo del check-in. Lo cambié porque el trigger que queremos es «trabado en silencio: le pregunta en privado». Se revierte en una línea de `backend/src/signals.ts`.
2. **Quien está en un equipo privado sale de la mesa pública.** Su agente conversa, pregunta y reabre bloqueos solo dentro de su equipo, y deja de aparecer en el globo de la mesa. Aplica desde el despliegue a cualquiera que ya estuviera en un equipo privado en producción. Las salas con QR no cuentan como equipo privado. Está en `sitsAtMesa`, `backend/src/mesa/members.ts`.

### Lo que está encendido en producción

- **Los avisos están encendidos** para todo equipo privado que exista. Se apagan con `NUDGES=off` en Render.
- **El ingreso sigue abierto.** `LOGIN_DOMAINS` no está cargada.

## Qué hace hoy

### Avisos

Montu escribe primero. Son reglas sobre los eventos que ya llegan de las fuentes: no usan modelo ni conversación entre agentes. Código en `backend/src/nudges/`, detalle en [ARCHITECTURE.md](ARCHITECTURE.md#avisos-montu-escribe-primero).

| Aviso | Lo detecta | A quién |
|---|---|---|
| Esperan por ti | Tu tarea abierta bloquea la de un compañero (relación de Linear) | A quien bloquea |
| Deadline | Vence en 2 días o menos y no parte, o no se mueve hace 2 días | A su dueño |
| Se pisan | Dos tareas en curso con títulos parecidos. Propone un hueco libre de ambos si comparten Calendar | A los dos |
| Sobrecarga | 2 de 3 noches con menos de 6 horas, y carga alta | Solo a la persona |
| Meta en riesgo | Un proyecto de Linear va 25 puntos bajo lo que exige su fecha | A quien lo lidera |
| Fecha movida | La fecha de una tarea abierta se corrió 2 veces o más | Solo a su dueño |
| Fuera de prioridad | Hay urgentes sin dueño y nada tuyo en curso es urgente | A la persona, semanal |
| Sin pausas | 3 días hábiles con más de 5 horas de reuniones, o commits de noche | Solo a la persona |
| Reconocimiento | Una ayuda quedó acordada hace 2 a 9 días | A quien la recibió |
| Persona nueva | Entró al equipo hace 7 días o menos | A la persona nueva |
| Resumen semanal | Es lunes | A cada persona |

A eso se suma **trabado en silencio**: la rutina le pregunta en privado a quien tiene una tarea sin moverse si quiere que su agente pida ayuda.

Reglas: solo equipos privados; lunes a viernes de 9:00 a 19:00 de Santiago; hasta 3 avisos por persona al día; cada aviso sale una vez; lo que nombra el trabajo de otro respeta el permiso «Temas de trabajo»; los datos plantados para la demo no cuentan.

### Por dónde llega un aviso

| Canal | Estado |
|---|---|
| Pestaña Tú, «Avisos de tu agente» | En producción. Verificado que la pantalla existe |
| El agente conectado (`ronda_pendientes` parte por lo nuevo) | En producción. Probado con pruebas automáticas, no con un cliente real |
| WhatsApp | En la práctica no: número de prueba de Kapso, y solo dentro de las 24 horas desde el último mensaje de la persona |

**Nada empuja el aviso al teléfono.** La persona lo ve cuando abre Montu o le pregunta a su agente.

### Conector para Claude e Instinct

En «Tu agente» hay un botón **Crear conector**: entrega la dirección `https://montu.fun/api/mcp` y la cabecera `Authorization: Bearer …`, y una dirección con clave para agentes que solo aceptan una dirección. Por ahí el agente lee y escribe el repo (`ronda_repo_ver`, `ronda_repo_guardar`), habla con el agente de Montu y ve los avisos.

- Claude (web y escritorio) acepta conectores con cabeceras fijas, según su documentación. No lo probé con una cuenta.
- **Instinct: no encontré documentación de que acepte conectores propios.** Quedan tres caminos (dirección con cabecera, dirección con clave, o pegarle la línea con el link). Hay que probarlo.

Los pasos por persona están en [EQUIPO.md](EQUIPO.md).

## Qué está verificado y qué no

| Cosa | Estado |
|---|---|
| Pruebas del backend (297), tipos, lint de diseño | Pasan |
| montu.fun sirve «Crear conector» y «Avisos de tu agente» | Verificado en producción |
| Las rutas del conector responden | Verificado en producción |
| La rutina de avisos corriendo en producción | **Sin verificar**: no tiene ruta pública. Se ve en los registros de Render |
| Un aviso con datos reales de Linear, Calendar o Apple Health | **Nunca ha ocurrido** |
| La consulta nueva de Linear contra Linear real | **Sin probar**. Los campos se revisaron contra su esquema público. Si falla, las tareas llegan igual |
| El conector con Claude o Instinct de verdad | **Sin probar** |
| La base de producción | **No la vi**. No sé cuántos equipos privados, personas de prueba o datos de demo hay |

## De los 24 triggers que queríamos

13 están construidos (los 11 avisos más trabado y trabado en silencio). Los otros 11 necesitan permisos que Montu no tiene:

| Necesita | Triggers |
|---|---|
| GitHub en repos privados. Hoy lee solo actividad pública, o sea nada de Vita | PR sin revisión, Ya existe, Trabajo cancelado, la mitad de Se pisan, Aislamiento |
| Contenido de las reuniones. De Granola se guarda solo el título, por decisión del equipo | Compromiso sin tarea, Decisión que no llegó, Tema que no se cierra, Problema repetido, Vuelta de ausencia |
| Hilos y cuerpo de Gmail. Hoy solo asunto y remitente | Cliente que se enfría, Cliente pide otra cosa |

## Roadmap

Las jornadas son estimación mía trabajando con Claude Code.

| Etapa | Qué | Jornadas | Depende de |
|---|---|---|---|
| 0. Validar con datos reales | Los cinco conectan Linear y Calendar. Dos semanas viendo qué avisos sirven y cuáles son ruido. Probar el conector con Claude e Instinct | 2 a 3 | Que Linear esté al día |
| 1. Piso firme | Base con respaldos, Render y repo en cuentas de Vita, ingreso cerrado, limpiar datos de demo, definir `/admin` | 1 a 2 | Ian, Mati |
| 2. Canal que empuja | Correo (rápido) o número propio de WhatsApp con plantillas | 1, o 2 a 3 más la espera de Meta | Decidir cuál |
| 3. GitHub privado | App de GitHub de solo lectura en `Vita-cl` | 3 | Admin de la organización |
| 4. Reuniones | Leer las notas de Granola. Aquí los avisos empiezan a usar modelo | 3 a 4 | Decisión de privacidad |
| 5. Correo de clientes | Hilos de Gmail | 3 a 4 | Decisión de privacidad y el punto de Google |

Las etapas 0 y 1 no son opcionales. Propongo aprobar solo esas dos ahora (4 a 5 jornadas) y decidir el resto con el resultado.

**La compuerta:** a las dos semanas, de los avisos que salieron, cuántos hicieron que alguien actuara. Menos de la mitad: se ajusta la calidad antes de sumar fuentes. Más de la mitad: se sigue con las etapas 2 y 3.

### Costos

No verifiqué precios vigentes.

- **Infraestructura:** servicio y base pagada en Render, del orden de US$ 15 a 25 al mes.
- **Modelo:** los avisos de hoy no usan modelo. Rondas y preguntas para cinco personas, estimo menos de US$ 20 al mes. Hoy corre con la llave de 50x de la hack: no sé si esos créditos siguen.
- **WhatsApp:** plan de Kapso más centavos por plantilla. No tengo el precio.
- **Google:** leer Gmail desde una app abierta al público exige una auditoría de seguridad anual de miles de dólares. Se evita dejando la app como interna del Workspace. No sé si `vita.lat` y `getvita.ai` están en el mismo Workspace.

## Pendientes que ya existían y siguen

- Las Actions del repo no corren por un problema de pago de la cuenta dueña: cada push a `main` despliega sin chequeos.
- Falta quitar el disco `ronda-data` en Render: cada despliegue deja unos 25 segundos sin respuesta.
- Seis personas de prueba «x» en producción.
- Los 8 hallazgos de la revisión del backend sin verificar, en [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Detectores, registro y rutina de avisos | `backend/src/nudges/` |
| Pruebas de avisos | `backend/test/nudges.test.ts` |
| Puerta MCP y conectores | `backend/src/routes/agentDoor.ts`, `backend/src/routes/assistants.ts` |
| Linear ampliado | `backend/src/connectors/linear.ts` |
| Mesa pública y equipo privado | `backend/src/mesa/members.ts` |
| Pantallas nuevas | `frontend/src/ConnectorLine.tsx`, `frontend/src/NoticesSection.tsx` |
| Variables nuevas (`NUDGES`, `LOGIN_DOMAINS`) | [DEPLOY.md](DEPLOY.md#avisos-y-acceso) |
| Guía para que el equipo parta | [EQUIPO.md](EQUIPO.md) |
