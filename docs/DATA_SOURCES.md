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

## Reglas

- Sin dato, el agente dice «sin datos»; no rellena.
- Una fuente desconectada deja de leerse de inmediato.
- Para la demo se puede trabajar con datos sintéticos; ver [DEMO.md](DEMO.md).
