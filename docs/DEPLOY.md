# Despliegue

El producto corre en Render como un solo servicio web: el backend sirve la API y el frontend ya compilado. La configuración está en [`render.yaml`](../render.yaml).

**En producción:** https://ronda-n8if.onrender.com (servicio `ronda-n8if`, en el espacio de trabajo de Ian en Render, creado el 21-nov-2026).

## Cómo funciona

```
push a main  →  Render instala y compila  →  publica
```

- **Render despliega en cada commit a `main`** (`autoDeployTrigger: commit`). No hay chequeos previos: lo que llega a `main` se publica.
- Si la compilación falla, Render deja publicada la versión anterior.
- **Solo despliegan los commits que tocan el producto:** `backend/`, `frontend/`, los estilos y caras de `design/` que usa el frontend, y los archivos de paquetes. Un commit que solo cambia documentos, tableros de diseño o skills no despliega. Así se evita la caída de unos segundos que trae cada despliegue.
- Para que un commit no despliegue, incluye `[skip render]` en el mensaje.

Las pruebas se corren en local con `npm test` y `npm run type-check`. `.github/workflows/ci.yml` tiene esos mismos chequeos, pero solo se lanza a mano: las Actions de este repo no arrancan por un problema de pago de la cuenta dueña (probado el 21-nov-2026).

## Cómo se creó el servicio

Ya está creado; esto queda como referencia.

1. El dueño del repo instaló la app de Render en su cuenta de GitHub con acceso a `platanus-hack-26`.
2. Quien despliega conectó su propia cuenta de GitHub en Render. Sin ese paso Render responde «the repository, branch, or Blueprint file could not be accessed», aunque el permiso del repo esté bien.
3. Se creó el Blueprint desde la línea de comandos: `render ea blueprints create --repo <repo> --branch main` y luego `render ea blueprints approve <id>`. El equivalente en el panel es **New → Blueprint**.

El servicio usa el plan pagado más chico, porque el disco persistente no existe en el plan gratuito.

### Operarlo desde la terminal

```bash
render deploys list srv-dc0j2qrm8hqs73emf3ig     # estado de los despliegues
render logs -r srv-dc0j2qrm8hqs73emf3ig          # registros
render deploys create srv-dc0j2qrm8hqs73emf3ig   # volver a desplegar a mano
```

## Variables

| Variable | Origen | Para qué |
|---|---|---|
| `NODE_VERSION` | `render.yaml` | Node 22; el backend usa el SQLite que trae Node |
| `PORT` | `render.yaml` | Puerto en que escucha |
| `DATA_DIR` | `render.yaml` | Apunta al disco persistente, `/var/data` |
| `SECRET_KEY` | La genera Render | Cifra las credenciales guardadas. Si cambia, las conexiones existentes dejan de poder leerse |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | A mano, en el panel de Render | Activan la conexión con Google |
| `PUBLIC_BASE_URL` | Opcional | Solo con dominio propio. Sin ella se usa la dirección que entrega Render |

Las llaves nunca van en el repo ni en `render.yaml`.

### Para activar los agentes

Las rondas de agentes necesitan acceso al modelo. Sin estas variables, la pestaña Equipo muestra «Faltan las credenciales del modelo en el servidor».

| Variable | Valor | Para qué |
|---|---|---|
| `ANTHROPIC_API_KEY` | Una llave de la API de Anthropic | Acceso directo al modelo |
| `ANTHROPIC_BASE_URL` | La dirección del proxy de la hack, si se usa en vez de una llave | Con solo esta variable, el servidor llama al proxy sin llave |
| `AGENT_MODEL` | Opcional. Por defecto `claude-opus-5-5` | Qué modelo conversa |
| `AGENT_ROUND_HOUR` | Opcional. Hora de Santiago, de 0 a 23; por defecto 9. Cualquier otro valor apaga la ronda diaria | Desde qué hora corre sola la ronda de cada día |

Se cargan en el panel de Render: **ronda → Environment → Add Environment Variable**. Render vuelve a desplegar al guardar. Nunca van en el repo.

Para probar el modelo antes de cargarlas, define la misma variable en tu terminal y corre `npm run agents:check`. Arma un equipo de demo en memoria, corre una ronda contra el modelo real y muestra las conversaciones y las propuestas. No toca la base ni producción.

## Después del primer despliegue

- **Google:** registra `https://<dirección>/api/oauth/google/callback` como dirección de retorno en el cliente OAuth. Detalle en [INTEGRATIONS.md](INTEGRATIONS.md).
- **Apple Health:** el Atajo envía a la dirección personal que muestra cada página `/conectar/<token>`.
- **Datos de demo:** desde la pestaña Shell del servicio, `npm run seed`.

## Límites

- **Una sola instancia.** Un servicio con disco no escala a varias, y cada despliegue lo deja unos segundos sin responder.
- **SQLite en disco.** Render guarda una copia diaria del disco por siete días. Si el proyecto sigue, pasar a Postgres cambia solo `backend/src/db.ts` y las tiendas de `teams/`, `board/` y `policy/`.
- **El disco no existe durante la compilación**, solo al correr.

## Probar el despliegue en local

```bash
npm ci --include=dev && npm run build
PORT=10000 DATA_DIR=/tmp/ronda-data npm start
```

Son los mismos dos comandos que corre Render.
