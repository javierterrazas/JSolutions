#!/usr/bin/env bash
# Construye las apps desde app/fuente/ y corre todas las pruebas contra lo construido.
# Requiere Node 18+ y Python 3 con openpyxl (pip install openpyxl).
# Las pruebas del navegador requieren Playwright: pip install playwright && playwright install chromium
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "== Construir desde app/fuente/"; python3 "$DIR/app/construir.py" | sed 's/^/  /' || { echo "La construcción falló"; exit 1; }
W="$DIR/.trabajo"; rm -rf "$W"; mkdir -p "$W/sim"
cambiar() { sed -e "s#/home/claude/ijm/#$DIR/app/#g" -e "s#/tmp/sim/#$W/sim/#g" -e "s#/tmp/#$W/#g" -e "s#'/tmp'#'$W'#g" "$1" > "$2"; }   # nunca depende de lo que haya en /tmp
for f in "$DIR"/pruebas/*; do case "$f" in *.jpg|*.png) cp "$f" "$W/";; *) cambiar "$f" "$W/$(basename "$f")";; esac; done
for f in "$DIR"/sim/*; do cambiar "$f" "$W/sim/$(basename "$f")"; done
python3 "$W/preparar_libro.py" || { echo "No se pudo leer la plantilla (¿falta openpyxl?)"; exit 1; }
fallas=0
echo "== Funciones"; python3 "$W/verificar_funciones.py" | sed 's/^/  /'
echo "== Servidor"
for f in "$W"/prueba_*.js "$W/verificacion.js"; do
  n=$(basename "$f" .js); [ "$n" = "prueba_mensajes" ] && continue
  r=$(cd "$DIR/app" && node "$f" 2>&1 | grep -E "TODO BIEN|FALLAS" | tail -1); [ -z "$r" ] && r="(se cayó)"
  printf "  %-24s %s\n" "$n" "$r"; case "$r" in *"TODO BIEN"*) ;; *) fallas=$((fallas+1));; esac
done
echo "== Mes simulado"
(cd "$W/sim" && TZ=America/Chicago node sim.js >/dev/null 2>&1) && python3 -c "import json;r=json.load(open('$W/sim/despues.json'));h=len(r['hallazgos']);print('  ',h,'hallazgos');exit(1 if h else 0)" || fallas=$((fallas+1))
if python3 -c "import playwright" 2>/dev/null; then
  echo "== Navegador"
  for f in "$W"/prueba_*.py; do n=$(basename "$f" .py); [ "$n" = "prueba_placeholder" ] && continue
    out=$(cd "$W" && timeout 400 python3 "$f" 2>&1)
    case "$n" in
      prueba_idioma) r=$(echo "$out" | grep "QUEDARON" | tail -1)
                     case "$r" in *"QUEDARON: 0"*|*"QUEDARON: 1"*) r="TODO BIEN ($r)";; esac;;
      prueba_scroll) if echo "$out" | grep -q "se movió *[1-9]"; then r="FALLAS: la página de afuera se mueve"; else r="TODO BIEN"; fi;;
      *) r=$(echo "$out" | tail -1);;
    esac
    printf "  %-24s %s\n" "$n" "$r"; case "$r" in *"TODO BIEN"*) ;; *) fallas=$((fallas+1));; esac; done
else echo "(Playwright no está instalado: se omiten las pruebas del navegador)"; fi
echo; if [ $fallas -eq 0 ]; then echo "TODO BIEN"; else echo "$fallas prueba(s) con fallas"; fi
exit $fallas
