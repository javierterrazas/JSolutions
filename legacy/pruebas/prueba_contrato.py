import sys, re; sys.path.insert(0,'/tmp'); from navegador import *
fallas=0
def ok(c,m):
    global fallas; print(('  ✓ ' if c else '  ✗ ')+m); fallas += (0 if c else 1)
num=lambda s: float(re.sub(r'[^\d.]','',s) or 0)
with sync_playwright() as pw:
    b, pg = abrir(pw, 'Dueno.html', 'du')
    pg.fill('#lEmail','javier'); pg.fill('#lPin','482915'); pg.evaluate("entrar()"); pg.wait_for_timeout(500)
    pg.evaluate("ir('obras')"); pg.wait_for_timeout(150)
    for i, t in enumerate(pg.evaluate("S.d.tablero.map(t=>({id:t.id,orig:t.contratoOriginal,oc:t.montoOC,n:t.nOC,total:t.contratoActual}))")):
        filas = pg.evaluate("[...document.querySelectorAll('.grid .card')][%d].querySelectorAll('table tr')" % i + ".length")
        texto = pg.evaluate("[...document.querySelectorAll('.grid .card')][%d].querySelector('table').innerText" % i)
        f = {l.split('\t')[0].strip(): l.split('\t')[-1].strip() for l in texto.split('\n') if '\t' in l}
        clave_oc = [k for k in f if k.startswith('Órdenes de cambio')][0]
        ok(num(f['Contrato']) + num(f[clave_oc]) == t['total'],
           '%s: contrato %s + %s %s = %s (el total de antes)' % (t['id'], f['Contrato'], clave_oc.lower(), f[clave_oc], '${:,.0f}'.format(t['total'])))
    ok('Contrato + OC' not in pg.inner_text('#vista'), 'ya no aparece la suma en un solo renglón')
    pg.evaluate("detalle('OB-002')"); pg.wait_for_timeout(250)
    linea = pg.evaluate("[...document.querySelectorAll('#detObra .meta')].map(e=>e.innerText).find(t=>/Margen corriente/.test(t))")
    ok('contrato $' in linea and 'órdenes de cambio $' in linea, 'detalle de OB-002: "%s"' % linea[:95])
    pg.click('header .idioma'); pg.wait_for_timeout(200)
    pg.evaluate("ir('obras')"); pg.wait_for_timeout(150)
    en = pg.evaluate("[...document.querySelectorAll('.grid .card')][1].querySelector('table').innerText")
    ok('Contract\t' in en and 'Change orders (1)' in en, 'en inglés: %s' % ' | '.join(l.replace('\t',' ') for l in en.split('\n')[:2]))
    pg.evaluate("detalle('OB-002')"); pg.wait_for_timeout(250)
    linea_en = pg.evaluate("[...document.querySelectorAll('#detObra .meta')].map(e=>e.innerText).find(t=>/Current margin/.test(t))") or ''
    ok('change orders $' in linea_en and 'contract $' in linea_en, 'detalle en inglés: "%s"' % linea_en[:95])
    b.close()
print('\n' + ('%d FALLAS' % fallas if fallas else 'TODO BIEN'))
