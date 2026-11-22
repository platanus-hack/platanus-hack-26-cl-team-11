# Despliegue

El producto corre en Render como un solo servicio web: el backend sirve la API y el frontend ya compilado. La configuración está en [`render.yaml`](../render.yaml).

**En producción:** https://ronda-n8if.onrender.com (servicio `ronda-n8if`, en el espacio de trabajo de Ian en Render, creado el 21-nov-2026).

## Cómo funciona

```
push a main  →  Render instala y compila  →  publica
```

- **Render despliega en cada commit a `main`** (`autoDeployTrigger: commit`). No hay chequeos previos: lo que llega a `main` se publica.
- Si la compilación falla, Render deja publicada la versión anterior.
- **Solo despliegan los commits que tocan el producto:** `backend/`, `frontend/`, los estilos y caras de `design/` que usa el frontend, las páginas de prueba que se muestran publicadas (`design/grafo/`, `design/contexto/`) y los archivos de paquetes. Un commit que solo cambia documentos, tableros de diseño o skills no despliega. Así se evita la caída de unos segundos que trae cada despliegue.
- Para que un commit no despliegue, incluye `[skip render]` en el mensaje.

Las pruebas se corren en local con `npm test` y `npm run type-check`. `.github/workflows/ci.yml` tiene esos mismos chequeos, pero solo se lanza a mano: las Actions de este repo no arrancan por un problema de pago de la cuenta dueña (probado el 21-nov-2026).

## Cómo se creó el servicio

Ya está creado; esto queda como referencia.

1. El dueño del repo instaló la app de Render en su cuenta de GitHub con acceso a `platanus-hack-26`.
2. Quien despliega conectó su propia cuenta de GitHub en Render. Sin ese paso Render responde «the repository, branch, or Blueprint file could not be accessed», aunque el permiso del repo esté bien.
3. Se creó el Blueprint desde la línea de comandos: `render ea blueprints create --repo <repo> --branch main` y luego `render ea blueprints approve <id>`. El equivalente en el panel es **New → Blueprint**.

El servicio usa el plan pagado más chico. Partió así porque el disco persistente no existe en el plan gratuito; desde que la base está en Postgres el disco ya no se usa.

### Operarlo desde la terminal

```bash
render deploys list srv-dc0j2qrm8hqs73emf3ig     # estado de los despliegues
render logs -r srv-dc0j2qrm8hqs73emf3ig          # registros
render deploys create srv-dc0j2qrm8hqs73emf3ig   # volver a desplegar a mano
```

## Variables

| Variable | Origen | Para qué |
|---|---|---|
| `NODE_VERSION` | `render.yaml` | Node 22 |
| `PORT` | `render.yaml` | Puerto en que escucha |
| `DATABASE_URL` | `render.yaml`, desde la base `montu-db` | Dirección de Postgres. Sin ella el backend usa SQLite en `DATA_DIR` |
| `SECRET_KEY` | La genera Render | Cifra las credenciales guardadas. Si cambia, las conexiones existentes dejan de poder leerse |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | A mano, en el panel de Render | Activan Google Calendar y Gmail |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | A mano, en el panel de Render | Activan GitHub |
| `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` | A mano, en el panel de Render | Activan Linear |
| `GRANOLA_CLIENT_ID`, `GRANOLA_CLIENT_SECRET` | A mano. Salen de registrar el cliente en `https://mcp-auth.granola.ai/oauth2/register` con la dirección de retorno `/api/oauth/granola/callback` | Activan Granola |
| `PUBLIC_BASE_URL` | Opcional | Solo con dominio propio. Sin ella se usa `RENDER_EXTERNAL_URL`, que Render define solo |
| `HEALTH_SHORTCUT_URL` | A mano, en el panel de Render. No es secreta | El link de iCloud del Atajo compartido de Apple Health. Con ella, la fila de Apple Health muestra «Agregar Atajo» y «Enviar datos». Sin ella se ve solo la dirección personal |
| `HEALTH_SHORTCUT_NAME` | Opcional | El nombre exacto del Atajo en el teléfono. Por defecto, `Ronda Salud` |

Dónde se crea cada aplicación OAuth y qué dirección de retorno lleva está en [INTEGRATIONS.md](INTEGRATIONS.md#aplicaciones-oauth-por-crear). Una fuente sin sus dos variables aparece en el panel como «Falta configurarla en el servidor».

Las llaves nunca van en el repo ni en `render.yaml`.

### Para activar los agentes

Las rondas de agentes necesitan acceso al modelo. Sin estas variables, la pestaña Equipo muestra «Faltan las credenciales del modelo en el servidor».

| Variable | Valor | Para qué |
|---|---|---|
| `FIFTYX_API_KEY` | La llave de 50x | Los agentes conversan con DeepSeek en 50x. Si está definida, tiene prioridad sobre las variables de Anthropic |
| `FIFTYX_BASE_URL` | Opcional. Por defecto `https://api.ai.50x.energy/v1` | Dirección de 50x |
| `AGENT_CLI` | `claude`. Solo en un computador, nunca en Render | Los agentes conversan con el Claude de tu terminal (`claude -p`), sin llave. Sirve para probar y grabar una ronda real mientras falta la llave de 50x. `AGENT_CLI_MODEL` cambia el modelo; por defecto `claude-sonnet-5-5` |
| `ANTHROPIC_API_KEY` | Una llave de la API de Anthropic | Acceso directo al modelo |
| `ANTHROPIC_BASE_URL` | La dirección del proxy de la hack, si se usa en vez de una llave | Con solo esta variable, el servidor llama al proxy sin llave. Probado el 21-nov-2026 desde un computador del equipo: el proxy respondió 401 «Invalid bearer token», así que necesita además `ANTHROPIC_AUTH_TOKEN` |
| `ANTHROPIC_AUTH_TOKEN` | Un token, si el proxy lo pide en vez de una llave | Se manda como token de autorización. Basta una de las tres variables para que el modelo quede configurado |
| `AGENT_MODEL` | Opcional. Por defecto `claude-opus-5-5` | Qué modelo conversa |
| `AGENT_ROUND_HOUR` | Opcional. Hora de Santiago, de 0 a 23; por defecto 9. Cualquier otro valor apaga la ronda diaria | Desde qué hora corre sola la ronda de cada día |

### Para activar WhatsApp

El puente de WhatsApp usa Kapso. Sin las tres primeras variables, la sección WhatsApp no aparece en Ajustes y el webhook responde 404. Los pasos están en [INTEGRATIONS.md](INTEGRATIONS.md#whatsapp).

| Variable | Valor | Para qué |
|---|---|---|
| `KAPSO_API_KEY` | La llave del proyecto de Kapso | Enviar mensajes |
| `KAPSO_PHONE_NUMBER_ID` | El identificador del número en Kapso | Desde qué número se envía. Los mensajes que llegan a otro número se ignoran |
| `KAPSO_WEBHOOK_SECRET` | Un secreto largo elegido por nosotros, el mismo que se registra en el webhook de Kapso | Comprobar la firma de cada mensaje que llega |
| `KAPSO_WHATSAPP_NUMBER` | Opcional. El número con código de país, solo dígitos | Armar el link `wa.me`. Si falta, el servidor se lo pregunta a Kapso |

Se cargan en el panel de Render: **ronda → Environment → Add Environment Variable**. Render vuelve a desplegar al guardar. Nunca van en el repo.

Para probar el modelo antes de cargarlas, define la misma variable en tu terminal o en un archivo `.env` en la raíz del repo (git lo ignora) y corre `npm run agents:check`. Arma un equipo de demo en memoria, corre una ronda contra el modelo real y muestra las conversaciones y las propuestas. No toca la base ni producción.

## Después del primer despliegue

- **Google:** registra `https://<dirección>/api/oauth/google/callback` como dirección de retorno en el cliente OAuth. Detalle en [INTEGRATIONS.md](INTEGRATIONS.md).
- **Apple Health:** el Atajo envía a la dirección personal que muestra cada página `/conectar/<token>`.
- **Datos de demo:** desde la pestaña Shell del servicio, `npm run seed`.

## Base de datos

Producción guarda todo en Postgres desde el 21-nov-2026: la base `montu-db` de Render (Postgres 18, plan gratis, misma región que el servicio). El servicio recibe su dirección interna en `DATABASE_URL`; las dos cosas están declaradas en `render.yaml`.

- **Las consultas se siguen escribiendo como para SQLite.** `backend/src/pg/` las traduce a Postgres (`dialect.ts`) y las ejecuta desde un hilo aparte (`worker.ts`), así las tiendas no cambiaron. Sin `DATABASE_URL`, el backend usa SQLite en `DATA_DIR`, igual que antes: eso es lo que corre en cada computador.
- **Las pruebas corren contra Postgres**, uno embebido que no necesita instalación. Una consulta que Postgres no acepta falla en `npm test`. Para correrlas contra un Postgres real: `TEST_DATABASE_URL=postgres://localhost:5432/<base de prueba> npm test -w backend`.
- **Los datos anteriores se copiaron una vez.** En el primer arranque con `DATABASE_URL`, el servidor copió las 2.345 filas de las 45 tablas de `ronda.db` y guardó el archivo completo en la tabla `sqlite_backups`. El informe quedó en `sqlite_imports`. Con ese registro, no vuelve a importar.
- **El plan gratis vence el 21-dic-2026** y no tiene respaldos. Si el proyecto sigue, hay que pasarlo a un plan pagado antes de esa fecha; el cambio se hace sobre la misma base.

## Límites

- **Falta quitar el disco para que los despliegues no corten.** El servicio todavía tiene conectado el disco `ronda-data`, que ya no usa, y por eso cada despliegue sigue dejando unos 25 segundos sin respuesta. `render.yaml` ya no lo declara, pero Render no lo quita solo: se borra en el panel, en **Disks → Delete disk**. Sin disco, Render prende el servidor nuevo, espera que `/api/health` responda y recién ahí le pasa el tráfico; durante ese cambio hay dos servidores a la vez por unos segundos y los dos escriben en la misma base.
- **La página abre siempre desde una copia guardada en el navegador** (`frontend/public/sw.js`) y la actualiza por detrás, así un refresco pinta al instante. Después de un despliegue, la primera carga muestra la versión anterior y la siguiente ya trae la nueva. **Si hay un corte**, esa misma copia abre igual y cada pedido a la API se reintenta solo por unos 40 segundos (`fetchThroughRestart` en `frontend/src/api.ts`).
- **Las lecturas repetidas se responden de memoria.** `backend/src/pg/database.ts` recuerda cada lectura hasta que algo cambia: cualquier escritura la borra, también la de otro servidor, que avisa por Postgres (`NOTIFY`). Un cambio hecho por fuera de la aplicación, con `psql`, tarda hasta 2 minutos en verse. Las consultas que piden «desde hace N días» avanzan su ventana de a 10 minutos, para que se repitan iguales.
- **Cada respuesta de la API trae la cabecera `Server-Timing`** con el tiempo total, el tiempo en la base y el número de consultas. Los pedidos de más de 150 ms quedan en el registro como «Pedido lento».
- **Cada consulta bloquea el servidor mientras Postgres responde**, uno o dos milisegundos dentro de Render. Alcanza para la hack; con mucho tráfico habría que pasar las tiendas a consultas asíncronas.
- **Si Postgres corta la conexión**, el servidor se reconecta y repite la consulta, salvo en medio de una transacción.

## Probar el despliegue en local

```bash
npm ci --include=dev && npm run build
PORT=10000 DATA_DIR=/tmp/ronda-data npm start
```

Son los mismos dos comandos que corre Render.
