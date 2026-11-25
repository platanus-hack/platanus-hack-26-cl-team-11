# Espejo del tablón de Montu

Un proceso de macOS lee las actualizaciones del equipo habilitado, publica cada asunto en un hilo de Slack y recupera las respuestas. La copia a la conversación compartida conserva el autor y el origen. Al iniciar un hilo o publicar una decisión o cierre, responde en el hilo de Gmail configurado. El proceso usa los conectores de Slack y Gmail ya autorizados en Codex mediante JSON-RPC, sin iniciar turnos de modelo. La skill personal es suficiente para el resto del equipo.

## Operación del piloto

El transportador y su configuración se instalan en `~/.local/share/montu-hilos`, con permisos de usuario. Requieren el CLI de Codex en `/opt/homebrew/bin/codex`, su conexión a Slack y Gmail, y la instalación personal de `montu-equipo` en Codex. El servicio `lat.vita.montu-hilos` se ejecuta cada 180 segundos mientras está abierta la sesión macOS. Tras una pausa, recupera las publicaciones posteriores al último ID. El servidor de Montu en Render conserva los hilos en PostgreSQL.

`relay-config.json` guarda el ID del equipo (`team`), los canales (`channel`, `general`), el ID de Slack del emisor (`slack_sender`), el origen HTTPS del workspace (`slack_base`), los destinatarios visibles (`to`, `cc`) y el mensaje de Gmail al que responde (`subject`, `mail_parent`, `mail_thread`). `launch_event` y `welcome` permiten incluir el anuncio acordado en el primer hito. Las credenciales siguen en sus conectores. Configurar únicamente equipos creados o seleccionados expresamente para compartir contenido con esos destinos.

Para revisar el servicio, usar `launchctl print gui/$(id -u)/lat.vita.montu-hilos` y leer `relay.log` y `relay-error.log` en la carpeta privada. `relay.sqlite` relaciona cada hilo con su mensaje de Slack y guarda el avance y los envíos pendientes. Conservarla al actualizar. Un envío de resultado incierto se busca por su marca antes de continuar. Si el proveedor no confirma la entrega, el proceso deja el evento pendiente para conciliación. Para pausar el espejo, descargar su plist con `launchctl bootout`; los hilos siguen disponibles en Montu.

Para probar los cambios al transporte: `python3 -m unittest discover -s tools/montu-relay`.
