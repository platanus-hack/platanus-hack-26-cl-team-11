# Pitch

Cómo se explica Montu en una frase, en dos minutos y medio, y frente a preguntas. Está armado con las guías públicas de Y Combinator; las fuentes están al final.

Todo dato de avance viene de pruebas hechas el 21-nov-2026. Lo que falta decidir está en [Pendientes](#pendientes).

## En una frase

> **Montu le da a cada persona de un equipo un agente que la conoce. Los agentes conversan entre sí y le dicen a cada persona quién la puede ayudar, sin reuniones.**

Versiones para otros momentos:

| Para | Frase |
|---|---|
| Decirlo en voz alta | «Le escribes por WhatsApp a tu agente en qué estás trabado y en un minuto te propone a la persona de tu empresa que sabe de eso.» |
| Compararlo con algo conocido | «Es la daily, pero la hacen los agentes en vez de las personas.» |
| Dos frases, con el porqué | «Montu le da a cada persona un agente que la conoce. Los agentes conversan entre sí, así que una empresa de 300 personas se coordina sin que nadie tenga que ir a una reunión.» |

Reglas de YC que cumple, y que hay que cuidar al cambiarla:

- **Lo que haces va en la primera frase**, en las palabras más simples. Paul Graham: la mejor respuesta es la más directa.
- **Sin palabras de marketing.** Fuera «plataforma», «revolucionar», «inteligencia organizacional», «multiagente». Michael Seibel pide que suene más simple de lo que crees que debería.
- **Mejor angosta que general.** Una frase que cuenta la mitad del potencial ya es buena. «Coordina equipos con agentes» dice menos que «te dice quién te puede ayudar».
- **Compararse con algo conocido sirve.** Por eso la daily.
- **Prueba del correo** (Seibel): mándale las dos frases a alguien fuera del equipo y pídele que te lo explique con sus palabras. Si pregunta algo para entender, hay que reescribir.

## Los cuatro puntos que tienen que recordar

Geoff Ralston pide armar la presentación sobre tres o cuatro ideas, porque es lo que la audiencia retiene. Responden cuatro preguntas:

| Pregunta de YC | Respuesta de Montu |
|---|---|
| ¿Qué construyen y para quién? | Un agente personal para cada persona de un equipo. Los agentes conversan entre sí y de ahí salen propuestas de ayuda que cada persona acepta. |
| ¿Por qué nadie lo hizo antes? | Los agentes personales que existen trabajan cada uno por su lado. Las herramientas que miran a los equipos trabajan para RR. HH., no para la persona. Nadie juntó las dos cosas. |
| ¿Por qué es difícil? | Sin confianza no hay señal: si la persona cree que su agente la reporta, no le cuenta nada. Por eso el agente es de la persona, pregunta antes de contar y respeta el no. |
| ¿Por qué ahora? | Cada vez más personas ya usan un agente (Claude Code, Codex, ChatGPT). Falta la capa que los hace conversar. Y una ronda entre agentes ya toma segundos, no horas. |

## Lo que sabemos y otros no

YC llama «unique insight» a lo que entiendes del problema y los demás no. Tiene que ser específico; «lo hacemos mejor» no cuenta.

1. **La comunicación crece al cuadrado y la gente en línea recta.** Con 5 personas hay 10 conversaciones posibles; con 300 hay 44.850. Las jerarquías, las reuniones y los reportes existen para perder información a propósito, porque nadie puede tener esas conversaciones. Un agente sí puede.
2. **El agente tiene que ser de la persona, no de la empresa.** Es lo que hace que la persona le cuente la verdad. Las herramientas de personas fallan aquí: el dato termina en RR. HH. y llega tarde.

## La estructura completa

Michael Seibel ordena un pitch en siete preguntas. Estas son las respuestas de hoy.

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | ¿Qué hacen? | La frase de arriba. Sin introducción al problema antes. |
| 2 | ¿Qué tan grande es el mercado? | Falta calcularlo, de abajo hacia arriba: empresas de 50 a 500 personas que ya pagan herramientas por persona, por el precio por persona. Ver [Pendientes](#pendientes). No usar «el 1 % de un mercado enorme». |
| 3 | ¿Cuánto han avanzado? | Ver [Avance](#avance). YC mira cuánto hiciste en el tiempo que llevas: esto se construyó en la hack, desde el 20-nov. |
| 4 | ¿Qué saben que otros no? | Los dos puntos de arriba. |
| 5 | ¿Cómo ganan plata? | Falta decidirlo. Lo más simple es un precio mensual por persona, que paga la empresa. Seibel pide un solo modelo, no una mezcla. |
| 6 | ¿Quién es el equipo? | Cinco personas del equipo de Vita, que ya trabajan juntas. Vivimos el problema: somos un equipo chico al que le cuesta saber quién está trabado y en qué. Falta elegir el dato más notable de cada uno. |
| 7 | ¿Qué quieren? | En la hack: que el jurado lo pruebe con su teléfono. Hay que decirlo directo. |

### Avance

Lo que se puede decir sin exagerar, porque está probado:

| Qué | Dato |
|---|---|
| Ronda entre agentes con el modelo real | 11 segundos: 2 conversaciones y 1 propuesta |
| El recorrido completo por WhatsApp, en producción y con un teléfono real | Check-in, permiso, ronda y propuesta en menos de 2 minutos; la ronda tomó 15 segundos |
| Una pregunta a todo el equipo | Respuesta armada en 11 segundos, con lo que aportaron 3 agentes |
| Entrar con un QR y conectar el agente que ya usas | Probado con Claude Code y con Codex |
| Datos reales de una persona | Sueño de un iPhone por Apple Health |
| 60 personas simuladas, con el modelo real | 89 conversaciones entre agentes en 4 minutos y medio |
| Pruebas automáticas | 205 pasando |

## Guion de 3 minutos

La presentación es `design/pitch/index.html` (en prod: [montu.fun/dec](https://montu.fun/dec)). Las notas de cada lámina están en la tecla N. No es un texto para leer: es la dirección de cada momento y la frase que no puede faltar. Con tus palabras, más lento de lo que parece natural.

**El arco en una línea:** todos ya le damos nuestra vida a un agente; pero los agentes no se hablan; un equipo no puede tener todas las conversaciones que necesita; los agentes sí; y el tuyo es tuyo.

### Acto 1 · El problema (0:00 a 1:35)

| Tiempo | Lámina | Dirección | La frase que tiene que quedar |
|---|---|---|---|
| 0:00 | 1 · «Un agente por persona.» | Presentarse y decir qué hacemos, sin preámbulo. La esfera con las caras ya dice «equipo». | «Somos Montu. Le damos a cada persona un agente que la conoce, y hacemos que esos agentes conversen entre sí.» |
| 0:15 | 2 · «Alinear a un equipo es difícil.» (tres clics) | Partir de algo que todos vivieron: no saber quién está trabado ni quién sabe de qué. Clic: todos ya trabajan con un agente. Clic: cada agente está solo. | «Entre esos agentes hay cero conversaciones.» |
| 0:45 | 3 · «Tu agente ya sabe todo de ti.» | El giro de contexto: WhatsApp, calendario, correo, salud, código, reuniones ya llegan a tu agente. Dejar que se enciendan los íconos. | «Ese conocimiento ya existe. Falta usarlo para alinear al equipo.» |
| 1:10 | 4 · «300 personas, 44.850 conversaciones.» | Por qué las personas no pueden: cada persona nueva suma una conversación con cada una de las demás. Dejar rodar el número. | «Ningún humano puede tener 44.850 conversaciones. Por eso existen las reuniones y las jerarquías, y por eso se pierde información.» |

### Acto 2 · La solución (1:35 a 2:35)

| Tiempo | Lámina | Dirección | La frase que tiene que quedar |
|---|---|---|---|
| 1:35 | 5 · «Los agentes sí pueden tenerlas.» | El globo en vivo, y la demo por WhatsApp: «estoy trabada con…», Permitir, llega la propuesta. Si falla la red, tecla V (grabación) y se dice que es grabada. | «Los agentes no se cansan. Una ronda toma 15 segundos, y a ti te llega una sola cosa: quién te puede ayudar.» |
| 2:15 | 6 · «Tu agente es tuyo.» | Adelantarse a la pregunta de vigilancia. Tocar «Permitir» en la tarjeta. | «Si crees que tu agente te reporta, no le cuentas nada. Por eso pregunta antes de contar, y lo que duermes o sientes no sale nunca.» |

### Acto 3 · El cierre (2:35 a 3:00)

| Tiempo | Lámina | Dirección | La frase que tiene que quedar |
|---|---|---|---|
| 2:35 | 7 · «Pruébalo ahora.» | Repetir la idea en una línea y pedir algo concreto. Quedarse callado con el QR en pantalla. | «Un agente por persona. Los agentes conversan. Tú recibes solo las conversaciones que necesitas tener. Escaneen y pruébenlo.» |

Si falta tiempo, se acorta la demo de la lámina 5, nunca las láminas 2 y 4: son el porqué.

Cómo presentarlo, según Ralston y Hale:

- **Presenta una sola persona**, la que mejor lo hace. Habla más lento de lo que parece natural y mira a la audiencia, no a la pantalla.
- **Primero el relato, después las láminas.** La audiencia no puede leer y escuchar a la vez.
- **Termina fuerte.** Repite los puntos que quieres que recuerden y di qué quieres que hagan.
- **Ensaya.** Es la única regla de preparación que da Ralston.

### La demo en vivo

YC desaconseja las demos y los videos en un Demo Day, porque fallan y nadie alcanza a leerlos. En una hack la demo es lo que se evalúa, así que va, con estos cuidados:

- **Un solo recorrido**, el de WhatsApp. No mostrar todas las pestañas.
- **Respaldo grabado.** Si falla la red, se muestra [demo/camino-feliz.mp4](demo/camino-feliz.mp4) y se dice que es una grabación.
- **Con el número de prueba de Kapso solo responde un teléfono.** Para que el jurado escriba por WhatsApp hace falta un número propio; si no lo hay, el jurado entra por el QR y el WhatsApp lo muestra quien presenta.

## Las láminas

Kevin Hale: entre cinco y siete láminas, una idea por lámina. Están en `design/pitch/index.html`.

| # | Texto de la lámina | Idea |
|---|---|---|
| 1 | Un agente por persona. | Qué hacemos (la esfera de la entrada con el equipo) |
| 2 | Alinear a un equipo es difícil. → Hoy todos trabajan con su agente. → Pero los agentes no se hablan. | El problema, en tres clics |
| 3 | Tu agente ya sabe todo de ti. | El contexto ya existe |
| 4 | 300 personas, 44.850 conversaciones. | Por qué las personas no pueden |
| 5 | Los agentes sí pueden tenerlas. | El giro; después va la demo |
| 6 | Tu agente es tuyo. | Privacidad |
| 7 | Pruébalo ahora. | El QR, una ronda en 15 s y los agentes que ya usas |

Reglas de Hale y Ralston:

- **Legible desde el fondo:** letra grande, en negrita, con contraste, y el texto arriba.
- **No más de siete palabras por lámina.** Mejor una imagen que palabras.
- **Se entiende de un vistazo.** Si un desconocido mira la lámina y no dice tu idea, la lámina no sirve.
- **Sin capturas de pantalla:** casi siempre son ilegibles. Sin animaciones, memes ni diagramas complicados.
- **Los gráficos llevan su conclusión escrita** como título.

## Preguntas difíciles

YC pide llegar con las objeciones ya pensadas y contar los defectos antes de que los encuentren.

| Pregunta | Respuesta corta |
|---|---|
| ¿No es vigilancia para jefes? | No. El agente es de la persona: pregunta antes de contar un bloqueo y respeta el no. El líder ve solo totales del grupo, nunca una respuesta individual. |
| ¿En qué se diferencia de un agente personal como Instinct? | Esos aceleran a cada persona por separado. Montu es lo que pasa entre los agentes: la coordinación del equipo. |
| ¿Y de Culture Amp, Viva u Oura Teams? | Terminan en un panel para RR. HH. Aquí el dato es de la persona y termina en una acción: «habla con ella, sabe de esto». |
| ¿Por qué no un canal de Slack? | Porque pedir ayuda en público cuesta, y nadie lee 300 canales. El agente pregunta por ti y te trae una sola respuesta. |
| ¿Qué pasa si el agente inventa? | El agente solo cuenta lo que su persona dejó compartir, y nada queda comprometido sin que la persona acepte. Si ningún agente sabe, lo dice. |
| ¿Escala a 300? | No está probado con 300. Con 60 personas simuladas y el modelo real, una ronda tuvo 89 conversaciones entre agentes y tomó 4 minutos y medio; con 30, 45 conversaciones en menos de 2 minutos. El tiempo crece con los pedidos, no con el cuadrado de las personas, y hoy lo limita que el modelo atiende 4 llamadas a la vez. |
| ¿Qué es real hoy? | La tabla de [DEMO.md](DEMO.md#qué-es-real-y-qué-puede-ser-simulado). Lo simulado se dice. |

Lo que hay que decir sin que lo pregunten:

- El agente todavía no escribe primero en la mañana: la persona escribe primero.
- El agente responde un mensaje a la vez; no recuerda la conversación.
- De las fuentes de datos, solo Apple Health está probada con datos reales.

## Con quién nos comparan

De [ROADMAP.md](ROADMAP.md#qué-existe-hoy-en-estados-unidos). Una línea por cada uno:

| Ellos | Qué hacen | Qué les falta |
|---|---|---|
| Instinct, Meta Muse, OpenAI | Un agente por persona | Los agentes no se coordinan entre sí |
| WHOOP Unite, Oura Teams | Sueño y recuperación del equipo | Terminan en un panel; nadie actúa |
| Culture Amp, Lattice, Viva | Encuestas y señales para RR. HH. | El dato es de la empresa y llega tarde |
| Glean | Busca en documentos | No le pregunta a las personas |

## Y Combinator y «Multiplayer AI»

- **Lo que se puede decir:** según varios artículos sobre los pedidos de startups de YC para Fall 2026, uno de los 13 se llama «Multiplayer AI», de Aaron Epstein. Su argumento es que la colaboración hizo ganar a Google Docs y a Figma, y que la IA todavía no tiene su momento multijugador.
- **Lo que no se pudo verificar:** el texto original. La página oficial muestra hoy la lista de Winter 2027, que no incluye ese pedido, y el anuncio de Fall 2026 no cargó.
- **Cuidado al citarlo:** ese pedido habla de sesiones compartidas donde un equipo mira y redirige a un agente. Montu es otra cosa: un agente por persona, que conversan entre sí. Se puede decir que YC pidió IA multijugador; no que pidió esto.

## Pendientes

- [ ] **Cuánto dura la presentación en la hack** y si hay preguntas del jurado. El guion está hecho para 2:30.
- [ ] **Quién presenta.** Una sola persona.
- [ ] **Track de la hack** y **nombre** definitivo.
- [ ] **Precio y tamaño del mercado.** Falta el precio por persona y el número de empresas a las que se les puede vender primero.
- [ ] **Número propio de WhatsApp**, si el jurado va a escribirle al agente.
- [ ] **Prueba del correo** con alguien fuera del equipo.
- [ ] **Ensayo cronometrado**, con la demo y con el respaldo grabado.

## Fuentes

Guías de Y Combinator, leídas el 21-nov-2026:

1. [Paul Graham — How to Apply to Y Combinator](https://www.ycombinator.com/howtoapply): cómo describir lo que haces.
2. [Michael Seibel — How to Pitch Your Company](https://www.ycombinator.com/blog/how-to-pitch-your-company/): las siete preguntas y la prueba del correo.
3. [Geoff Ralston — A Guide to Demo Day Presentations](https://www.ycombinator.com/blog/guide-to-demo-day-pitches/): los puntos que se recuerdan, el orden y cómo presentar.
4. [Kevin Hale — How to Design a Better Pitch Deck](https://www.ycombinator.com/blog/how-to-design-a-better-pitch-deck/): las láminas.
5. [Solicitud de Dropbox a YC](https://www.ycombinator.com/apply/dropbox): ejemplo de respuestas directas.
6. [Requests for Startups de YC](https://www.ycombinator.com/rfs): lista vigente, Winter 2027.

Sobre «Multiplayer AI» en Fall 2026, solo fuentes secundarias:

7. [Poly — YC's Multiplayer AI request for startups, explained](https://usepoly.co/yc-multiplayer-ai)
8. [Mining Wells — las 13 ideas de Fall 2026](https://miningwells.com/blog/yc-request-for-startups)
9. [Superframeworks — YC's Fall 2026 RFS](https://superframeworks.com/articles/yc-fall-2026-rfs-indie-hacker-plays)

No se pudo leer la guía de YC para el deck de una ronda semilla: la página no cargó.
