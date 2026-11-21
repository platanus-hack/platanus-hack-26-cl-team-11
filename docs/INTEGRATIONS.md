# Integraciones

Cómo entra la señal de cada persona a su memoria privada. Investigación hecha el 21-nov-2026; lo que no pudimos confirmar va marcado.

## La idea

Todo conector hace una sola cosa: convierte su fuente en **eventos con el mismo formato** y los deja en la memoria privada de la persona. El agente nunca habla con la fuente; solo lee eventos.

| Campo del evento | Contenido |
|---|---|
| Persona | A quién pertenece |
| Fuente | `apple_health`, `google_calendar`, `gmail`, `granola`, `github`, `linear`, `checkin` |
| Tipo | `salud_diaria`, `reunion`, `correo`, `nota_de_reunion`, `commit`, `pull_request`, `tarea`, `checkin` |
| Cuándo ocurrió | Fecha del hecho, no de la recepción |
| Resumen | Una línea legible |
| Dato crudo | Lo que mandó la fuente, sin tocar |

Cada persona tiene una página `/conectar/<token>` con una fila por fuente. Hoy el link se crea en la portada o con `npm run add-person`; que su agente se lo mande por WhatsApp no está construido. El token del link es su identidad: no hay cuentas ni contraseñas.

## Estado

| Fuente | Cómo se conecta | Estado |
|---|---|---|
| Apple Health | Atajo de iOS que envía a una URL personal | **Probado con un iPhone real** el 21-nov-2026 con el Atajo mínimo: llega el sueño y se deriva la energía. El envío de varios días, los botones de la página y el Atajo compartido están construidos; el Atajo compartido falta probarlo en un iPhone |
| GitHub | OAuth | Aplicación creada y credenciales en Render (21-nov-2026). Abierta a cualquier cuenta. Falta probar la conexión con una cuenta real |
| Linear | OAuth | Aplicación creada en el workspace `usevita`, pública para cualquier workspace, con credenciales en Render (21-nov-2026). Falta probar la conexión |
| Google Calendar | OAuth de Google | Cliente creado en el proyecto `ronda-hack26` y publicado en producción sin verificar (21-nov-2026): entra cualquier cuenta de Google, con la advertencia de app no verificada y un tope de 100 personas. Falta probar la conexión |
| Gmail | El mismo OAuth de Google | Construido; guarda solo asunto, remitente y fecha |
| Granola | OAuth, por su servidor MCP | Construido. Un botón «Conectar», sin llave. Funciona en el plan gratis de Granola, con los últimos 30 días. Falta probarlo con una cuenta real |
| Google Health | El mismo OAuth de Google | No empezado |
| Whoop | — | Fuera de la hack |

Salvo Apple Health, ninguna fuente está probada contra el servicio real: las pruebas usan respuestas simuladas.

### Aplicaciones OAuth

Las tres están creadas desde el 21-nov-2026 y sus variables están cargadas en Render. Cada una tiene un identificador y un secreto. Nunca van en el repo. Las tres aceptan también el retorno a `http://localhost:8787` y `http://localhost:5173`, para probar en local.

| Servicio | Dónde se crea | Dirección de retorno | Variables |
|---|---|---|---|
| GitHub | github.com/settings/developers → OAuth Apps | `https://ronda-n8if.onrender.com/api/oauth/github/callback` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| Linear | Settings → API → OAuth applications | `https://ronda-n8if.onrender.com/api/oauth/linear/callback` | `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` |
| Google | Google Cloud → Credenciales → Cliente OAuth web | `https://ronda-n8if.onrender.com/api/oauth/google/callback` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |

GitHub pide solo `read:user`, así que lee la actividad pública. Leer repos privados exige el permiso `repo`, que también da escritura, y por eso queda fuera. Linear pide `read`.

Una fuente OAuth sin credenciales en el servidor aparece en la página como «Falta configurarla en el servidor».

Las fuentes conectadas se vuelven a sincronizar solas cada 15 minutos.

### Para activar Google

1. Crea un proyecto en Google Cloud y habilita las APIs de Calendar y Gmail.
2. Crea un cliente OAuth web con la dirección de retorno `<PUBLIC_BASE_URL>/api/oauth/google/callback`.
3. Agrega a cada integrante como usuario de prueba. Con la app sin verificar, los accesos caducan a los 7 días.
4. Define `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `PUBLIC_BASE_URL`.

## Apple Health

No tiene API en la nube: los datos viven en el iPhone. Hay tres caminos.

| Camino | ¿La persona baja una app? | Decisión |
|---|---|---|
| **Atajo de iOS** con las acciones «Buscar muestras de salud» y «Obtener contenido de URL» | No. Atajos viene en todo iPhone | **Elegido** |
| Health Auto Export, app de terceros que manda JSON a un webhook | Sí, y es de pago | Respaldo |
| Agregadores (Terra, Junction, Spike) | Sí: exigen su SDK dentro de una app nativa nuestra | Descartado |

Límites del Atajo:

- **Teléfono bloqueado.** Una automatización programada puede correr sin enviar nada. Por eso el envío parte con un toque de la persona en su página, con el teléfono desbloqueado.
- **No es cero pasos.** La persona agrega el Atajo desde un link de iCloud una sola vez y acepta el permiso de Salud. No pasa por el App Store.
- **Doble conteo.** Dos fuentes (iPhone y reloj) escriben las mismas horas. El servidor une los tramos que se pisan, así que el Atajo manda las muestras tal cual.
- **No manda todo el historial.** iOS frena un Atajo que comparte muchos datos de una vez, salvo que la persona active «Permitir compartir grandes cantidades de datos» en los ajustes de Atajos. Apple no documenta el tope. Probado el 21-nov-2026 en un iPhone: 159 datos (7 días de sueño más 30 días de pasos y de energía) se frenaron. Por eso se mandan 2 días de sueño y 7 días de lo que se resume por día, y el historial se va armando en el servidor con cada envío, que guarda un registro por día.
- **Solo iPhone.** Quien usa Android no tiene este camino.
- **Exige HTTPS público** con certificado válido. No funciona contra `localhost`.

### Cómo lo vive la persona

1. Entra a su página `/conectar/<token>` desde el iPhone y abre la fila **Apple Health**.
2. Toca **Agregar Atajo**. Se abre el link de iCloud y lo agrega. Esto se hace una sola vez.
3. Vuelve a la página y toca **Enviar datos**. La página abre el Atajo y le pasa la dirección personal de esa persona, así que nadie pega ni escribe nada.
4. La primera vez acepta el permiso de Salud y el de conexión. El Atajo muestra la respuesta del servidor: «Listo. Llegaron 7 días de datos, del 15-11 al 21-11.»
5. Al terminar, el Atajo vuelve solo a la página de Montu. La fila de Apple Health muestra «Esperando tus datos…» y después la hora del envío con lo que llegó, o el motivo si falló. Si en dos minutos no llega nada, lo dice.
6. Para actualizar, toca **Enviar datos** otra vez. La confirmación aparece aunque lleguen los mismos días.

Los dos botones aparecen cuando el servidor tiene `HEALTH_SHORTCUT_URL` (ver [DEPLOY.md](DEPLOY.md)). Sin esa variable la fila muestra solo la dirección personal, como antes.

El botón **Enviar datos** es un enlace `shortcuts://x-callback-url/run-shortcut?name=<nombre>&input=text&text=<dirección>&x-success=<página>` (con `x-cancel` y `x-error` iguales), para que el Atajo vuelva a la página. La vuelta automática no está probada en un iPhone. Es el esquema que [documenta Apple](https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios). El nombre tiene que ser el mismo que el del Atajo en el teléfono: por defecto `Ronda Salud`, o el de `HEALTH_SHORTCUT_NAME`.

### Formato del envío

`POST /api/ingest/health/<token>` con JSON. Hay dos formas y todos los campos son opcionales.

**Varios días (la que manda el Atajo compartido).** Cada campo es un texto con una muestra por línea y las partes separadas por `|`. También se acepta una lista de textos.

| Campo | Cada línea | Qué hace el servidor |
|---|---|---|
| `sleep_samples` | `inicio\|término\|etapa` | Arma una noche por día. Une los tramos que se pisan, descarta «Despierto» y, si no hay tramos dormidos, usa «En cama». Lo que empieza después de las 18:00 cuenta para el día siguiente |
| `steps_by_day` | `día\|pasos` | Suma por día |
| `active_energy_by_day` | `día\|kcal` | Suma por día |
| `resting_hr_by_day` | `día\|latidos por minuto` | Promedia por día |
| `hrv_by_day` | `día\|milisegundos` | Promedia por día |
| `workouts` | `inicio\|término\|tipo` | Cuenta entrenamientos y minutos por día |

```json
{
  "sleep_samples": "2026-11-20T23:40:00-03:00|2026-11-21T03:10:00-03:00|Sueño esencial\n2026-11-21T03:10:00-03:00|2026-11-21T06:55:00-03:00|REM",
  "steps_by_day": "2026-11-20|8421\n2026-11-21|10233",
  "resting_hr_by_day": "2026-11-21|58"
}
```

- Las fechas van en ISO 8601 (`2026-11-21` o `2026-11-21T07:12:00-03:00`). Una fecha en otro formato, como `21 nov 2026`, hace que esa línea no se lea.
- Los números pueden venir con coma decimal.
- Se guarda **un registro por día** con lo derivado (`sleep_hours`, `steps`, `resting_hr`, `hrv_ms`, `active_energy_kcal`, `workouts`), no el texto recibido. Reenviar un día lo reemplaza, así que mandar dos veces no duplica.
- Se aceptan hasta 4.000 líneas por envío y días de los últimos 62.
- Responde 201 con `days`, `from`, `to`, `ignored` (líneas que no se pudieron leer) y `message`, la frase que el Atajo le muestra a la persona. Si no se pudo leer nada, responde 400 con `example`, la primera línea que falló.

**Una noche suelta (el Atajo mínimo, sigue funcionando).**

```json
{ "date": "2026-11-21", "sleep_hours": 6.4, "resting_hr": 58, "steps": 4312 }
```

Lo que llegue en esta forma se guarda completo aunque no traiga estos campos, para poder ver qué manda cada iPhone.

Probar sin teléfono:

```bash
curl -X POST http://localhost:8787/api/ingest/health/<token> \
  -H 'content-type: application/json' \
  -d '{"steps_by_day":"2026-11-20|8421\n2026-11-21|10233","sleep_samples":"2026-11-20T23:40:00-03:00|2026-11-21T06:55:00-03:00|Core"}'
```

### El Atajo compartido, ya armado

El Atajo no se arma a mano: lo genera `tools/atajo-salud/build.py` y queda en `tools/atajo-salud/Ronda Salud.xml`. Manda en un solo envío:

| Qué | Rango | Campo |
|---|---|---|
| Sueño, un tramo por línea | 2 días | `sleep_samples` |
| Pasos, agrupados por día | 7 días | `steps_by_day` |
| Energía activa, agrupada por día | 7 días | `active_energy_by_day` |

Si se abre sin la dirección de la persona, avisa «Abre este Atajo desde tu página de Montu» y termina. Al final muestra la frase `message` que responde el servidor.

Para dejarlo disponible:

1. **Generar y firmar**, en un Mac con sesión de iCloud:

       python3 tools/atajo-salud/build.py
       cp "tools/atajo-salud/Ronda Salud.xml" "/tmp/Ronda Salud.shortcut"
       shortcuts sign --mode anyone --input "/tmp/Ronda Salud.shortcut" --output "$HOME/Desktop/Ronda Salud.shortcut"

2. **Agregarlo.** Abre el archivo firmado en el Mac y acepta «Agregar atajo». iCloud lo lleva al iPhone de esa misma cuenta.
3. **Probarlo en el iPhone**, desde la página de Montu (ver «Qué revisar» abajo).
4. **Compartirlo.** En Atajos, **Compartir → Copiar enlace de iCloud**. Ese link va en `HEALTH_SHORTCUT_URL`, en el panel de Render.

El archivo se armó con la estructura que documenta [Shortcuts Playground](https://github.com/viticci/shortcuts-playground-plugin) (MIT) para las acciones de Salud, que solo existen en iPhone y iPad. La primera versión se probó en un iPhone el 21-nov-2026: importó bien, leyó Salud y llegó hasta el envío, donde iOS la frenó por cantidad de datos. La versión liviana actual falta probarla. Qué revisar:

- Que al abrirlo en el iPhone los tres bloques «Buscar muestras de salud» muestren su tipo (Sueño, Pasos, Calorías activas) y el rango de días. Si alguno aparece vacío, se elige a mano en ese bloque.
- Que la respuesta diga cuántos días llegaron. Si responde que no pudo leer los datos, el campo `example` de la respuesta muestra en qué formato salió la fecha.
- Que funcione en un teléfono **sin reloj**, donde no hay sueño: hay reportes de que un resultado vacío detiene el Atajo completo.
- Que en `GET /api/people/<token>/events` aparezca un registro por día.

Pulso en reposo y variabilidad no van en el archivo: no confirmamos el nombre con que Atajos guarda esos tipos. El servidor ya los recibe (`resting_hr_by_day`, `hrv_by_day`); se agregan a mano con los pasos de abajo.

### Armar o ampliar el Atajo a mano

Sirve para agregar un tipo al Atajo generado o para rehacerlo si el archivo no importa bien. Los nombres de las acciones cambian un poco entre versiones de iOS.

1. Abre **Atajos**, crea uno nuevo y nómbralo exactamente `Ronda Salud`.
2. En el panel de detalles (ⓘ), en «Recibir», deja solo **Texto**. En «Si no hay entrada», elige **Detener y responder** con el texto «Abre este Atajo desde tu página de Montu.»
3. **Sueño.** Agrega **Buscar muestras de salud**: tipo **Sueño**, filtro «Fecha de inicio está en los últimos 7 días», ordenado por fecha de inicio.
4. Agrega **Repetir con cada** sobre esas muestras. Adentro, una acción **Texto** con tres variables del elemento, separadas por una barra vertical: `Fecha de inicio|Fecha de término|Valor`. En las dos fechas, toca la variable y elige formato **ISO 8601** con la hora incluida.
5. Después del fin de la repetición, agrega **Combinar texto** sobre los resultados de la repetición, separado por **líneas nuevas**, y guárdalo con **Definir variable** como `Sueño`.
6. **Lo que se resume por día.** Repite los pasos 3 a 5 una vez por cada tipo, con «últimos 30 días» y **Agrupar por: Día**. El texto de cada línea es `Fecha de inicio|Valor`, con la fecha en ISO 8601.

   | Tipo en Salud | Variable | Campo del envío |
   |---|---|---|
   | Pasos | `Pasos` | `steps_by_day` |
   | Frecuencia cardiaca en reposo | `Reposo` | `resting_hr_by_day` |
   | Variabilidad de la frecuencia cardiaca | `Variabilidad` | `hrv_by_day` |
   | Energía activa | `Energia` | `active_energy_by_day` |

   Si tu versión no muestra «Agrupar por», baja el rango a 7 días. El servidor suma o promedia igual las muestras de un mismo día.
7. Agrega **Obtener contenido de URL**. La URL es la variable **Entrada del atajo**. Método **POST**, cuerpo **JSON**, y un campo de **Texto** por cada variable: `sleep_samples` con `Sueño`, `steps_by_day` con `Pasos`, y así con las demás.
8. Agrega **Obtener valor del diccionario** para la clave `message` sobre el resultado anterior, y después **Mostrar resultado** con ese valor. Así la persona lee «Listo. Llegaron 7 días de datos…».
9. Pruébalo con lo de «Qué revisar» de la sección anterior. Si un teléfono sin datos de un tipo detiene el Atajo, rodea ese bloque con **Si** «las muestras tienen algún valor».
10. En el Atajo, toca **Compartir → Copiar enlace de iCloud**. Ese link va en `HEALTH_SHORTCUT_URL`, en el panel de Render.

Entrenamientos (`workouts`) queda fuera de la receta: no confirmamos qué acción de Atajos los entrega. El servidor ya los recibe si se agregan después.

### El Atajo mínimo

Es el primero que se armó y sigue funcionando. Manda una sola noche.

1. Abre **Atajos** y crea uno nuevo.
2. Agrega **Buscar muestras de Salud**. Tipo: Sueño. Fecha de inicio: en los últimos 1 día.
3. Agrega **Calcular estadísticas**: operación **Suma**, sobre la **Duración** de las muestras.
4. Agrega **Obtener contenido de URL** con tu dirección de envío. Método: **POST**. Cuerpo: **JSON**.
5. En el cuerpo, agrega un campo de texto con clave `sleep_hours` y, como valor, la variable **Suma**.
6. Ejecútalo una vez y acepta los permisos de Salud y de red.

Para probar contra un computador, expón el puerto con un túnel (por ejemplo `cloudflared tunnel --url http://localhost:8787`) y define `PUBLIC_BASE_URL` con esa dirección.

Lo aprendido con el iPhone real, con el Atajo mínimo:

- **La duración llega en segundos y con coma decimal** (`"30000"` son 8,3 horas). El servidor la convierte. El Atajo compartido no usa la duración: manda inicio y término.
- **El filtro mira la hora de inicio.** Con 1 día, la noche tiene que haber empezado hace menos de 24 horas.
- **Con un rango de varios días la suma mezcla noches.** Por eso el Atajo compartido manda las muestras y el servidor separa las noches.
- **Sin muestras, la suma llega vacía.** Hace falta que algo escriba el sueño en Salud: un reloj, Whoop con su integración activada, o registrarlo a mano en Salud → Sueño → Agregar datos.

Si algo llega en una unidad distinta, se ve en `GET /api/people/<token>/events`.

## WhatsApp

WhatsApp no es una fuente: es el canal entre cada persona y su agente. Pasa por Kapso (`backend/src/whatsapp/`).

Qué hace hoy:

| Momento | Qué pasa |
|---|---|
| Conectar | En Ajustes, «Conectar» crea un código de 6 caracteres que vale 15 minutos y abre WhatsApp con el mensaje escrito. Al llegar el código, el teléfono queda unido a la persona |
| Check-in | La persona le cuenta a su agente cómo viene. El modelo lo lee y lo guarda como un check-in en su memoria privada. La respuesta agrega lo que el agente ve en sus fuentes (energía y carga), sin pasar por el modelo |
| Permiso | Si el check-in trae un bloqueo en «preguntar», el agente manda dos botones: «Permitir» y «No contar». Con «Permitir» parte una ronda en sus equipos |
| Propuesta | Cada propuesta de una ronda le llega a cada involucrado con los botones «Aceptar» y «Ahora no» |
| Presentación | Cuando todos aceptan, cada uno recibe el mensaje que los presenta. Vale igual si alguien aceptó desde el panel |
| Pregunta | Si la persona pregunta algo para su equipo, queda en el tablero, la responden los agentes y la respuesta armada vuelve por WhatsApp |

Límites:

- WhatsApp solo deja escribir libremente durante las 24 horas siguientes al último mensaje de la persona. Fuera de esa ventana el envío falla y queda en el registro del servidor; el panel sigue funcionando. Por eso el agente todavía no saluda en la mañana: la persona escribe primero.
- Leer un mensaje de texto necesita el modelo. Conectar el teléfono y los botones funcionan sin él.
- Con el número de prueba de Kapso (sandbox) solo se le puede escribir al teléfono registrado en esa sesión. Para que entre el público hace falta un número propio conectado en Kapso.

Estado: construido y probado con un Kapso falso. En producción están cargadas las variables y el webhook está registrado en el número de prueba de Kapso (21-nov-2026). Falta probarlo con un teléfono.

El proyecto de Kapso de la hack es uno aparte del de Vita, que tiene los números de los clientes: la llave del servidor solo ve el número de prueba.

### Cómo se activa

1. Crear una llave en Kapso (Integrations → API keys) y tener un número conectado, o el de prueba.
2. Cargar `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID` y `KAPSO_WEBHOOK_SECRET` en Render ([DEPLOY.md](DEPLOY.md#para-activar-whatsapp)).
3. Registrar el webhook en ese número, con el mismo secreto y solo el evento `whatsapp.message.received`:

```bash
curl -X POST "https://api.kapso.ai/platform/v1/whatsapp/phone_numbers/$KAPSO_PHONE_NUMBER_ID/webhooks" \
  -H "X-API-Key: $KAPSO_API_KEY" -H "Content-Type: application/json" \
  -d '{"whatsapp_webhook":{"kind":"kapso","url":"https://ronda-n8if.onrender.com/api/whatsapp/webhook","events":["whatsapp.message.received"],"secret_key":"'"$KAPSO_WEBHOOK_SECRET"'","active":true}}'
```

El webhook comprueba la firma (`X-Webhook-Signature`, HMAC-SHA256 del cuerpo en hexadecimal), ignora los demás eventos y no procesa dos veces una misma entrega (`X-Idempotency-Key`).

## ¿Apple Health reemplaza a Whoop?

**Para sueño, sí. Para recuperación, no.** Whoop escribe en Apple Health el sueño, la frecuencia en reposo, la frecuencia respiratoria y los entrenamientos. No escribe la variabilidad cardíaca ni los puntajes de Recovery y Strain. Como la señal que usamos es sueño, Apple Health alcanza y Whoop queda fuera. Si después se quiere recuperación, Whoop tiene API propia con OAuth.

## Google Health

- **Google Health API:** API en la nube con OAuth de Google, sucesora de la de Fitbit. Entra por el mismo botón de Google, sin app. Cubre Fitbit y Pixel Watch.
- **Health Connect (Android):** vive solo en el teléfono y exige una app instalada. Fuera de la hack.
- **Google Fit:** se apaga a fin de 2026. No se usa.

Cobertura resultante: iPhone por el Atajo; Fitbit y Pixel Watch por Google; un Android con otro reloj queda fuera por ahora.

## Las demás fuentes

- **Google Calendar y Gmail.** Un solo OAuth. Una app sin verificar solo admite usuarios de prueba agregados a mano. De Gmail se guarda asunto y remitente, no el cuerpo.
- **Granola.** Se conecta por OAuth contra su servidor MCP (`https://mcp.granola.ai/mcp`), que acepta registrar un cliente por programa y pide PKCE. Montu quedó registrada como cliente el 21-nov-2026, con la dirección de retorno de producción. El servidor llama a la herramienta `search_meetings` y guarda una nota por reunión: título, hora, cantidad de asistentes y link. No pide transcripciones ni resúmenes. Antes se conectaba con una llave de su API REST, que exige plan Business; esa forma se quitó.
- **GitHub.** OAuth App.

Las conexiones que cada uno tiene en su asistente (Claude, Codex) son de esa cuenta y no sirven para el producto: cada persona autoriza sus cuentas contra nuestro backend.

## Abierto

- [x] **OAuth a mano o con una plataforma.** Quedó hecho a mano para Google, GitHub y Linear, en `backend/src/oauth/`. No se usó Composio, Nango ni Pipedream Connect.
- [x] **Dónde se despliega.** En Render, con HTTPS público. Detalle en [DEPLOY.md](DEPLOY.md).
- [x] **Cifrado** de tokens y llaves. Hecho con AES-256-GCM; detalle en [ARCHITECTURE.md](ARCHITECTURE.md#credenciales).
- [x] **Base definitiva.** Producción usa Postgres desde el 21-nov-2026; en local sigue SQLite. Detalle en [DEPLOY.md](DEPLOY.md#base-de-datos).
- [x] **Credenciales de cada aplicación OAuth.** Las tres aplicaciones están creadas y sus variables cargadas en Render; ver «Aplicaciones OAuth».
- [ ] **Probar el Atajo compartido de Apple Health en un iPhone** y cargar su link de iCloud en `HEALTH_SHORTCUT_URL`; ver «El Atajo compartido, ya armado».
- [ ] **Probar cada fuente contra el servicio real.** Solo Apple Health está probada.

## Fuentes

- [Pipeline de Apple Health con un Atajo](https://dev.to/rudratosh/apple-wont-give-you-an-api-for-your-health-data-a-free-shortcut-will-heres-the-whole-pipeline-1j9k)
- [hermes-health: límites del Atajo](https://github.com/tyleramberry/hermes-health)
- [Sahha: ¿puede una web leer Apple Health?](https://sahha.ai/blog/can-a-web-app-read-apple-health/)
- [Terra: fuentes solo móviles](https://docs.tryterra.co/health-and-fitness-api/getting-started)
- [Junction: Apple HealthKit](https://docs.junction.com/wearables/guides/apple-healthkit)
- [WHOOP: integración con Apple Health](https://support.whoop.com/s/article/Apple-Health-Integration?language=en_US)
- [Android: Health Connect frente a Google Health API](https://developer.android.com/health-and-fitness/health-connect/comparison-guide)
- [Google Fit REST: aviso de cierre](https://developers.google.com/fit/rest)
- [Granola: API y MCP](https://knowledgework.ai/guides/granola-mcp)
- [Composio: conectores para agentes](https://composio.dev/content/agent-connectors)
