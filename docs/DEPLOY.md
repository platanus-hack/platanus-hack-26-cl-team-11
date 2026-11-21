# Despliegue

El producto corre en Render como un solo servicio web: el backend sirve la API y el frontend ya compilado. La configuración está en [`render.yaml`](../render.yaml).

## Cómo funciona

```
push a main  →  GitHub Actions corre las pruebas  →  si pasan, Render despliega
```

- **CI** (`.github/workflows/ci.yml`): en cada push a `main` instala, corre las pruebas del backend, revisa tipos, compila el frontend y pasa el lint de diseño.
- **CD:** Render despliega solo cuando esos chequeos pasan (`autoDeployTrigger: checksPass`). Un commit con pruebas rotas no llega a producción.
- Para que un commit no despliegue, incluye `[skip render]` en el mensaje.

## Crear el servicio (una sola vez)

1. En Render: **New → Blueprint** y elige el repo `m5b6/platanus-hack-26`. Render necesita acceso al repo desde la cuenta de GitHub que lo contiene.
2. Render lee `render.yaml` y propone un servicio `ronda` con un disco de 1 GB. Confirma.
3. Al terminar el primer despliegue, la dirección queda como `https://<nombre>.onrender.com`.

El servicio usa un plan pagado porque el disco persistente no existe en el plan gratuito.

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
