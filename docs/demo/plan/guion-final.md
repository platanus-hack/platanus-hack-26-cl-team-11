# Demo 2 de Montu · guion final

Video: **«Diez personas, sus fuentes y sus agentes»**. Salida: `docs/demo/diez-personas.mp4` (+ `.png`, `.json`, `.md`).
Repo: `<repo>`. Checked at `98db251` on 21-nov-2026, 13:05 (Santiago). Nothing was run to write this plan.

Base: the design «fiabilidad» (one winner, and the best feasibility score from both judges). Grafted: the Linear scene, the «45 conversaciones» caption and the reply probe from «historia»; the provider contract test, the log label, the real-time chip, the closing card, the permission-page copy and the scoped locators from «cobertura».

Words used the same way in the whole plan:

- **guion** = the recorder script. It plays every person and every assistant.
- **pre-roll** = what the guion does before the camera starts.
- **toma** = one filmed run. **ensayo** = a run with no browser and no video.
- **T** = the Santiago calendar day when the demo server starts. All dates are relative to T.

---

## 1. What the viewer understands

One person connects her sources in three ways (push, account, key) and her assistant (Claude Code). Ten people are in the sala, each with another mix. The agents talk. The results differ for reasons the viewer sees on a product screen: a request came from Linear with nobody typing it, and one agent did not commit its owner because of her sleep and her calendar, and did not say why.

Three things changed from the first demo and each one is on a product screen: sources become sentences («Carga alta hoy»), a sentence changes what an agent answers, and a source creates a request.

---

## 2. Cast

Sala: **«Equipo Quillay»**. Ten invented people. Fixed, not random. The table order is the join order (`backend/src/teams/store.ts`, members ordered by join time).

| # | id | Nombre · rol | Asistente y puerta | Fuentes | The one variable this person shows |
|---|---|---|---|---|---|
| 1 | `antonia` | Antonia · Líder de producto | Claude Code, by link, **on camera** | Apple Health (push), Google Calendar + Gmail (permission), Granola (key), check-in. All **on camera** | Three ways to connect a source, and an agent that asks before it tells a blocker |
| 2 | `ignacio` | Ignacio · Ingeniero backend | Codex, by link | GitHub, Linear | A Linear task with no progress for 4 days becomes a request nobody typed. Phone on camera after the round |
| 3 | `javiera` | Javiera · Diseñadora de producto | ChatGPT, pasted, shared | none | A chat app with no tools still gets her request into the round |
| 4 | `catalina` | Catalina · Encargada de finanzas | Cursor, by link | Apple Health, Google Calendar + Gmail, Granola, Linear | Low availability from four sources. Her agent does not commit her and does not say why. Phone on camera after the round |
| 5 | `cristobal` | Cristóbal · Ingeniero frontend | Claude Code, by link | Apple Health, GitHub | High availability: same topic as Felipe, opposite answer |
| 6 | `felipe` | Felipe · Ingeniero de gráficos | OpenClaw, by link | check-in «Con cansancio» | Low availability from a check-in alone. Second chance for a «No puede» |
| 7 | `fernanda` | Fernanda · Encargada de marketing | Grok, pasted, shared | check-in «Bien» | Helper 1 of Antonia's group |
| 8 | `nicolas` | Nicolás · Ejecutivo de ventas | Claude (chat app), pasted, shared | Google Calendar + Gmail | Free calendar. Helper 2 of Antonia's group |
| 9 | `martina` | Martina · Analista de datos | Gemini, pasted, left in «Te pregunta antes» | none | Nothing shared: her agent tells nothing and costs no model call |
| 10 | `sebastian` | Sebastián · Encargado de soporte | none («Sin agente todavía») | check-in «Normal» | A person can be in the sala with no assistant |

Under the ten names the sala screen reads: Claude Code, Codex, ChatGPT, Cursor, Claude Code, OpenClaw, Grok, Claude, Gemini, Sin agente todavía. Eight assistant kinds, three doors (link, pasted and shared, pasted and not shared).

Accounts: Google, Linear and Granola `<id>@ronda.example`. GitHub `<id>-demo`. Repos `ronda-demo/…`. Links `https://git.example/…`, `https://tareas.example/…`, `https://notas.example/…`. Tokens of the simulated provider: `demo-<id>`; Granola key `grn_demo_<id>`.

### 2.1 Exact invented data per person

Times are Santiago local time on day T unless a day is given. «T−2» is two days before T.

**Antonia**

| Source | Data |
|---|---|
| Apple Health | One push, on camera, in the format a real iPhone Shortcut sends: `{"sleep_hours":"23040,5"}` (6,4 h, no date, so it counts for T) |
| Google Calendar | T: 09:30–10:30 «Planificación del lanzamiento»; 11:30–12:30 «Revisión de prioridades con diseño»; 15:00–16:30 «Comité de producto» (4 attendees). T−1: 10:00–10:45 «Retro del sprint». T+1: 12:00–12:30 «Uno a uno con ingeniería». Total today: 210 minutes |
| Gmail | 5 messages, subject · sender: «Agenda del comité de producto» · Elisa Carrasco; «Fechas del lanzamiento» · Matías Lagos; «Presupuesto de la campaña» · Rodrigo Pinto; «Acta de la retro del sprint» · Elisa Carrasco; «Invitación: ensayo general» · Matías Lagos. Dates T−2 to T |
| Granola | Key `grn_demo_antonia`, typed on camera. 2 notes: T 17:00–17:45 «Ensayo del pitch con ventas» (3 attendees, summary «Se revisó el orden del pitch. Falta cerrar el guion.»); T−1 16:00–16:30 «Entrevista con una usuaria» |
| Check-in | On the phone: «Normal», blocker `guion y ensayo del pitch` |
| Repo (Claude Code en el MacBook) | `README.md`, `ahora.md`, `sabe.md` in «Se comparte»; `estado.md` in «Te pregunta antes». `ahora.md`: «Prepara el lanzamiento de noviembre y ordena prioridades con diseño e ingeniería.» `sabe.md`: Priorización, Lanzamientos, Investigación con usuarios. No file mentions the pitch |
| Expected sentences | After Google: «Carga media hoy». After Granola: «Carga alta hoy», «Sale de: Google Calendar, Granola» (210 + 45 = 255 ≥ 240). After the check-in: «Energía media hoy». Blocker held until she taps «Permitir» |

**Ignacio**

| Source | Data |
|---|---|
| GitHub (`ignacio-demo`) | Push: 6 commits in `ronda-demo/pagos-api` (T−1), 3 commits in `ronda-demo/pagos-api` (T−3), 2 commits in `ronda-demo/alertas` (T−5). Pull requests: «Webhook de pagos con reintentos» (opened, T−2); «Alertas del webhook» (merged, T−5). Each with its own `html_url` |
| Linear | `RON-212` «Conciliación de cobros con el banco», state «En progreso» (`started`), `updatedAt` = server start minus 96 hours. `RON-230` «Webhook de reembolsos», state «Por hacer» (`unstarted`), updated T−1, no due date |
| Repo (Codex) | Four files, same levels as Antonia. `ahora.md`: «Mantiene la API de pagos: reintentos del webhook y alertas.» `sabe.md`: APIs, Webhooks, SQLite. No file mentions the conciliation |
| Expected | Blocker «Sin avances en «Conciliación de cobros con el banco» desde hace 4 días», source Linear, «Se comparte». «Carga baja hoy». Topics include `pagos-api`, `alertas`, `webhook` |

**Javiera**

| Source | Data |
|---|---|
| Pasted ChatGPT answer, then set to «Se comparte» | «1. Javiera es diseñadora de producto. 2. Esta semana arma el prototipo del mapa de la sala. 3. Necesita a alguien que sepa de animación en canvas para que los arcos del mapa se muevan sin trabarse. 4. Sabe de diseño de interfaces y prototipos.» |
| Expected | No signals. One request, worded by the model from this text |

**Catalina**

| Source | Data |
|---|---|
| Apple Health | 11 nights with `date`: T−10 to T−3 with 7,5 h each; T−2 4,9 h; T−1 4,8 h; T 5,0 h |
| Google Calendar | T, 60 minutes each: 09:00 «Cierre contable de octubre»; 10:30 «Revisión de cobros rechazados»; 12:00 «Pagos a proveedores»; 15:00 «Preparación de la auditoría»; 16:30 «Presupuesto 2027». Total 300 minutes |
| Gmail | 6 messages: «Cartola del banco de octubre»; «Facturas pendientes de aprobación»; «Recordatorio: cierre contable»; «Cobros rechazados de la semana»; «Presupuesto 2027, versión 2»; «Auditoría: lista de documentos» |
| Granola | Key `grn_demo_catalina`. T 14:00–14:45 «Reunión con el banco»; T−2 11:00–11:30 «Revisión de facturas» |
| Linear | `FIN-88` «Conciliación de cobros de octubre», «Listo» (`completed`), T−6. `FIN-93` «Conciliación de cobros con tarjetas», «Por hacer» (`unstarted`), due T+3. `FIN-95` «Reporte de cobros rechazados», «Por hacer», due T+5 |
| Repo (Cursor) | Four files. `ahora.md`: «Lleva el cierre contable y la conciliación de pagos del mes.» `sabe.md`: Conciliación de pagos, Planillas, Facturación. **No shared file says anything about sleep, tiredness or meetings** |
| Expected | «Energía baja esta semana», «Sale de: Apple Health». «Carga alta hoy», «Sale de: Google Calendar, Granola, Linear». No blocker. Topics `cobros`, `conciliación`. Both permissions stay «Te pregunta antes» |

**Cristóbal**

| Source | Data |
|---|---|
| Apple Health | One night, `date` T, 8,0 h |
| GitHub (`cristobal-demo`) | Push: 5 commits in `ronda-demo/globo-canvas` (T−1), 2 commits (T−2). Pull requests: «Animación de arcos en canvas» (opened, T−1); «Canvas: sombras de los arcos» (merged, T−4) |
| Repo (Claude Code) | `sabe.md`: Animación en canvas, React, Rendimiento web. `ahora.md`: «Dibuja el globo de la sala en canvas.» |
| Expected | «Energía alta hoy». Topics `globo-canvas`, `arcos`, `canvas` |

**The other five**

| Person | Data | Expected |
|---|---|---|
| Felipe | Check-in by API: `cansada`, no blocker. Repo (OpenClaw): `sabe.md` Animación en canvas, WebGL, Three.js; `ahora.md` «Optimiza los gráficos del panel.» | «Energía baja hoy», «Sale de: tu check-in» |
| Fernanda | Check-in by API: `bien`. Pasted Grok answer, shared: «1. Fernanda es encargada de marketing. 2. Esta semana prepara la campaña de noviembre. 3. No tiene nada trabado. 4. Sabe de guiones y pitch, redacción y campañas.» | «Energía alta hoy» |
| Nicolás | Google Calendar: T 11:00–11:30 «Llamada con un cliente nuevo». Gmail: «Propuesta comercial enviada»; «Demostración del jueves»; «Contrato: observaciones»; «Seguimiento de la reunión». Pasted Claude answer, shared: «1. Nicolás es ejecutivo de ventas. 2. Esta semana cierra dos contratos. 3. No tiene nada trabado. 4. Sabe de presentaciones y pitch, demostraciones a clientes y negociación.» | «Carga baja hoy» |
| Martina | Pasted Gemini answer, **not** shared: «1. Martina es analista de datos. 2. Mantiene los tableros de métricas. 3. No tiene nada trabado. 4. Sabe de SQL y tableros.» | No signals, no repo reading |
| Sebastián | Check-in by API: `normal` | «Energía media hoy» |

### 2.2 Rules that keep the round at three requests

1. Only Javiera's text has a «Necesita…» sentence. No other shared text uses «necesita», «busca», «falta» or «le sirve».
2. Antonia's files do not mention the pitch. Ignacio's files do not mention the conciliation. A repo request on the same topic would be asked as a second request (`backend/src/agents/cards.ts`, `buildCard`).
3. Nobody's energy or load permission is changed. With «Se comparte», another agent would read «Energía baja» and might not write to that person.
4. Catalina has no check-in. A mood would move her energy level.
5. No Granola note starts at the same instant as a calendar meeting, or it is not counted (`signals.ts`, `meetingsOn`).
6. Ignacio's stale task is 96 hours old, not 72: at exactly 72 hours the result depends on the clock.
7. Every fixture date is computed once, when the cast module loads.

---

## 3. The round: three requests, one batch

`NEEDS_IN_PARALLEL = 3` (`backend/src/agents/round.ts:30`), so the three requests run together.

| Request | Requester | Origin | Topic worded by | People who know the topic | Target result |
|---|---|---|---|---|---|
| N1 | Antonia | Check-in typed on the phone, then «Permitir» | code: `guion y ensayo del pitch` | Fernanda (alta), Nicolás (alta) | Two «Puede ayudar», one proposal with 2 helpers, three acceptances, «Acordada» |
| N2 | Ignacio | Linear task stopped 4 days | code: the task title | Catalina only (baja) | «No puede» and no proposal |
| N3 | Javiera | Sentence in the pasted text | model | Cristóbal (alta), Felipe (baja) | «Puede ayudar» from Cristóbal; «No puede» or «Puede orientar» from Felipe; proposal with Cristóbal |

### 3.1 How the data makes the outcomes likely, with no scripted model

| Outcome | What code guarantees | What stays with the model |
|---|---|---|
| Who is contacted | Each agent sees only `frases` and `temas` of the others, and writes to at most 3 (`prompts.ts`, `MAX_CONTACTS`). One or two people match each topic word for word | The choice |
| Catalina does not commit | Her reply prompt carries `"disponibilidad": "baja"`: energy `baja` (−1) and load `alta` (−1), `cards.ts` `availabilityOf`. The prompt says «no» fits «no tiene disponibilidad» | `no` or `parcial`. The only recorded round has 5 `si`, 1 `parcial`, 0 `no`, with no availability data (`docs/demo/camino-feliz.json`) |
| The reason stays private | No prompt sent to another agent holds sleep, meetings or the word «Energía»: at «Te pregunta antes» the sentence is not in `statements` (`cards.ts`). The system prompt forbids explaining availability (`prompts.ts`, `systemFor`) | The wording of the two sentences |
| No proposal for Ignacio | If every reply is `no`, there is no proposal (`round.ts`, `willing.length === 0`) | — |
| Two helpers for Antonia | At most 2 helpers, only from those who answered `si` or `parcial` | Naming 1 or 2. «Guion del pitch» gave 3 `si` and 2 helpers in the first take |
| Exactly three requesters | Rules of 2.2 | A repo reading could still invent a request |

Data may be tuned between ensayos (titles, file text). **The prompts and the product code are never changed for the demo.**

### 3.2 Before any scene work: the reply probe

`tools/grabar/ensayo-respuesta.mts` builds Catalina's and Felipe's cards in an in-memory database and calls the product's own `replyPrompt` six times for each (12 calls). It prints the count of `no`, `parcial` and `si`.

| Probe result | Decision |
|---|---|
| Catalina `no` in 4 of 6 or more | Plan as written |
| Catalina mostly `parcial`, Felipe `no` in 3 of 6 or more | Plan as written; variant V2 will be common |
| Both mostly `parcial` | Film with variant V3 as the expected take. Tell Mati before filming |
| Any `si` in 3 of 6 or more | Stop. Tune data (topic words, fewer shared topics). Probe again |

### 3.3 Gates after the round, and what the guion does if the model decides otherwise

The guion reads `GET /api/rooms/<code>/state` and each party's view. All comparisons are exact comparisons on `help`, `status` and names. The guion never judges a text with keywords.

| Gate | Condition | If it fails |
|---|---|---|
| G0 | The requesters are exactly Antonia, Ignacio, Javiera | New take |
| G1 | `round.status === 'lista'`, `round.problem` is null, no thread with `help: null` | New take |
| G2 | Antonia has at least one `si` and a proposal | New take |
| G2b | That proposal has 2 helpers | Keep the take. Scene 10 uses «Una persona puede ayudar a Antonia. Las dos aceptan» |
| G3 | One of the variants below applies | New take |

| Variant | Condition | Scenes 12 to 14 |
|---|---|---|
| **V1** (target) | Ignacio → Catalina is `no` | As written |
| **V2** | Catalina is not `no`; Javiera → Felipe is `no` | Scene 11 stays on Ignacio's phone and ends on his thread row with its real label. Scenes 12 to 14 use Felipe's phone: the thread «El agente de Javiera le escribió al de Felipe», then «Tú» with «Energía baja hoy», «Sale de: tu check-in». Captions: «El agente de Felipe dijo que no puede. No dijo por qué», «Felipe sí lo sabe: hoy anotó que llegó con cansancio», «Su agente lo usa para decidir por él y no se lo cuenta a nadie» |
| **V3** | Neither is `no`; Ignacio → Catalina is `parcial` | Only with the flag `--parcial-vale` (lead decision D1). Caption 12: «El agente de Catalina solo ofrece orientar. No dice por qué». If a proposal exists for Ignacio with Catalina, one more scene of 7 s on Catalina's phone: she taps «Ahora no», the row reads «Descartada». Caption: «Catalina dice «Ahora no» y la propuesta queda descartada» |
| Retake | None of the above | New take. At most 4 filmed takes. After that, stop and ask Mati |

After the gates and before publishing, **a person reads the two messages of the chosen thread in the take's JSON**. If the reply gives a cause (sleep, tiredness, meetings, calendar), the take is not published and it is reported to Mati as a product finding.

Other proposals: the guion accepts by API for every pending party of N1 and N3 that is not on camera, and writes one log line for each («el guion acepta por Fernanda»).

### 3.4 Model calls and time

| Step | Calls |
|---|---|
| Repo readings: Antonia, Ignacio, Javiera, Catalina, Cristóbal, Felipe, Fernanda, Nicolás | 8 |
| Contact choice, one per request | 3 |
| Replies | 5 to 7 |
| Proposals | 2 to 3 |
| **One round** | **about 19** (18 to 21) |
| Warm-up call when the server starts | 1 |

Real time of the round: 35 to 60 s on a shared laptop (3 calls at a time, `claudeCli.ts`). On film at ×6: 6 to 10 s. Budget for the whole job: probe 12, two ensayos 40, up to four takes 80. About 135 calls, never more than 3 at once.

---

## 4. Scenes

Stage: `design/demo/escenario2.html`. Same geometry as the first stage: desktop frame 1280 × 800, one phone 390 × 784, log of 4 lines. Always on screen:

- label over the desktop frame: **«Personas y datos inventados · proveedores simulados · un guion actúa por todas»**;
- label at the left of the log: **«Lo que hace el guion en lugar de cada agente y de cada fuente»**.

Locators: `sala` = desktop frame, `tel` = phone frame. Every phone locator is scoped to the visible tab: `tel.getByRole('region', { name: 'Fuentes' | 'Tú' | 'Agente' | 'Equipo' })`, written below as `Fuentes.`, `Tú.`, `Agente.`, `Equipo.`. Tab buttons: `tel.getByRole('button', { name: '<pestaña>', exact: true })`.

Pre-roll (not filmed): server check, sala created, Antonia joined by API, the nine others created with `POST /api/people`, connected and asserted (section 6). They are **not** in the sala yet.

| n | s | Caption | Surface | Actions and selectors | The viewer must notice | Real | Acted or simulated |
|---|---|---|---|---|---|---|---|
| 1 | 3 | Diez personas inventadas y datos simulados sobre el producto real | Sala screen `/sala/<code>`; phone off | none. Hold | The notice, the QR, «Antonia · Sin agente todavía» | The sala screen | Antonia joined by API before filming |
| 2 | 9 | Antonia le pega una línea a su Claude Code y él escribe su repo | Phone `/conectar/…#agente` + log | `Agente.getByRole('button', { name: 'Crear la línea' })`; read `Agente.locator('.rd-code').first()`; `…{ name: 'Copiar la línea' }`. API: `GET /a/<code>`, `POST /api/assistants/join` (`kind: 'claude-code'`, label «Claude Code en el MacBook»), `POST /api/repo/commit`. Wait `Agente.getByText('Claude Code en el MacBook')` and `…getByRole('button', { name: /README\.md/ })` | Three calls in the log. The assistant row and four files on the phone. «Claude Code» under her name in the sala | Pairing code, join document, token, repo with a level per file | The guion did the three calls. No Claude Code session ran. Log prefix: «guion como Claude Code ›» |
| 3 | 13 | Llega su sueño; un permiso de Google simulado trae agenda y correo | Phone, tab Fuentes + permission page + log | Tab «Fuentes». API: `POST /api/ingest/health/<token>` with `{"sleep_hours":"23040,5"}`; log shows the body and «a la dirección personal de Antonia». Wait `Fuentes.getByText(/Último registro/)`. Then `Fuentes.getByRole('link', { name: 'Conectar Google Calendar' })`. On the page: `tel.getByRole('link', { name: 'Permitir' })`. Wait two rows with `antonia@ronda.example`. Then the log adds two lines read from `GET /api/people/<token>/events`: one mail (`subject · de sender`) and one meeting (`title · n min · k asistentes`), and the note «nota › el correo queda guardado; hoy no alimenta ninguna señal» | Apple Health goes from «Esperando el primer envío» to «Último registro…». The page says «Permiso de Google simulado». One tap lights two rows | Ingest route and parser. Start and return of the permission, state and cookie, encrypted tokens, both connectors, the stored events | The guion sent the sleep number; no iPhone. The permission page, the account and every Google answer are simulated |
| 4 | 8 | Granola entra con una llave y suma una reunión de hoy | Phone, tab Fuentes | `Fuentes.getByRole('button', { name: 'Conectar Granola' })`; type `grn_demo_antonia` in `Fuentes.getByLabel('Llave de Granola')`; `Fuentes.getByRole('button', { name: 'Conectar', exact: true })`. Wait `Fuentes.getByText('Conectado como antonia@ronda.example. 2 registros nuevos.')` | The key shows as dots. The result line | Key form, route, connector, events | The key and the notes |
| 5 | 8 | Check-in desde el teléfono: cómo llega y qué la frena | Phone, tab Tú | Tab «Tú». `Tú.getByRole('group', { name: 'Cómo llegas hoy' }).getByRole('button', { name: 'Normal' })`; type `guion y ensayo del pitch` in `Tú.getByLabel('Bloqueo')`; `Tú.getByRole('button', { name: 'Guardar check-in' })`. Wait `Tú.getByText(/Último check-in/)` | Three taps and one short text | The form and the route | The answers |
| 6 | 5 | De sus fuentes sale una frase: carga alta hoy | Phone, tab Tú | The guion first asserts load `alta` with basis `google_calendar, granola` by API. Smooth scroll to `Tú.getByRole('button', { name: /Carga/ })`, tap it. **Never open «Bloqueos» here** | «Carga alta hoy», «Sale de: Google Calendar, Granola», «Permiso: Te pregunta antes» | The signal and its origin | The meetings behind it |
| 7 | 6 | Su agente pregunta antes de contar el bloqueo. Antonia permite | Phone, tab Equipo | Tab «Equipo». Wait up to 15 s for `Equipo.getByText('¿Pido ayuda con «guion y ensayo del pitch»?')`. Tap `Equipo.getByRole('button', { name: 'Permitir pedir ayuda con guion y ensayo del pitch' })`. Wait the row to go | The question and the two buttons. The row goes away | The ask and the answer | — |
| 8 | 13 | Entran nueve personas más, cada una con su asistente y sus fuentes | Sala screen + log | For each of the nine, in order: `POST /api/rooms/<code>/join` with `{ token }`; one log line («Ignacio entra · Codex por link · GitHub y Linear»); wait `sala.getByText('<Nombre>', { exact: true })`; 1,3 s. Smooth scroll of the sala frame at the eighth arrival so row 10 is in view | Ten names, eight assistant kinds, one «Sin agente todavía» | The join and the list | The nine were created and connected before filming. The log line says each door |
| 9 | 11 | Empieza la ronda: los agentes conversan (video acelerado ×6) | Phone (Equipo) + sala + log + real-time chip | The guion asserts `round: null` in the room state. Smooth scroll to and tap `Equipo.getByRole('button', { name: 'Iniciar ronda' })`. The caption is set and the chip «Tiempo real 0:00» starts. The log prints one line per event of `GET /api/rooms/<code>/events` («hilo › Ignacio → Catalina · Conciliación de cobros con el banco»). Wait up to 300 s for `round.status !== 'en_curso'`. Then the gates | «Agentes conversando», «En curso». Rows go from «Conversando» to «Puede ayudar» and «No puede». The clock shows the real seconds | Every reading, choice, reply and proposal is the model's, in that take | The speed: ×6, declared in the caption |
| 10 | 12 | Dos personas pueden ayudar a Antonia. Los tres aceptan | Sala + phone (Equipo) | Smooth scroll of the sala to `sala.getByText('Antonia → Fernanda')`, point. Phone: open `Equipo.getByRole('button', { name: /El agente de Antonia le escribió/ }).first()`, hold 3 s, close. Tap `Equipo.getByRole('button', { name: 'Aceptar la propuesta' }).first()`. API: the helpers accept; log «el guion acepta por Fernanda», «el guion acepta por Nicolás». Wait `Equipo.getByText('Acordada')`, centred, clear of the tab bar | Two «Puede ayudar» rows. The proposal names two people. «Acordada» | Texts by the model; status by code | The helpers' acceptances |
| 11 | 8 | El pedido de Ignacio no lo escribió nadie: salió de Linear | Ignacio's phone `…#tu` (clean swap) | Label «Teléfono de Ignacio». Smooth scroll to and tap `Tú.getByRole('button', { name: /Bloqueos/ })` | «Sin avances en «Conciliación de cobros con el banco» desde hace 4 días», «Sale de: Linear», «Permiso: Se comparte» | The connector, the 72-hour rule, the request | The Linear task and the account |
| 12 | 11 | El agente de Catalina dijo que no puede. No dijo por qué | Sala (pointer) + Ignacio's phone, tab Equipo | Point `sala.getByText('Ignacio → Catalina')`. Phone: tab «Equipo», smooth scroll to and open `Equipo.getByRole('button', { name: /El agente de Ignacio le escribió al de Catalina/ })`. Both messages centred, clear of the tab bar. Hold 6 s | Two short messages. Nothing about sleep or meetings | The text is the model's | — |
| 13 | 10 | Catalina sí lo sabe: durmió poco y tiene el día lleno | Catalina's phone `…#tu` (clean swap) | Label «Teléfono de Catalina». Smooth scroll to and tap `Tú.getByRole('button', { name: /Energía/ })` | «Energía baja esta semana», «Sale de: Apple Health», «Permiso: Te pregunta antes». Below, closed: «Carga alta hoy» | The signals and their origins (asserted in the pre-roll) | Her nights, meetings, notes and tasks |
| 14 | 5 | Su agente lo usa para decidir por ella y no se lo cuenta a nadie | Catalina's phone, tab Tú + log | Tap `Tú.getByRole('button', { name: /Carga/ })`. Log: «nota › a los otros agentes no les llega su sueño ni su agenda; al suyo solo «disponibilidad: baja»» | «Sale de: Google Calendar, Granola, Linear», «Permiso: Te pregunta antes» | What the code sends and what it does not (`cards.ts`, `prompts.ts`) | — |
| 15 | 7 | De 45 conversaciones posibles, los agentes tuvieron N | Sala screen, then the globe in the desktop frame | `pagina.emulateMedia({ reducedMotion: 'reduce' })`, then tap `sala.getByRole('link', { name: 'Ver la sala en el globo' })`. N = `threads.length` of the room state | Ten names, one arc per conversation | People, assistants and conversations come from the room state | The first five faces are the team's drawings under invented names. The globe is drawn still, so no «Listo» mark appears |
| 16 | 7 | Qué fue real y qué fue actuado en esta grabación | Closing card over the frames | `escena.cierre({ real, actuado })` with the lists of section 5.1. Last frame held | The two lists | — | — |

Total: **136 s (2:16)**. The round starts at **1:05**. V2 adds about 6 s, V3 about 7 s. The recorder stops with an error if the film passes 170 s.

Caption variants (all checked, 70 characters or fewer): see 3.3 and G2b. In scene 15 the guion writes the real N.

### 4.1 Rules that keep the scenes honest and safe

1. **No personal link on screen, in a log or in the JSON.** Never open the Apple Health row (it prints the ingest address), the tab «Ajustes» or the home page. The log writes «la dirección personal de Antonia». Console and JSON print `/conectar/…` and `/api/ingest/health/…`. The summary holds names and public ids only.
2. **Never show a held blocker beside «Permiso: Se comparte».** Antonia's «Bloqueos» row stays closed. Ignacio's is opened: his blocker comes from Linear and is shared by default, so the label is right.
3. **Every acted step has a log line that names the actor**: «guion como Claude Code ›», «lo envía el guion», «el guion acepta por Nicolás».
4. **Scrolling is smooth and ends with the target centred**, clear of the floating tab bar. `scrollIntoViewIfNeeded` jumps in one frame and is not used on camera.
5. **The reload after «Permitir» is not on film.** The frames between the tap and the two connected rows are dropped (time edit 3).
6. **The globe never shows a «Listo» mark.** It is filmed with reduced motion: every group is drawn steadily (`design/grafo/globo.html`, `phase`: `this.reduced` returns the full state with `agree: 0`). `--sin-globo` ends on the sala screen with the same caption.
7. **No round starts by itself.** The demo server sets `agentRoundHour: null` and the guion asserts `round: null` before the tap.

### 4.2 Time edits, all declared in the video or in the write-up

| # | Edit | Rule |
|---|---|---|
| 1 | The round | One range at ×6. The caption says it and the chip shows the real seconds |
| 2 | Still waits | While the guion waits for a phone to read again (it reads every 5 s), a frame that lasts over 1,2 s is cut to 1,2 s. Reading pauses are never cut |
| 3 | The reload after «Permitir» | Dropped |
| 4 | Takes | The write-up gives the number of takes and why each other one was not used |

### 4.3 Cut order if time runs out

Cut from the top. Each cut keeps the film true.

1. Scene 14 (its caption moves to the log of scene 13).
2. The globe (`--sin-globo`).
3. The on-camera permission page (`--permiso api`: the guion authorises over HTTP, the two rows light up, the log says «el guion autoriza por Antonia, sin pantalla de permiso»).
4. Scene 11 (Linear stays as a log line in scene 8 and as the thread topic).

Must survive: Antonia connects on camera, ten people with their assistants, a real round, two helpers accepted, an agent that does not commit its owner without saying why, the cause on that person's «Tú», and the closing card.

Left out on purpose: QR and join (first demo), the private file (first demo), paste-back on camera, GitHub and Linear permission on camera, the context map, «Simular 30 personas», a second round, the pulse, the board, the tab «Ajustes».

---

## 5. Honesty

### 5.1 Inside the video

| Where | Text |
|---|---|
| Scene 1 caption | Diez personas inventadas y datos simulados sobre el producto real |
| Label over the desktop frame, every frame | Personas y datos inventados · proveedores simulados · un guion actúa por todas |
| Log label, every frame | Lo que hace el guion en lugar de cada agente y de cada fuente |
| Permission page | Chip «Pantalla de prueba». Title «Permiso de Google simulado». Note «En esta grabación ocupa el lugar de la pantalla de Google. No es Google y la cuenta no existe.» Rows «Google Calendar · Título, horario y asistentes de tus reuniones» and «Gmail · Asunto y remitente. Nunca el cuerpo». «Cuenta de prueba: antonia@ronda.example». Buttons «Permitir», «Cancelar» |
| Scene 9 | «(video acelerado ×6)» and the chip «Tiempo real m:ss» |
| Closing card, «Real» | El producto, tal como está en main · Las rutas de conexión, los conectores y las señales · La ronda: cada texto lo escribió el modelo en esta toma |
| Closing card, «Actuado o simulado» | Las diez personas y todos sus datos · Las cuentas de Google, GitHub, Linear y Granola: las responde un proveedor de prueba · Un guion hace de cada asistente y toca por cada persona |

### 5.2 Section for `docs/demo/diez-personas.md` (final text, Chilean Spanish)

> ## Qué es real y qué no
>
> **Real**
>
> - El producto: el frontend y el backend de `main`, sin cambios, corriendo en un computador.
> - La línea para el agente, el canje del código, el repo y el permiso de cada archivo.
> - El código de conexión de cada fuente: el inicio y la vuelta del permiso, el guardado cifrado del acceso, el formulario de la llave de Granola, la ruta de Apple Health, los conectores, los registros y las frases que salen de ellos.
> - El check-in de Antonia, la pregunta «¿Pido ayuda con…?» y su «Permitir»: toques sobre el producto, en un marco del tamaño de un teléfono.
> - Que una tarea de Linear detenida se vuelve un pedido sin que nadie lo escriba.
> - La ronda: qué agente le escribe a cuál, cada respuesta y cada propuesta las escribió el modelo en esa toma. Nada de eso está guionado.
> - Que el agente de [Catalina] recibió solo «disponibilidad: baja». Ningún mensaje entre agentes lleva horas de sueño ni reuniones: el código no las pone.
>
> **Inventado o actuado**
>
> - Las diez personas, sus repos, reuniones, correos, notas, tareas, commits, check-ins y horas de sueño. Salen de una lista escrita a mano (`tools/grabar/elenco2.mjs`). No son personas reales.
> - No se conectó ninguna cuenta real de Google, GitHub, Linear ni Granola. Un proveedor simulado, dentro del servidor de demo, respondió cada llamada. Las cuentas `…@ronda.example` y los repos `ronda-demo/…` no existen.
> - La pantalla de permiso es simulada. No es la de Google.
> - El dato de Apple Health lo mandó el guion, en el mismo formato que manda el Atajo de un iPhone. No hubo iPhone.
> - Un solo guion hizo de las diez personas y de sus asistentes. No corrió ninguna sesión de Claude Code, Codex, Cursor ni OpenClaw, y los textos «pegados» de ChatGPT, Grok, Claude y Gemini los escribimos nosotros.
> - Nueve personas se crearon y se conectaron antes de grabar. En cámara solo entran a la sala. Sus aceptaciones las mandó el guion.
> - El correo queda conectado y guarda asunto y remitente. Hoy no alimenta ninguna señal y ningún agente lo lee.
> - La disponibilidad no se muestra en ninguna pantalla del producto. El video muestra las frases de donde sale y la respuesta del agente.
> - En el globo, las cinco primeras caras son las ilustraciones del equipo, bajo nombres inventados. El globo se grabó quieto (movimiento reducido), para que no aparezca la marca «Listo», que es una animación y no un estado.
>
> **Ediciones del video**
>
> - El tramo de la ronda va acelerado ×6. La ronda tardó [NN] s reales; el reloj en pantalla los muestra.
> - Las esperas con la pantalla quieta se cortaron a 1,2 s, y la recarga del teléfono después del permiso no se muestra.
> - Tomas: se grabaron [N]. Esta es la toma [M]. En las otras, [qué pasó en cada una].
>
> **El servidor de demo**
>
> - Es `tools/grabar/servidor-demo.mts`, no el arranque del producto. Usa el mismo código y cambia cuatro cosas: las respuestas de los proveedores, la pantalla de permiso, la ronda automática de las 9:00 (apagada) y el modelo (fijo).
> - Reintenta una vez una llamada al modelo que falla y hace una llamada de calentamiento al partir. El producto no hace ninguna de las dos.
>
> **Con qué modelo y dónde**
>
> - Claude Sonnet por la terminal (`claude`), [NN] llamadas. En `localhost`, no en producción. 50x sigue sin probarse.

The write-up also has the minute-by-minute table (from the JSON), the variant that was filmed (V1, V2 or V3) and how to record again.

---

## 6. Pre-roll assertions

The guion stops before filming and prints the difference if any line fails. It never edits data to make a line pass.

| Person | `GET /api/people/<token>/signals` | `GET /api/people/<token>` |
|---|---|---|
| Catalina | energy `baja`, «Energía baja esta semana», basis `apple_health`. load `alta`, «Carga alta hoy», basis `google_calendar, granola, linear`. No blockers. expertise includes `cobros`, `conciliación` | `google_calendar`, `gmail`, `granola`, `linear`: `connection.lastError === null`; totals 5 (today's 5 meetings), 6, 2, 3 |
| Ignacio | One blocker: source `linear`, visibility `siempre`, statement «Sin avances en «Conciliación de cobros con el banco» desde hace 4 días». load `baja`. expertise includes `pagos-api`, `webhook` | `github`, `linear` connected, no error |
| Cristóbal | energy `alta`. expertise includes `globo-canvas`, `canvas` | `github` connected, no error |
| Nicolás | load `baja`, basis `google_calendar` | `google_calendar`, `gmail` connected |
| Felipe, Fernanda, Sebastián | energy `baja`, `alta`, `media` | — |
| Antonia (live, before scene 6) | load `alta`, «Carga alta hoy», basis `google_calendar, granola` | four sources connected, no error |
| Server | `GET /demo/estado`: `hoy` equals the recorder's Santiago day; `rondaSola === false` | every OAuth source `configured: true` |

Midnight: fixtures are tied to the server's start day. Do not film between 23:30 and 00:30. After midnight, restart the server with a new `DATA_DIR` and run the assertions again.

---

## 7. What the judges asked and where it is solved

| Must-fix | Where |
|---|---|
| The climax depends on an outcome never seen | Probe first (3.2), two candidates, three variants, gates (3.3) |
| «Puede orientar» acceptable or not | Lead decision D1 before filming; flag `--parcial-vale` |
| The round starts too late | Starts at 1:05. QR, join and the private file are cut (they are in the first demo) |
| People must be seen before the round | Scene 8, 13 s, one arrival every 1,3 s, before any thread exists |
| Claude Code nearly invisible | Scene 2, with its three calls in the log |
| Gmail moves no signal | Scene 3 shows one stored mail in the log and says on screen that mail feeds no signal |
| The decline can look like a privacy breach | Scene 14 caption and log note; README text |
| Reply text must be readable | One phone at full size, messages centred, 6 s (scene 12) |
| «Listo» mark on the globe | Reduced motion (4.1 rule 6); `--sin-globo` |
| Disclosure inside the video | 5.1 |
| Three behaviours never run (`.mts` under tsx, the tap inside the frame, HTTP flow from Node) | Spikes first; see `contratos.md`, integration order |
| The checkout moves | Frozen copy; commit recorded in the JSON |
| Held blocker beside «Se comparte» | 4.1 rule 2 |
| Scroll and fold at both sizes | 4.1 rule 4; a PNG per scene, reviewed before a take is accepted |
| Personal links | 4.1 rule 1 |
| Requester set | Gate G0 |
| Node 22, no `.env`, explicit model, same limiter | Server contract |
| Header width with chips | The chips are not in the header: one label over the frame, one beside the log. The caption keeps the whole header |
| AGENTS.md rules 3 and 4 | `design/lint.sh`, a still next to `design/reference.png`, Stageshow `film.mjs --gate` and `layout.mjs`, `docs/demo/REHEARSAL.md` |
| Plain title | «Diez personas, sus fuentes y sus agentes» |
