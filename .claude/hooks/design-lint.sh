#!/usr/bin/env bash
# Stop hook: AGENTS.md regla 3. No se termina un turno con UI fuera del sistema de diseño.
input=$(cat)
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -x design/lint.sh ] || exit 0

# Ya se bloqueó una vez en este turno: se deja terminar para no entrar en loop.
printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && exit 0

out=$(design/lint.sh 2>&1) && exit 0
{
  echo "AGENTS.md regla 3: la UI tiene que seguir design/DESIGN.md."
  echo "$out"
} >&2
exit 2
