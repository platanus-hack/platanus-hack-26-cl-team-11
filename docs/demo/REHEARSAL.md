# Ensayo: «Diez personas, sus fuentes y sus agentes»

Bitácora de la segunda grabación. El guion y los contratos están en [`plan/`](plan/). Este archivo
se completa al filmar: tomas, puertas, lo que no se revisó.

Estado al 21-nov-2026, 15:10 (Santiago): **todavía no hay video**. Las piezas están en `main`
(`50663e5`) y pasaron sus pruebas. Falta la sonda, un segundo ensayo, la revisión del escenario y filmar.

## Hecho

| Paso | Resultado |
|---|---|
| Pruebas sin servidor (Node 22.23.1) | `proveedor-demo.test.mts` 11 de 11, `servidor-demo.test.mts` 15 de 15, `preparar2.test.mjs` 16 de 16, `tiempos2.test.mjs` 20 de 20 |
| Copia congelada en `50663e5` y `npm run build` | Construyó |
| Arranque del servidor de demo (`servidor-demo.mts`, puerto 8797) | Partió. Calentamiento del modelo: 2,6 s. `/demo/estado` responde, `rondaSola: false` |
| Ensayo 1 (`preparar2.mjs --ensayo`, HTTP real, modelo real) | Sin diferencias en las diez personas ni en la sala. Ronda lista en 26,1 s reales, 19 llamadas, 0 fallidas |

## Ensayo 1: qué decidió el modelo

Sala «Equipo Quillay», modelo `claude-sonnet-5-5` por la terminal.

| Conversación | Tema | Respuesta |
|---|---|---|
| Ignacio → Catalina | Conciliación de cobros con el banco | `parcial` |
| Antonia → Fernanda | guion y ensayo del pitch | `si` |
| Antonia → Nicolás | guion y ensayo del pitch | `si` |
| Javiera → Cristóbal | Animación en canvas | `si` |
| Javiera → Felipe | Animación en canvas | `parcial` |

Propuestas: Antonia con Fernanda y Nicolás; Ignacio con Catalina; Javiera con Cristóbal.

Puertas: G0 pasa, G1 pasa, G2 pasa, G2b pasa, **G3 falla sin `--parcial-vale`**: nadie respondió «no».

Los dos mensajes del hilo Ignacio → Catalina, tal como los escribió el modelo:

- Ignacio: «Hola, mi persona necesita ayuda con la conciliación de cobros con el banco, que lleva 4 días sin avances. Te escribo porque tú trabajas en conciliación de pagos y cobros; ¿puedes ayudar o indicar quién puede?»
- Catalina: «Hola, mi persona conoce la conciliación de cobros y puede orientar, pero no puede hacerse cargo de llevarla. Si nos cuentas qué se ha revisado y dónde está el bloqueo, puede darles ideas de por dónde seguir.»

La respuesta de Catalina no da ninguna causa (ni sueño ni reuniones). La de Felipe tampoco.

## Decisión D1

Con disponibilidad baja, el agente respondió «Puede orientar» las dos veces, no «No puede». Se filma
con `--parcial-vale` (variante V3): la leyenda dice «El agente de Catalina solo ofrece orientar. No
dice por qué» y Catalina responde «Ahora no» en su teléfono. No se cambia ningún prompt ni código del
producto para forzar un «no».

Es una sola ronda, no una tasa. La sonda (`ensayo-respuesta.mts --veces 6`, 14 llamadas) todavía no corrió.

## Falta

1. Sonda de respuestas y segundo ensayo con `--parcial-vale`.
2. Capturas del escenario y de la pantalla de permiso junto a `design/reference.png`; `film.mjs --gate` y `layout.mjs` de Stageshow sobre el escenario.
3. Primera toma con `--capturas` y `--max-segundos 200`, para medir el largo real (la revisión estimó 155 a 180 s, no 136).
4. Leer los dos mensajes del hilo elegido en el JSON de la toma antes de publicar.

## No revisado todavía

- El toque en «Conectar Google Calendar» dentro del marco del teléfono (encabezado `sec-fetch-site`, cookie `SameSite=Lax`). Si falla: `--permiso api`.
- El globo con diez personas y movimiento reducido. Si falla o aparece la marca «Listo»: `--sin-globo`.
- El escenario y la pantalla de permiso nunca se han visto en un navegador: sus medidas son aritmética.
- El largo del video y cuántos cuadros manda la captura con las caras animadas.
