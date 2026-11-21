#!/usr/bin/env bash
# Stop hook: AGENTS.md regla 1. No se termina un turno con trabajo sin pushear.
input=$(cat)
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

dirty=$(git status --porcelain 2>/dev/null)
if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
  unpushed=$(git log --oneline '@{u}..HEAD' 2>/dev/null)
else
  unpushed="(la rama actual no tiene upstream)"
fi
[ -z "$dirty" ] && [ -z "$unpushed" ] && exit 0

# Ya se bloqueó una vez en este turno: se deja terminar para no entrar en loop.
printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && exit 0

{
  echo "AGENTS.md regla 1: no termines el turno con trabajo sin pushear a origin/main."
  [ -n "$dirty" ] && { echo "Sin commitear:"; echo "$dirty" | head -20; }
  [ -n "$unpushed" ] && { echo "Sin pushear:"; echo "$unpushed" | head -20; }
  echo "Haz: git add <tus archivos> && git commit && git pull --rebase origin main && git push origin main."
  echo "Si no se puede, dile al usuario el error exacto."
} >&2
exit 2
