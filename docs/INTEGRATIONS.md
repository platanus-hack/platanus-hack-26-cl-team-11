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
| Apple Health | Atajo de iOS que envía a una URL personal | **Probado con un iPhone real** el 21-nov-2026: llega el sueño y se deriva la energía |
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

- **Teléfono bloqueado.** Una automatización programada puede correr sin enviar nada. Conviene dispararla al abrir una app de uso diario, no a una hora fija.
- **No es cero pasos.** La persona acepta el Atajo desde un link de iCloud, da permiso de Salud una vez y crea la automatización. No pasa por el App Store.
- **Doble conteo.** Sumar muestras crudas de varias fuentes cuenta dos veces. Se piden pocos datos, ya resumidos por día.
- **Rangos largos se caen.** Se mandan solo las últimas 24 a 48 horas.
- **Exige HTTPS público** con certificado válido. No funciona contra `localhost`.
- **Sin confirmar:** las fuentes se contradicen sobre si entrega entrenamientos y muestras crudas. Se prueba en un iPhone real.

### Formato del envío

`POST /api/ingest/health/<token>` con JSON. Todos los campos son opcionales:

```json
{ "date": "2026-11-21", "sleep_hours": 6.4, "resting_hr": 58, "steps": 4312 }
```

Los números pueden venir como texto y con coma decimal. Lo que llegue se guarda completo aunque no traiga estos campos, para poder ver qué manda cada iPhone. La dirección personal aparece en la página `/conectar/<token>`.

Probar sin teléfono:

```bash
curl -X POST http://localhost:8787/api/ingest/health/<token> \
  -H 'content-type: application/json' \
  -d '{"date":"2026-11-21","sleep_hours":6.4}'
```

### Armar el Atajo en el iPhone

El iPhone necesita una dirección HTTPS pública. Para probar, expón el puerto con un túnel (por ejemplo `cloudflared tunnel --url http://localhost:8787`) y define `PUBLIC_BASE_URL` con esa dirección.

1. Abre **Atajos** y crea uno nuevo.
2. Agrega **Buscar muestras de Salud**. Tipo: Sueño. Fecha de inicio: en los últimos 1 día.
3. Agrega **Calcular estadísticas**: operación **Suma**, sobre la **Duración** de las muestras.
4. Agrega **Obtener contenido de URL** con tu dirección de envío. Método: **POST**. Cuerpo: **JSON**.
5. En el cuerpo, agrega un campo de texto con clave `sleep_hours` y, como valor, la variable **Suma**.
6. Ejecútalo una vez y acepta los permisos de Salud y de red.
7. En **Automatización**, crea una que lo ejecute al abrir una app que uses a diario, con «Ejecutar inmediatamente».

Lo aprendido con el iPhone real:

- **La duración llega en segundos y con coma decimal** (`"30000"` son 8,3 horas). El servidor la convierte.
- **El filtro mira la hora de inicio.** Con 1 día, la noche tiene que haber empezado hace menos de 24 horas.
- **Con un rango de varios días la suma mezcla noches.** El servidor la guarda pero no la usa como una noche.
- **Sin muestras, la suma llega vacía.** Hace falta que algo escriba el sueño en Salud: un reloj, Whoop con su integración activada, o registrarlo a mano en Salud → Sueño → Agregar datos.
- **Sin confirmar:** si una fuente escribe a la vez «en cama» y «dormido», la suma contaría doble.

Los nombres de las acciones cambian un poco entre versiones de iOS. Si el total llega en una unidad distinta de horas, se ve en `GET /api/people/<token>/events`, que guarda el envío completo.

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
