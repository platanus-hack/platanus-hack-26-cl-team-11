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
| Apple Health | Atajo de iOS que envía a una URL personal | **Probado con un iPhone real** el 21-nov-2026 con el Atajo mínimo: llega el sueño y se deriva la energía. El envío de varios días y los botones de la página están construidos; falta armar el Atajo compartido en un iPhone |
| GitHub | OAuth | Construido; falta crear la OAuth App y cargar sus credenciales |
| Linear | OAuth | Construido; falta crear la aplicación OAuth y cargar sus credenciales |
| Google Calendar | OAuth de Google | Construido; faltan credenciales de Google Cloud |
| Gmail | El mismo OAuth de Google | Construido; guarda solo asunto, remitente y fecha |
| Granola | Llave personal pegada | Construido; Granola no ofrece OAuth para un servidor |
| Google Health | El mismo OAuth de Google | No empezado |
| Whoop | — | Fuera de la hack |

Salvo Apple Health, ninguna fuente está probada contra el servicio real: las pruebas usan respuestas simuladas.

### Aplicaciones OAuth por crear

Cada una entrega un identificador y un secreto, que se cargan como variables en Render. Nunca van en el repo.

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
- **No manda todo el historial.** Según reportes de la comunidad, con unos cientos de muestras por corrida el Atajo se cuelga o pide un permiso extra. Apple no documenta el tope. Se mandan 7 días de sueño y 30 días de lo que se resume por día.
- **Solo iPhone.** Quien usa Android no tiene este camino.
- **Exige HTTPS público** con certificado válido. No funciona contra `localhost`.

### Cómo lo vive la persona

1. Entra a su página `/conectar/<token>` desde el iPhone y abre la fila **Apple Health**.
2. Toca **Agregar Atajo**. Se abre el link de iCloud y lo agrega. Esto se hace una sola vez.
3. Vuelve a la página y toca **Enviar datos**. La página abre el Atajo y le pasa la dirección personal de esa persona, así que nadie pega ni escribe nada.
4. La primera vez acepta el permiso de Salud y el de conexión. El Atajo muestra la respuesta del servidor: «Listo. Llegaron 7 días de datos, del 15-11 al 21-11.»
5. Para actualizar, toca **Enviar datos** otra vez.

Los dos botones aparecen cuando el servidor tiene `HEALTH_SHORTCUT_URL` (ver [DEPLOY.md](DEPLOY.md)). Sin esa variable la fila muestra solo la dirección personal, como antes.

El botón **Enviar datos** es un enlace `shortcuts://run-shortcut?name=<nombre>&input=text&text=<dirección>`, el esquema que [documenta Apple](https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios). El nombre tiene que ser el mismo que el del Atajo en el teléfono: por defecto `Ronda Salud`, o el de `HEALTH_SHORTCUT_NAME`.

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

### Armar el Atajo compartido

Lo arma una persona, una vez, en un iPhone. Después se comparte y todos reciben el mismo. Las acciones de Salud solo existen en el teléfono, así que no se puede armar desde un computador. **Esta receta no se ha probado en un teléfono**: los nombres de las acciones cambian un poco entre versiones de iOS, y el paso 9 dice qué revisar antes de compartirlo.

1. Abre **Atajos**, crea uno nuevo y nómbralo exactamente `Ronda Salud`.
2. En el panel de detalles (ⓘ), en «Recibir», deja solo **Texto**. En «Si no hay entrada», elige **Detener y responder** con el texto «Abre este Atajo desde tu página de Ronda.»
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
9. **Antes de compartirlo, pruébalo.** Abre tu página de Ronda en el iPhone, copia tu dirección personal y ejecuta el Atajo desde Atajos pegándola como entrada, o apunta `HEALTH_SHORTCUT_URL` a tu link y toca **Enviar datos**. Revisa tres cosas:
   - Que la respuesta diga cuántos días llegaron. Si responde con `example`, esa línea muestra en qué formato salió la fecha.
   - Que funcione en un teléfono **sin reloj**, donde no hay sueño ni pulso: hay reportes de que un resultado vacío detiene el Atajo completo. Si pasa, rodea cada bloque con **Si** «las muestras tienen algún valor».
   - Que en `GET /api/people/<token>/events` aparezca un registro por día.
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

## ¿Apple Health reemplaza a Whoop?

**Para sueño, sí. Para recuperación, no.** Whoop escribe en Apple Health el sueño, la frecuencia en reposo, la frecuencia respiratoria y los entrenamientos. No escribe la variabilidad cardíaca ni los puntajes de Recovery y Strain. Como la señal que usamos es sueño, Apple Health alcanza y Whoop queda fuera. Si después se quiere recuperación, Whoop tiene API propia con OAuth.

## Google Health

- **Google Health API:** API en la nube con OAuth de Google, sucesora de la de Fitbit. Entra por el mismo botón de Google, sin app. Cubre Fitbit y Pixel Watch.
- **Health Connect (Android):** vive solo en el teléfono y exige una app instalada. Fuera de la hack.
- **Google Fit:** se apaga a fin de 2026. No se usa.

Cobertura resultante: iPhone por el Atajo; Fitbit y Pixel Watch por Google; un Android con otro reloj queda fuera por ahora.

## Las demás fuentes

- **Google Calendar y Gmail.** Un solo OAuth. Una app sin verificar solo admite usuarios de prueba agregados a mano. De Gmail se guarda asunto y remitente, no el cuerpo.
- **Granola.** API REST con llave personal. Crear la llave exige plan Business. Su MCP usa OAuth por navegador y no sirve desde un servidor.
- **GitHub.** OAuth App.

Las conexiones que cada uno tiene en su asistente (Claude, Codex) son de esa cuenta y no sirven para el producto: cada persona autoriza sus cuentas contra nuestro backend.

## Abierto

- [x] **OAuth a mano o con una plataforma.** Quedó hecho a mano para Google, GitHub y Linear, en `backend/src/oauth/`. No se usó Composio, Nango ni Pipedream Connect.
- [x] **Dónde se despliega.** En Render, con HTTPS público. Detalle en [DEPLOY.md](DEPLOY.md).
- [x] **Cifrado** de tokens y llaves. Hecho con AES-256-GCM; detalle en [ARCHITECTURE.md](ARCHITECTURE.md#credenciales).
- [ ] **Base definitiva.** El backend usa SQLite en disco. Si se pasa a Postgres, cambian `backend/src/db.ts` y las tiendas de `teams/`, `board/`, `policy/`, `agents/` y `hub/`.
- [ ] **Credenciales de cada aplicación OAuth.** Falta crear las tres aplicaciones y cargar sus variables en Render; ver «Aplicaciones OAuth por crear».
- [ ] **Armar el Atajo compartido de Apple Health** en un iPhone, probarlo y cargar su link en `HEALTH_SHORTCUT_URL`; ver «Armar el Atajo compartido».
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
