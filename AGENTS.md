# AGENTS.md

Reglas para cualquier agente (Claude Code, Codex u otro) y cualquier persona que trabaje en este repo.
Platanus Hack 26: cierre el domingo 22-nov a las 16:00.

## Regla 1: cada cambio se commitea y se pushea al tiro

Somos varias personas y varios agentes sobre el mismo repo al mismo tiempo. Lo que no está en
`origin/main` no existe para el resto, y el trabajo que se queda en un laptop se pierde o choca.

- Después de **cada cambio**, commit y push **antes** de empezar el siguiente. No se acumulan cambios.
- Todo va **directo a `main`**. Sin ramas de trabajo, sin PRs, sin `git stash`.
- Secuencia exacta:

      git add <los archivos que tocaste>
      git commit -m "<tipo>: <qué cambió>"
      git pull --rebase origin main
      git push origin main

- Si el push falla porque alguien pusheó antes: `git pull --rebase origin main` y `git push` otra vez.
  Si el rebase da conflicto, se resuelve en el momento conservando el trabajo de la otra persona.
- Nunca `git push --force`, nunca `git reset --hard` sobre commits ya pusheados, nunca `--no-verify`.
- Un turno no termina con cambios sin commitear ni commits sin pushear. En Claude Code lo verifica
  el hook `.claude/hooks/require-pushed.sh`.
- Si no se puede pushear (sin red, conflicto que no sabes resolver), dilo con el error exacto.
  Nunca se deja en silencio.

## Commits

- Un cambio, un commit. Mensaje `tipo: descripción` (`feat`, `fix`, `docs`, `chore`).
- `git add` solo de lo que tocaste. Nunca `git add -A` a ciegas.
- Cada cambio tiene que ser lo bastante chico para que `main` siga corriendo. Un cambio grande entra
  primero en archivos nuevos que nadie usa todavía y se conecta al final.

## Secretos

Con push inmediato, un secreto commiteado queda publicado al instante, y los repos de equipo de
Platanus Hack son públicos.

- Llaves y tokens van en `.env` local (ignorado por git). En `.env.example` va solo el nombre de la variable.
- Antes de cada commit, mira el diff: ninguna llave, token ni dato personal real.

## Contexto del proyecto

Qué construimos, alcance de la demo y decisiones abiertas: `README.md` y `docs/`.
