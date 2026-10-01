import sys; sys.path.insert(0,'/tmp'); from navegador import *
with sync_playwright() as pw:
    for archivo, app in [('PM.html','pm'), ('Dueno.html','du')]:
        b, pg = abrir(pw, archivo, app, idioma='es')
        es = pg.get_attribute('#lEmail','placeholder'); pg.click('#login .idioma'); pg.wait_for_timeout(100)
        print('  %-10s español: "%s" · inglés: "%s"' % (archivo, es, pg.get_attribute('#lEmail','placeholder')))
        b.close()
