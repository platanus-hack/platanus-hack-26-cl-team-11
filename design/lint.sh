#!/usr/bin/env bash
# Revisa que la UI no se salga del sistema de diseño (design/DESIGN.md).
# Uso: design/lint.sh            revisa todos los archivos de UI del repo
#      design/lint.sh a.css b.tsx revisa solo esos
# Sale con 1 si encuentra algo. Para una excepción real y justificada, agrega en esa misma línea
# el comentario  rd-lint-ok: <motivo>
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 0

if [ "$#" -gt 0 ]; then
  files=$(printf '%s\n' "$@")
else
  files=$( { git ls-files; git ls-files --others --exclude-standard; } 2>/dev/null | sort -u )
fi
files=$(printf '%s\n' "$files" | grep -E '\.(css|scss|sass|less|html?|jsx|tsx|vue|svelte|astro)$' | grep -vE '^(design/|docs/|node_modules/|dist/|build/|\.next/)' )
[ -z "$files" ] && { echo "design/lint: sin archivos de UI que revisar."; exit 0; }

fail=0
check() { # $1 = regex, $2 = mensaje, $3 = (opcional) regex de lo que sí está permitido
  local out
  out=$(printf '%s\n' "$files" | while IFS= read -r f; do [ -f "$f" ] && grep -nHE "$1" "$f" 2>/dev/null; done | grep -v 'rd-lint-ok' | grep -vE "${3:-^\$never\$}" | head -15)
  if [ -n "$out" ]; then
    fail=1
    printf '\n✗ %s\n%s\n' "$2" "$out"
  fi
}

check '#[0-9a-fA-F]{3,8}\b'                                   'Color escrito a mano. Usa un token: var(--rd-*) de design/tokens.css.'
check '\b(rgba?|hsla?|oklch|oklab)\('                         'Color escrito a mano. Usa un token: var(--rd-*) de design/tokens.css.'
check 'font-family[[:space:]]*:' 'Tipografía escrita a mano. Usa var(--rd-font), var(--rd-font-num) o var(--rd-font-mono).' 'font-family[[:space:]]*:[[:space:]]*(var\(--rd-font(-num|-mono)?\)|inherit)[[:space:]]*[;}]'
check 'font-weight[[:space:]]*:[[:space:]]*(bold|[789]00)'    'Peso prohibido. El único peso fuerte es var(--rd-weight) (600).'
check '(linear|radial|conic)-gradient\('                      'Degradado escrito a mano. Solo var(--rd-gradient), y solo donde DESIGN.md lo permite.'
check 'font-style[[:space:]]*:[[:space:]]*italic'             'Cursiva prohibida.'
check '\b(bg|text|border|from|via|to|ring|fill|stroke|shadow|outline|decoration)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(-[0-9]{2,3})?\b' 'Color de Tailwind. Mapea Tailwind a los tokens --rd-* y usa esas clases.'
check '(^|[^-a-zA-Z])font-(bold|extrabold|black|serif|mono)\b'            'Clase de tipografía fuera del sistema (peso 700+ o familia distinta).'
check '\b(italic|uppercase)\b.*class|class.*\b(italic|uppercase)\b' 'Cursiva o mayúsculas sostenidas: prohibidas.'

if [ "$fail" -eq 1 ]; then
  printf '\nLa UI se sale del sistema de diseño. Lee design/DESIGN.md, usa las primitivas rd-* de design/ronda.css\ny los tokens de design/tokens.css. Si falta una pieza, agrégala ahí primero.\n'
  exit 1
fi
echo "design/lint: OK."
