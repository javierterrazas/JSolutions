"""Parte un archivo JavaScript en piezas de primer nivel: funciones, constantes e instrucciones,
cada una con los comentarios que la preceden. Sirve para comparar y para reensamblar."""
import re

def profundidad(texto):
    """Balance de llaves/corchetes/parentesis, ignorando cadenas y comentarios."""
    d = 0; i = 0; n = len(texto)
    while i < n:
        c = texto[i]
        if c in '"\'`':
            q = c; i += 1
            while i < n and texto[i] != q:
                if texto[i] == '\\': i += 1
                i += 1
        elif texto.startswith('//', i):
            j = texto.find('\n', i); i = n if j < 0 else j
        elif texto.startswith('/*', i):
            j = texto.find('*/', i + 2); i = n if j < 0 else j + 1
        elif c in '{[(': d += 1
        elif c in '}])': d -= 1
        i += 1
    return d

def piezas(codigo):
    lineas = codigo.split('\n'); out = []; coment = []; i = 0
    while i < len(lineas):
        l = lineas[i]
        if not l.strip():
            if coment: coment.append(l)
            i += 1; continue
        if l.startswith('//') or l.startswith('/*'):
            if l.startswith('/*') and '*/' not in l:
                j = i
                while '*/' not in lineas[j]: j += 1
                coment += lineas[i:j + 1]; i = j + 1
            else:
                coment.append(l); i += 1
            continue
        m = re.match(r'function ([\w$]+)\s*\(', l)
        if m:
            j = i
            if profundidad(l) > 0:                 # una funcion de una sola linea termina en esa linea
                while lineas[j] != '}': j += 1
            out.append({'tipo': 'func', 'nombre': m.group(1), 'coment': coment, 'cuerpo': lineas[i:j + 1]})
            coment = []; i = j + 1; continue
        m = re.match(r'(?:const|let|var) (\w+)', l)
        j = i; acum = l
        while profundidad(acum) > 0 or not acum.rstrip().endswith(';'):
            j += 1; acum += '\n' + lineas[j]
        out.append({'tipo': 'const' if m else 'instr', 'nombre': m.group(1) if m else 'instr@%d' % i,
                    'coment': coment, 'cuerpo': lineas[i:j + 1]})
        coment = []; i = j + 1
    if coment: out.append({'tipo': 'coment', 'nombre': 'final', 'coment': coment, 'cuerpo': []})
    return out

def texto(p):
    return '\n'.join(p['coment'] + p['cuerpo'])

def norm(p):
    return '\n'.join(x.rstrip() for x in p['cuerpo'])
