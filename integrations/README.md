# integrations

Receptor mínimo de integraciones. Un solo archivo, sin dependencias. Contexto y decisiones: [`docs/INTEGRATIONS.md`](../docs/INTEGRATIONS.md).

Requiere Node 22.5 o superior (usa el SQLite que trae Node).

## Correr

```bash
node integrations/server.mjs add-person "Tu nombre"
node integrations/server.mjs
```

El primer comando imprime tu página de conexión y tu dirección de envío. El segundo levanta el servidor en `http://localhost:8787`. Los datos quedan en `integrations/data/`, que git ignora.

| Variable | Para qué | Por defecto |
|---|---|---|
| `PORT` | Puerto | `8787` |
| `PUBLIC_BASE_URL` | Dirección pública que muestra la página de conexión | La del request |
| `INTEGRATIONS_DATA_DIR` | Carpeta de la base | `integrations/data` |

## Rutas

| Ruta | Qué hace |
|---|---|
| `GET /conectar/<token>` | Página de la persona: fuentes, estado y últimos registros |
| `POST /ingest/health/<token>` | Recibe el envío del Atajo de Apple Health |
| `GET /events/<token>` | Eventos de la persona en JSON |
| `GET /health` | Comprobación de vida |

## Envío de Apple Health

`POST /ingest/health/<token>` con JSON. Todos los campos son opcionales:

```json
{ "date": "2026-11-21", "sleep_hours": 6.4, "resting_hr": 58, "steps": 4312 }
```

Los números pueden venir como texto y con coma decimal. Lo que llegue se guarda completo aunque no traiga estos campos, para poder ver qué manda cada iPhone.

Probar sin teléfono:

```bash
curl -X POST http://localhost:8787/ingest/health/<token> \
  -H 'content-type: application/json' \
  -d '{"date":"2026-11-21","sleep_hours":6.4}'
```

## Armar el Atajo en el iPhone

El iPhone necesita una dirección HTTPS pública; `localhost` no sirve. Para probar, expón el puerto con un túnel (por ejemplo `cloudflared tunnel --url http://localhost:8787`) y usa esa dirección.

1. Abre **Atajos** y crea uno nuevo.
2. Agrega **Buscar muestras de salud**. Tipo: Sueño. Fecha de inicio: en los últimos 1 días.
3. Agrega **Calcular estadísticas** sobre la duración, operación Suma, para obtener el total.
4. Agrega **Diccionario** con las claves `date` (fecha actual, formato `yyyy-MM-dd`) y `sleep_hours` (el total anterior).
5. Agrega **Obtener contenido de URL**. URL: tu dirección de envío. Método: POST. Cuerpo de la solicitud: JSON, con el diccionario.
6. Ejecútalo una vez y acepta el permiso de Salud.
7. En **Automatización**, crea una que lo ejecute al abrir una app que uses a diario, con «Ejecutar inmediatamente».

Los nombres de las acciones cambian un poco entre versiones de iOS. Si el total llega en una unidad distinta de horas, se ve en `GET /events/<token>`, que guarda el envío completo.
