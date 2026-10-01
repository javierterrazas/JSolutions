import sys; sys.path.insert(0,'/tmp'); from navegador import *
fallas=0
def ok(c,m):
    global fallas; print(('  ✓ ' if c else '  ✗ ')+m); fallas += (0 if c else 1)
with sync_playwright() as pw:
    for archivo, app, u, pin in [('PM.html','pm','carlos','2468'), ('Dueno.html','du','javier','482915')]:
        b, pg = abrir(pw, archivo, app, idioma='es')
        print('\n'+archivo)
        pg.fill('#lEmail', u); pg.fill('#lPin', pin)
        ok(pg.get_attribute('#lPin','type')=='password', 'el PIN se escribe oculto (%s)' % ('•'*len(pin)))
        ok(pg.get_attribute('#lPin','inputmode')=='numeric', 'y el teléfono sigue mostrando el teclado numérico')
        pg.click('.pinbox .ojo')
        ok(pg.get_attribute('#lPin','type')=='text' and pg.input_value('#lPin')==pin, 'el ojo lo muestra para revisar: %s' % pg.input_value('#lPin'))
        pg.click('.pinbox .ojo')
        ok(pg.get_attribute('#lPin','type')=='password' and pg.input_value('#lPin')==pin, 'y lo vuelve a ocultar sin borrar lo tecleado')
        pg.click('.idioma'); pg.wait_for_timeout(100)
        ok(pg.get_attribute('.pinbox .ojo','title')=='Show PIN', 'en inglés el botón dice "%s"' % pg.get_attribute('.pinbox .ojo','title'))
        pg.click('.pinbox .ojo'); pg.wait_for_timeout(80)
        ok(pg.get_attribute('.pinbox .ojo','title')=='Hide PIN', 'al tocarlo en inglés cambia a "%s" (antes quedaba en español)' % pg.get_attribute('.pinbox .ojo','title'))
        pg.click('.pinbox .ojo'); pg.wait_for_timeout(80)
        pg.click('.idioma'); pg.wait_for_timeout(100)
        ok(pg.get_attribute('.pinbox .ojo','title')=='Mostrar PIN', 'y de regreso en español: "%s"' % pg.get_attribute('.pinbox .ojo','title'))
        pg.evaluate("entrar()"); pg.wait_for_timeout(600)
        ok(pg.evaluate("!!S.token"), 'y se entra igual que antes')
        if app == 'pm':
            pg.evaluate("verPin(document.querySelector('.pinbox .ojo'))")          # lo dejo visible
            pg.evaluate("volverAEntrar()"); pg.wait_for_timeout(200)
            ok(pg.get_attribute('#lPin','type')=='password', 'al volver a la pantalla de entrada, el PIN regresa a oculto')
        b.close()
print('\n' + ('%d FALLAS' % fallas if fallas else 'TODO BIEN'))
