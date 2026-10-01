#!/usr/bin/env python3
"""Arma los cuatro archivos que se pegan en Apps Script a partir de fuente/:

    App_Dueno.gs = fuente/admin/config.js + fuente/comun/*.js + fuente/admin/servidor.js + fuente/admin/final.js
    App_PM.gs    = fuente/pm/config.js    + fuente/comun/*.js + fuente/pm/servidor.js    + fuente/pm/final.js
    Dueno.html / PM.html = fuente/<app>/<pantalla>.html con el código compartido (cliente/comun.js)
                           y el diccionario de inglés (idioma_en.py) en sus marcas @@COMUN@@ y @@IDIOMA@@

Uso:  python3 construir.py
Opcional: fuente/instalacion.json con {"SS_ID": "..."}: los archivos salen con el ID de tu libro ya puesto,
y no hay que reemplazarlo a mano en cada actualización.
"""
import os, re, sys, json, subprocess
BASE = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(BASE, 'fuente')
sys.path.insert(0, BASE)
from piezas import piezas, texto

AVISO_GS = ('// ARCHIVO GENERADO por construir.py a partir de fuente/. No lo edites aquí: tus cambios se perderían\n'
            '// en la siguiente construcción. Edita fuente/ y vuelve a correr: python3 construir.py\n\n')
AVISO_HTML = '<!-- ARCHIVO GENERADO por construir.py a partir de fuente/. Edita fuente/ y vuelve a correr construir.py. -->\n'

def leer(ruta):
    return open(os.path.join(F, ruta), encoding='utf-8').read()

def claves_sh(pzs):
    sh = next((p for p in pzs if p['nombre'] == 'SH'), None)
    return set(re.findall(r'\b([A-Z_]+)\s*:', '\n'.join(sh['cuerpo']))) if sh else set()

def armar(app):
    archivos = ['%s/config.js' % app] + ['comun/' + f for f in sorted(os.listdir(os.path.join(F, 'comun'))) if f.endswith('.js')] + \
               ['%s/servidor.js' % app, '%s/final.js' % app]
    todas = []
    for a in archivos:
        for p in piezas(leer(a)):
            if p['tipo'] == 'coment': continue                  # comentario suelto al final de un archivo
            p['archivo'] = a
            todas.append(p)
    # constantes primero (una constante no existe antes de su declaracion), luego funciones, luego instrucciones
    orden = [p for p in todas if p['tipo'] == 'const'] + [p for p in todas if p['tipo'] == 'func'] + [p for p in todas if p['tipo'] == 'instr']
    nombres = [p['nombre'] for p in orden if p['tipo'] != 'instr']
    repetidos = sorted(set(n for n in nombres if nombres.count(n) > 1))
    if repetidos:
        raise SystemExit('ERROR en %s: definido dos veces: %s' % (app, ', '.join(repetidos)))
    consts = [p for p in orden if p['tipo'] == 'const']
    for i, p in enumerate(consts):
        valor = '\n'.join(p['cuerpo']).split('=', 1)[-1]
        for q in consts[i + 1:]:
            if re.search(r'(?<![\w$.])' + re.escape(q['nombre']) + r'\b', valor):
                raise SystemExit('ERROR en %s: la constante %s usa %s, que se declara después' % (app, p['nombre'], q['nombre']))
    codigo = AVISO_GS + '\n\n'.join(texto(p) for p in orden) + '\n'
    inst = os.path.join(F, 'instalacion.json')
    if os.path.exists(inst):
        ssid = json.load(open(inst)).get('SS_ID', '').strip()
        if ssid: codigo = codigo.replace("'PEGAR_AQUI_EL_ID_DEL_SPREADSHEET'", "'%s'" % ssid)
    return codigo, todas

def pantalla(app, nombre, idioma):
    s = leer('%s/%s' % (app, nombre))
    for marca in ('/*@@COMUN@@*/', '/*@@IDIOMA@@*/'):
        if s.count(marca) != 1: raise SystemExit('ERROR en %s: la marca %s debe aparecer una vez' % (nombre, marca))
    s = s.replace('/*@@COMUN@@*/', leer('cliente/comun.js').rstrip('\n')).replace('/*@@IDIOMA@@*/', idioma)
    return s.replace('<!DOCTYPE html>\n', '<!DOCTYPE html>\n' + AVISO_HTML, 1)

def sintaxis(js, etiqueta):
    tmp = os.path.join(BASE, '.revision.js')
    open(tmp, 'w', encoding='utf-8').write(js)
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.remove(tmp)
    if r.returncode: raise SystemExit('ERROR de sintaxis en %s:\n%s' % (etiqueta, r.stderr[:800]))

def main():
    subprocess.run([sys.executable, os.path.join(BASE, 'gen_idioma.py')], check=True, stdout=subprocess.DEVNULL)
    idioma = open(os.path.join(BASE, 'idioma_bloque.js'), encoding='utf-8').read().strip('\n')
    piezas_app = {}
    for app, salida in (('admin', 'App_Dueno.gs'), ('pm', 'App_PM.gs')):
        codigo, pzs = armar(app)
        sintaxis(codigo, salida)
        open(os.path.join(BASE, salida), 'w', encoding='utf-8').write(codigo)
        piezas_app[app] = pzs
        print('  %-13s %4d funciones · %2d constantes' % (salida, sum(p['tipo'] == 'func' for p in pzs), sum(p['tipo'] == 'const' for p in pzs)))
    # lo compartido solo puede usar hojas que existen en las DOS apps (la del PM es mas corta a proposito)
    sh = {a: claves_sh(piezas_app[a]) for a in piezas_app}
    usadas = set()
    for p in piezas_app['admin']:
        if p['archivo'].startswith('comun/'): usadas |= set(re.findall(r'\bSH\.([A-Z_]+)', '\n'.join(p['cuerpo'])))
    faltan = {a: sorted(usadas - sh[a]) for a in sh if usadas - sh[a]}
    if faltan: raise SystemExit('ERROR: el código compartido usa hojas que una app no tiene: %s' % faltan)
    for app, nombre in (('admin', 'Dueno.html'), ('pm', 'PM.html')):
        s = pantalla(app, nombre, idioma)
        if (s.count('<script>'), s.count('</script>'), s.count('</html>')) != (1, 1, 1):
            raise SystemExit('ERROR en %s: etiquetas <script>/</html> fuera de lugar' % nombre)
        sintaxis(re.search(r'<script>([\s\S]*)</script>', s).group(1), nombre)
        open(os.path.join(BASE, nombre), 'w', encoding='utf-8').write(s)
        print('  %-13s listo' % nombre)
    print('Construido. Ahora corre las pruebas antes de pegar los archivos en Apps Script.')

if __name__ == '__main__':
    main()
