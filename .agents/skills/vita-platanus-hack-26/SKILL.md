---
name: vita-platanus-hack-26
description: "Retoma Ronda, el proyecto de Vita para Platanus Hack 26 en Santiago. Úsala para trabajar en el grafo de agentes, la demo, las integraciones, Render o el relevo entre Codex, Claude y el equipo."
metadata:
  catalog:
    category: ingenieria
    title: "Platanus Hack 26 · Ronda"
    tagline: "Retoma el proyecto del equipo desde su último cambio en main."
    summary: "Ubica las decisiones del producto, el grafo dirigido, la dirección visual y el despliegue de Ronda. Permite entregar el trabajo al siguiente agente con evidencia."
    audience: "Equipo Vita de Platanus Hack 26"
    icon: "🌐"
    visibility: private
    requires-institution: false
    playbook-as-prompt: true
---

# Platanus Hack 26 · Ronda

Ronda es el proyecto del equipo para Santiago, 20–22 de noviembre de 2026. Cada persona delega en su agente la búsqueda de ayuda y conserva el control de lo que comparte. El cierre de la hack es el domingo 22 a las 16:00, hora de Santiago.

## Retomar un turno

1. Abre el [repositorio del equipo](https://github.com/m5b6/platanus-hack-26). En el Mac de Mati vive en `~/repos/platanus-hack-26`. Comprueba el remoto, el estado local y el último `origin/main`. Con un árbol limpio, actualiza con `git pull --ff-only origin main`. Varios agentes trabajan sobre el mismo checkout.
2. Lee `AGENTS.md`, `README.md` y la sección del proyecto que corresponde al encargo. Para recuperar quién pidió qué, busca en Gmail el asunto exacto `[Hack26] Hilo del equipo`, empieza por la última respuesta y contrasta lo anunciado con el código. Las dos sesiones de diseño pueden estar hablando de superficies distintas: el globo y las miniaturas sobre sus arcos.
3. En este repositorio cada cambio funcional va directo a `main`. Revisa el diff, agrega solo tus archivos, haz commit, ejecuta `git pull --rebase origin main` y luego `git push origin main`. Verifica el commit remoto. Para comunicar un avance al equipo, responde a todos en el hilo existente y conserva la copia visible a `team@mail.vita.lat`.

## Elegir el punto de entrada

| Encargo | Dónde trabajar y qué conservar |
|---|---|
| Modelo del grafo | Lee `docs/AGENT_MODEL.md`, sección «Del 1:1 al grupo de ayuda». En turno 1 aparece A → B si en el diálogo A necesita ayuda de B. En turno 2, A → B y A → C habilitan el trío A, B y C. Si la segunda flecha es C → A, ambos pedidos siguen en sus 1:1. Deduplica por miembros y conserva las agendas y el consentimiento por audiencia. |
| Globo o miniaturas | Lee `design/DESIGN.md`, abre `design/reference.html` y sigue `design/HANDOFF_GRAFO.md` o `design/HANDOFF_MINIATURAS.md`. Mati aprobó el globo 3D, el desenfoque gradual y un máximo de un grupo en color. Revisa cada control sobre un arco a su escala final. La aprobación del globo cubre esa superficie. Para piezas que simulan el producto, usa Stageshow instalado en el repo y guarda su ensayo. |
| Producto y datos | Revisa `docs/ARCHITECTURE.md`, `docs/INTEGRATIONS.md`, `docs/PRIVACY.md` y las rutas en `backend/src/`. La demo incluye datos sintéticos. Distingue una ruta implementada, una prueba con respuestas simuladas y una conexión comprobada con cuenta real. Los enlaces personales de conexión dan acceso a la persona y se tratan como secretos. |
| Demo y pitch | Usa `docs/DEMO.md` para el guion y prueba el recorrido en el frontend. El globo puede mostrar conversaciones simuladas. Antes de atribuirlas a agentes en ejecución, comprueba la ruta y el resultado que alimentan esa pantalla. |
| Despliegue | Lee `docs/DEPLOY.md` y `render.yaml`. El destino solicitado es el workspace de Ian con créditos de la hack. Comprueba por separado el acceso de la app de GitHub al repo privado, que el Blueprint aparece en ese workspace, el SHA desplegado y la respuesta HTTPS de `/api/health`. Prueba también la portada. Anota la URL únicamente cuando el servicio esté identificado. |

Para desarrollar, usa la versión de Node de `.nvmrc` y los scripts del proyecto. Antes del relevo indica el commit, qué se probó y dónde, qué sigue pendiente y quién tiene el acceso para resolverlo. Registra las decisiones duraderas en el documento del repo que gobierna esa parte.
