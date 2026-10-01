import sys; sys.path.insert(0,'/tmp'); from navegador import *
fallas=0
def ok(c,m):
    global fallas; print(('  ✓ ' if c else '  ✗ ')+m); fallas += (0 if c else 1)
with sync_playwright() as pw:
    b, pg = abrir(pw, 'Dueno.html', 'du', idioma='es')
    pg.fill('#lEmail','javier'); pg.fill('#lPin','482915'); pg.evaluate("entrar()"); pg.wait_for_timeout(700)
    pg.evaluate("ir('obras'); detalle('OB-001')"); pg.wait_for_timeout(600)
    tabla = pg.evaluate("[...document.querySelectorAll('#detObra .card')].map(c=>c.textContent).find(t=>t.indexOf('Presupuesto contra real, por etapa')>=0)") or ''
    ok('Plomería' in tabla and 'Tile' in tabla, 'el detalle muestra presupuesto contra real por etapa')
    pg.evaluate("formPresupuesto('OB-001')"); pg.wait_for_timeout(600)
    n = pg.locator('#accObra .pl').count()
    ok(n >= 10 and 'Presupuesto por etapa' in pg.text_content('#accObra'), 'el formulario: %d montos, uno por etapa' % n)
    pg.evaluate("S.contratoPre=30000"); 
    pg.evaluate("document.querySelectorAll('#accObra .pl').forEach(function(e){e.value=''}); var e=document.querySelectorAll('#accObra .pl'); e[0].value=29000; sumaPre()")
    ok('precios en lugar de costos' in pg.text_content('#preMar'), 'costos casi iguales al contrato: "%s"' % pg.text_content('#preMar')[:60])
    pg.evaluate("var e=document.querySelectorAll('#accObra .pl'); e[0].value=18000; sumaPre()")
    ok(pg.text_content('#preMar').startswith('Margen esperado: 40%'), 'con costos razonables: "%s"' % pg.text_content('#preMar'))
    pg.click('header .idioma'); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.querySelectorAll('#accObra .pl')[0].value")=='18000' and 'Plumbing' in pg.text_content('#accObra'), 'en inglés: el monto sigue ahí y las etapas se traducen (Plumbing)')
    b.close()
print('\n' + ('%d FALLAS' % fallas if fallas else 'TODO BIEN'))
