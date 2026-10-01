# Toda funcion que se llama tiene que existir. Revisa llamadas "nombre(" contra
# definiciones "function nombre(" en cada archivo de servidor.
import re, sys
PROPIAS_DE_JS = set('if for while switch catch function return typeof new Number String Boolean Math Date '
  'Object Array JSON parseInt parseFloat isNaN isFinite Error Set Map Promise RegExp encodeURIComponent'.split())
malo = 0
for f in ['App_PM.gs', 'App_Dueno.gs']:
    s = open('/home/claude/ijm/' + f).read()
    sin_coment = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    sin_coment = re.sub(r'//[^\n]*', '', sin_coment)
    sin_textos = re.sub(r"'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"|`(?:\\.|[^`\\])*`", "''", sin_coment)
    definidas = set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', sin_textos))
    definidas |= set(re.findall(r'\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:function|\()', sin_textos))
    llamadas = set(re.findall(r'(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(', sin_textos))
    faltan = sorted(n for n in llamadas - definidas - PROPIAS_DE_JS if n.endswith('_') or n[:2] in ('pm','du'))
    print(f"{f}: {len(definidas)} funciones definidas · " + ('todas las llamadas existen' if not faltan else 'NO EXISTEN: ' + ', '.join(faltan)))
    malo += len(faltan)
sys.exit(1 if malo else 0)
