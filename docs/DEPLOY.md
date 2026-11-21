# Despliegue

El producto corre en Render como un solo servicio web: el backend sirve la API y el frontend ya compilado. La configuración está en [`render.yaml`](../render.yaml).

## Cómo funciona

```
push a main  →  Render instala y compila  →  publica
```

- **Render despliega en cada commit a `main`** (`autoDeployTrigger: commit`). No hay chequeos previos: lo que llega a `main` se publica.
- Si la compilación falla, Render deja publicada la versión anterior.
- Para que un commit no despliegue, incluye `[skip render]` en el mensaje.

Las pruebas se corren en local con `npm test` y `npm run type-check`. `.github/workflows/ci.yml` tiene esos mismos chequeos, pero solo se lanza a mano: las Actions de este repo no arrancan por un problema de pago de la cuenta dueña (probado el 21-nov-2026).

## Crear el servicio (una sola vez)

1. En Render: **New → Blueprint** y elige el repo `m5b6/platanus-hack-26`. Render necesita acceso al repo desde la cuenta de GitHub que lo contiene.
2. Render lee `render.yaml` y propone un servicio `ronda` con un disco de 1 GB. Confirma.
3. Al terminar el primer despliegue, la dirección queda como `https://<nombre>.onrender.com`.

### Acceso al repositorio privado y créditos de la hack

El repositorio pertenece a `m5b6`. Los créditos están en el workspace de Ian. Son dos comprobaciones distintas.

1. En la [instalación de Render de m5b6](https://github.com/settings/installations/31963285), deja marcada **Only select repositories**. Busca `m5b6/platanus-hack-26`, agrégalo a la selección existente y guarda. Vuelve a abrir la instalación y comprueba que el repo figura en la lista.
2. En el workspace con créditos, Ian abre **New → Blueprint** y busca el repo en la lista de GitHub. Si aparece, revisa `main`, `render.yaml`, el cargo estimado y el disco de 1 GB antes de aplicar. Si no aparece, comprueba qué credencial de GitHub está vinculada a ese workspace. El enlace «Public Git Repository» requiere un repo público.
3. Tras el primer deploy, copia desde Render la URL del servicio y el SHA marcado como **Live**. Abre la portada y confirma que `GET /api/health` devuelve HTTP 200 con `{"ok":true}`. Registra en el hilo del equipo la URL, el SHA y el resultado.

El 21 de noviembre se comprobó en local el commit `55c9077` con Node 22.23.1. Pasaron las 84 pruebas y el chequeo de tipos. Con los comandos del Blueprint, el proceso sirvió la portada «Ronda» y la respuesta de salud esperada. Ese mismo día se reabrió la instalación de GitHub y se verificó que incluía `m5b6/platanus-hack-26` entre seis repositorios seleccionados. Falta que Ian confirme la visibilidad del Blueprint en su workspace y comparta la primera URL y el SHA en estado **Live**.

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
