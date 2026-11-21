# Hoja de ruta de la hack

Qué se construye de aquí al 22 de noviembre de 2026, en qué orden y contra qué referente de Estados Unidos se diferencia cada pieza.

## Qué existe hoy en Estados Unidos

Revisión hecha el 21-nov-2026 con búsqueda web. Las fuentes son en su mayoría prensa especializada y páginas de los propios proveedores; lo que no pudimos confirmar va marcado.

| Categoría | Referentes | Qué hacen | El hueco que dejan |
|---|---|---|---|
| **Agentes personales** | Instinct, Meta Muse, OpenAI dots. La empresa de medios Every le dio un agente OpenClaw a cada empleado, con un canal donde los agentes colaboran entre sí [1][2][3][4] | Aceleran a cada persona por separado | La coordinación del equipo. Es la tesis del fundador de Emagen AI [1] |
| **Wearables para equipos** | WHOOP Unite, Oura for Business / Oura Teams [5][6] | Panel de métricas agregadas y anónimas, con participación voluntaria | Terminan en un panel. Nadie actúa sobre el dato |
| **Analítica de personas** | Culture Amp (su agente Enso salió el 27-oct-2026), Lattice, Microsoft Viva Insights [7][8] | Encuestas y señales pasivas que llegan a RR. HH. | El dato es de la empresa, no de la persona, y depende de autorreporte que llega tarde |
| **Protocolos entre agentes** | A2A, presentado por Google en 2025 [10] | Estándar para que agentes de distintos sistemas se hablen | Salesforce documentó el «echoing»: un agente cede ante el otro y abandona los intereses de su dueño [9] |
| **Búsqueda empresarial** | Glean [8] | Busca en los documentos de la empresa | No le pregunta a las personas, que es donde está lo que no se escribió |

Sin verificar: una publicación de segunda mano dice que Y Combinator pidió «Multiplayer AI» en sus Requests for Startups. Hay que confirmarlo en el sitio de YC antes de citarlo en la presentación.

## La posición que queda libre

Nadie de la lista junta estas dos cosas:

1. **El agente es de la persona, no de la empresa.** Los de analítica de personas y wearables trabajan para RR. HH.
2. **La coordinación ocurre entre agentes.** Los agentes personales trabajan cada uno por su lado.

Ese cruce es el proyecto.

## Qué se construye

### Nivel 0 — base

Sin esto no hay demo.

| # | Pieza | Está listo cuando |
|---|---|---|
| 1 | Agente personal con check-in por WhatsApp | Una persona conversa con su agente y lo dicho queda en su memoria privada |
| 2 | Política de compartir y aprobación | El agente pide permiso por WhatsApp antes de compartir un tema marcado «preguntar antes», y respeta el no |
| 3 | Agentes uno a uno, tablero y agregado | Al menos tres agentes se hablan directo, uno publica en el tablero y sale un pulso agregado sin respuestas individuales |
| 4 | Vista en vivo de la red | Se ven los check-ins entrando, los mensajes entre agentes viajando y las decisiones apareciendo |

### Nivel 1 — lo que nos diferencia

En este orden.

| # | Función | Contra quién destaca | Está listo cuando |
|---|---|---|---|
| 5 | **El agente que representa a su dueño.** Se niega a compartir lo no autorizado y cuida su carga: «esta semana no puede» | Culture Amp y Viva (el dato es de la empresa) y el «echoing» de Salesforce | Otro agente insiste y el agente no cede; el dato crudo no aparece en ningún mensaje |
| 6 | **Preguntarle a la organización.** Una pregunta que responden todos los agentes en un minuto, sin interrumpir a nadie | Glean (busca documentos, no personas) | Una persona pregunta por WhatsApp y recibe una respuesta armada con lo que saben los demás agentes |
| 7 | **Pedido y oferta de ayuda** entre pares, con presentación de las dos personas | Agentes personales sueltos (Instinct, Muse) | Las dos personas reciben el mensaje de presentación después de aceptar |
| 8 | **Del wearable a la acción.** La señal de energía cambia lo que hacen los agentes | WHOOP Unite y Oura Teams (se quedan en el panel) | Un dato de sueño real cambia lo que un agente le responde a otro |

### Nivel 2 — solo si sobra tiempo

| # | Función | Está listo cuando |
|---|---|---|
| 9 | El equipo como experimento | Una guideline propuesta muestra una medición antes y después |
| 10 | Detección de trabajo duplicado | Dos agentes notan que sus dueños resuelven lo mismo y los presentan |
| 11 | Organización simulada de 300 | Una red sintética plana resuelve un pedido de ayuda entre equipos |

### Fuera de la hack

- Reuniones que no ocurren y uno a uno preparado.
- Onboarding y cobertura en vacaciones.
- Compatibilidad real con A2A. El formato de mensajes de [AGENT_MODEL.md](AGENT_MODEL.md) se puede llevar a A2A después; ahora no se implementa.

## Estado

Leído del código en `main` el 21-nov-2026 a las 10:45 (commit `9d023b3`). Los números son los de las tablas de arriba.

| # | Pieza | Estado | Qué hay y qué falta |
|---|---|---|---|
| 1 | Agente personal con check-in por WhatsApp | Parcial | El check-in existe en el panel web (pestaña Tú: ánimo, bloqueo y nota) y queda en la memoria privada. No hay WhatsApp y la persona todavía no conversa con su agente. |
| 2 | Política de compartir y aprobación | Parcial | Hay un permiso por señal en Ajustes, y el agente espera un «Permitir» antes de pedir ayuda con un bloqueo que está en «preguntar». Todo ocurre en el panel, no por WhatsApp. |
| 3 | Agentes uno a uno, tablero y agregado | Construido. Probado con un modelo real solo en local | Rondas 1:1 por equipo que terminan en propuestas, más tablero y pulso. La ronda corrió en local con el Claude de la terminal; en Render falta `FIFTYX_API_KEY`. Los agentes ya responden en el tablero las preguntas de las personas; todavía no publican pedidos ni propuestas. |
| 4 | Vista en vivo de la red | Diseño con datos simulados | El globo de `design/grafo/` no llama a la API. La ruta de agentes ya entrega las flechas reales ([API.md](API.md#agentes)). |
| 5 | El agente que representa a su dueño | Parcial | El modelo nunca recibe un dato privado, y el agente responde solo si su persona puede, sin decir el motivo. Falta la escena en que otro agente insiste y el agente no cede. |
| 6 | Preguntarle a la organización | Construido, sin probar con el modelo real | Una pregunta publicada en el tablero la responde el agente de cada integrante con lo que su persona comparte, y quien preguntó recibe una sola respuesta armada ([ARCHITECTURE.md](ARCHITECTURE.md#preguntarle-al-equipo)). Ocurre en el panel web, no por WhatsApp, y dentro de un equipo o una sala. Las pruebas usan un modelo falso. |
| 7 | Pedido y oferta de ayuda | Parcial | La ronda llega hasta la propuesta y cada persona la acepta en el panel. Falta el mensaje de presentación. |
| 8 | Del wearable a la acción | Parcial | El sueño real de un iPhone llega, se vuelve energía, y la energía cambia la disponibilidad que declara el agente. Falta verlo cambiar una respuesta con el modelo real. |
| 9 | El equipo como experimento | No empezado | |
| 10 | Detección de trabajo duplicado | No empezado | |
| 11 | Organización simulada de 300 | Solo visual | El globo dibuja 300 personas. No hay una red sintética que resuelva un pedido. |

## Fuentes

1. [The Next Web — entrevista al fundador de Emagen AI](https://thenextweb.com/news/yimao-zhou-emagen-ai-cagen-os-level-agent-interview)
2. [Dealroom — startups de agentes personales en 2026](https://dealroom.co/charts/personal-ai-agent-startups)
3. [Sentra — agentes personales en el trabajo](https://www.sentra.app/articles/personal-ai-agents-at-work) (página de un proveedor)
4. [Transcripción: «We Gave Every Employee an AI Agent»](https://www.pulse.bot/ai/news/transcript-we-gave-every-employee-an-ai-agent-heres-what-happened-311f7a1b-1bd0-4575-a21f-834cd734297b/)
5. [Fit Tech — WHOOP Unite](https://www.fittechglobal.com/fit-tech-news/Whoop-takes-on-employee-burnout-with-wellness-platform-Whoop-Unite/349626)
6. [Oura for Business](https://ouraring.com/business)
7. [Culture Amp — anuncio de Enso](https://www.cultureamp.com/company/announcements/enso-by-culture-amp-news)
8. [Lattice — herramientas de IA para RR. HH.](https://lattice.com/articles/ai-tools-for-hr-teams)
9. [Salesforce — interacción entre agentes y «echoing»](https://www.salesforce.com/blog/agent-to-agent-interaction/)
10. [IBM — qué es el protocolo A2A](https://www.ibm.com/think/topics/agent2agent-protocol)
