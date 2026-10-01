import sys; sys.path.insert(0,'/tmp'); from navegador import *
fallas=0
def ok(c,m):
    global fallas; print(('  ✓ ' if c else '  ✗ ')+m); fallas += (0 if c else 1)
with sync_playwright() as pw:
    b, pg = abrir(pw, 'Dueno.html', 'du', idioma='es')
    pg.fill('#lEmail','javier'); pg.fill('#lPin','482915'); pg.evaluate("entrar()"); pg.wait_for_timeout(700)
    pg.evaluate("ir('obras')"); pg.wait_for_timeout(200)
    pg.select_option('#bAreas select', 'Baño'); pg.fill('#bIni', '2026-10-05'); pg.dispatch_event('#bIni', 'change'); pg.wait_for_timeout(500)
    ok(pg.input_value('#bFin')=='2026-10-30' and '20 días hábiles' in pg.inner_text('#bProp'), 'alta: propone entregar el %s — "%s"' % (pg.input_value('#bFin'), pg.inner_text('#bProp')))
    pg.fill('#bFin', '2026-10-23'); pg.dispatch_event('#bFin', 'input'); pg.wait_for_timeout(100)
    ok('Más corta' in pg.inner_text('#bProp'), 'si pongo una fecha más corta, avisa: "%s…"' % pg.inner_text('#bProp')[:50])
    pg.evaluate("detalle('OB-001')"); pg.wait_for_timeout(500)
    card = pg.evaluate("[...document.querySelectorAll('#detObra .card')].map(c=>c.innerText).find(t=>/^Cronograma/.test(t))") or ''
    ok('Entrega prevista' in card and 'Demolición' in card, 'detalle de OB-001: tarjeta de cronograma con plan y previsión')
    pg.evaluate("ir('catalogo')"); pg.wait_for_timeout(300)
    ok('Días' in pg.text_content('#vista') and 'Tile' in pg.text_content('#vista'), 'catálogo: columnas de días y de quién la hace')
    b.close()
    b, pg = abrir(pw, 'PM.html', 'pm', idioma='es')
    pg.fill('#lEmail','carlos'); pg.fill('#lPin','2468'); pg.evaluate("entrar()"); pg.wait_for_timeout(600)
    pg.evaluate("aplicarIdioma('es'); S.obra='OB-001'; S.vo='resumen'; ir('obra')"); pg.wait_for_timeout(300)
    txt = pg.text_content('#vista')
    ok('Esta semana' in txt and 'Entrega prevista' in txt, 'el PM ve su semana día por día y la entrega prevista')
    pg.click('header .idioma'); pg.wait_for_timeout(150)
    ok('This week' in pg.text_content('#vista'), 'en inglés: "This week"')
    b.close()
print('\n' + ('%d FALLAS' % fallas if fallas else 'TODO BIEN'))
