import sys; sys.path.insert(0,'/tmp'); from navegador import *
fallas=0
def ok(c,m):
    global fallas; print(('  ✓ ' if c else '  ✗ ')+m); fallas += (0 if c else 1)
with sync_playwright() as pw:
    b, pg = abrir(pw, 'Dueno.html', 'du', idioma='es')
    pg.fill('#lEmail','javier'); pg.fill('#lPin','482915'); pg.evaluate("entrar()"); pg.wait_for_timeout(700)
    pg.evaluate("ir('catalogo')"); pg.wait_for_timeout(700)
    t = pg.text_content('#sistema') or ''
    ok(all(x in t for x in ['Respaldo semanal','Salud del libro','Protección de hojas','Errores de los últimos 7 días']), 'Catálogo → Sistema: respaldo, salud, protección y errores')
    pg.click('#sistema >> text=Revisar ahora'); pg.wait_for_timeout(700)
    ok('El libro está sano' in pg.text_content('#toast') and 'Sin problemas' in pg.text_content('#sistema'), 'revisar ahora: "El libro está sano"')
    pg.click('header .idioma'); pg.wait_for_timeout(250)
    ok('Workbook health' in pg.text_content('#sistema'), 'en inglés: "Workbook health"')
    b.close()
print('\n' + ('%d FALLAS' % fallas if fallas else 'TODO BIEN'))
