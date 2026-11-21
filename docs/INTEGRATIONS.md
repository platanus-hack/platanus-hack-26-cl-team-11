# Integraciones

Cómo entra la señal de cada persona a su memoria privada. Investigación hecha el 21-nov-2026; lo que no pudimos confirmar va marcado.

## La idea

Todo conector hace una sola cosa: convierte su fuente en **eventos con el mismo formato** y los deja en la memoria privada de la persona. El agente nunca habla con la fuente; solo lee eventos.

| Campo del evento | Contenido |
|---|---|
| Persona | A quién pertenece |
| Fuente | `apple_health`, `google_calendar`, `gmail`, `granola`, `github` |
| Tipo | `salud_diaria`, `reunión`, `correo`, `nota_de_reunión`, `commit` |
| Cuándo ocurrió | Fecha del hecho, no de la recepción |
| Resumen | Una línea legible |
| Dato crudo | Lo que mandó la fuente, sin tocar |

Cada persona tiene una página `/conectar/<token>` con una fila por fuente. El link se lo manda su agente por WhatsApp. El token del link es su identidad: no hay cuentas ni contraseñas.

## Estado

| Fuente | Cómo se conecta | Estado |
|---|---|---|
| Apple Health | Atajo de iOS que envía a una URL personal | Receptor funcionando; falta probar el Atajo en un iPhone |
| Granola | Llave personal pegada | Construido; probado solo con respuestas simuladas |
| GitHub | Token personal pegado | Construido; probado solo con respuestas simuladas |
| Linear | Llave personal pegada | Construido; probado solo con respuestas simuladas |
| Google Calendar | OAuth de Google | Construido; faltan credenciales de Google Cloud |
| Gmail | El mismo OAuth de Google | Construido; guarda solo asunto, remitente y fecha |
| Google Health | El mismo OAuth de Google | No empezado |
| Whoop | — | Fuera de la hack |

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
2. Agrega **Buscar muestras de salud**. Tipo: Sueño. Fecha de inicio: en los últimos 1 días.
3. Agrega **Calcular estadísticas** sobre la duración, operación Suma, para obtener el total.
4. Agrega **Diccionario** con las claves `date` (fecha actual, formato `yyyy-MM-dd`) y `sleep_hours` (el total anterior).
5. Agrega **Obtener contenido de URL**. URL: tu dirección de envío. Método: POST. Cuerpo: JSON, con el diccionario.
6. Ejecútalo una vez y acepta el permiso de Salud.
7. En **Automatización**, crea una que lo ejecute al abrir una app que uses a diario, con «Ejecutar inmediatamente».

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

- [ ] **OAuth a mano o con una plataforma.** Composio, Nango y Pipedream Connect resuelven Google, GitHub y Linear con un link por persona. Ninguna cubre Apple Health ni Granola.
- [ ] **Dónde se despliega** el receptor para tener HTTPS público.
- [ ] **Base definitiva.** El backend usa SQLite local para funcionar sin montar nada. Si se pasa a Postgres, cambia solo `backend/src/db.ts`.
- [ ] **Cifrado** de tokens y llaves antes de guardar la primera credencial real.

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
