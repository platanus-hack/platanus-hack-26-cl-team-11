# Fuentes de datos

De dónde saca señal cada agente personal. Todas las fuentes las conecta la persona, alimentan solo su memoria privada y se pueden desconectar en cualquier momento ([PRIVACY.md](PRIVACY.md)).

## Canal con la persona

**WhatsApp.** Es donde cada persona conversa con su agente: check-in diario, aprobaciones de lo que se comparte, pedidos y ofertas de ayuda. Sin instalar nada.

## Fuentes de señal

| Fuente | Qué aporta | Para qué sirve |
|---|---|---|
| **Wearables** (Whoop, Apple Health) | Sueño, recuperación, variabilidad cardíaca, entrenamiento. | Energía y descanso sin que la persona tenga que contarlo. |
| **Check-in conversacional** | Ánimo, en qué está, qué la traba, qué necesita. | La señal más rica; lo que ninguna otra fuente sabe. |
| **Trabajo** (GitHub, Linear, calendario) | Commits, PRs, tickets, carga de reuniones. | En qué está cada uno, dónde se atasca, en qué tiene experiencia. |
| **Reuniones** (Granola) | Qué se dijo, se decidió y se comprometió. | Compromisos pendientes y temas donde la persona participó. |

## Qué deriva el agente

El agente no comparte datos crudos; deriva **señales** y es eso lo que puede salir:

| Señal | Se deriva de |
|---|---|
| Energía | Wearable + check-in |
| Ánimo | Check-in |
| Carga | Calendario + tickets abiertos + check-in |
| Bloqueos | Check-in + PRs y tickets detenidos |
| Experiencia («sabe de X») | Historial de trabajo + reuniones |
| Compromisos | Reuniones + tickets |

Cada señal se compara contra el promedio de la propia persona, no contra el resto del equipo.

## Qué está construido

Estado al 21-nov-2026. El cálculo está en `backend/src/signals.ts`.

| Señal | De dónde sale hoy | Qué falta respecto de la tabla de arriba |
|---|---|---|
| Energía | La última noche de sueño que llega de Apple Health, comparada con el promedio de la propia persona y ajustada por el ánimo del último check-in. Con menos de 3 noches previas usa umbrales fijos: menos de 6 h es baja; 7,5 h o más es alta | Recuperación y variabilidad cardíaca |
| Ánimo | No es una señal propia. El ánimo del check-in solo sube o baja la energía | Sacarlo como señal |
| Carga | Las reuniones de hoy en Google Calendar, las notas de Granola que traen su horario, y las tareas de Linear en curso o que vencen dentro de 7 días | El check-in no entra en la carga |
| Bloqueos | El bloqueo dicho en un check-in de los últimos 7 días, y cada tarea de Linear en curso sin cambios hace 3 días o más | Los pull requests detenidos no cuentan |
| Experiencia | Los repos de GitHub con actividad y las palabras que se repiten en títulos de pull requests y de tareas de Linear | Las reuniones no aportan temas |
| Compromisos | No construida | Todo |

- Gmail se conecta y guarda asunto, remitente y fecha, pero hoy no alimenta ninguna señal.
- Whoop quedó fuera: escribe el sueño en Apple Health, así que alcanza con el Atajo ([INTEGRATIONS.md](INTEGRATIONS.md)).
- El check-in se hace en el panel web, no por WhatsApp.
- Solo Apple Health está probada contra el servicio real. El resto usa respuestas simuladas en las pruebas.

## Reglas

- Sin dato, el agente dice «sin datos»; no rellena.
- Una fuente desconectada deja de leerse de inmediato.
- Para la demo se puede trabajar con datos sintéticos; ver [DEMO.md](DEMO.md).
