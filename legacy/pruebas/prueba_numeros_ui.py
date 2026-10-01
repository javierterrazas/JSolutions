import sys; sys.path.insert(0,'/tmp'); from navegador import *
fallas=0
def ok(c,m):
    global fallas; print(('  ✓ ' if c else '  ✗ ')+m); fallas += (0 if c else 1)
with sync_playwright() as pw:
    b, pg = abrir(pw, 'Dueno.html', 'du', idioma='es')
    pg.set_viewport_size({'width':1280, 'height':900})
    pg.fill('#lEmail','javier'); pg.fill('#lPin','482915'); pg.evaluate("entrar()"); pg.wait_for_timeout(700)
    pg.evaluate("ir('obras'); detalle('OB-001')"); pg.wait_for_timeout(700)
    pg.evaluate("formPresupuesto('OB-001')"); pg.wait_for_timeout(700)
    campo = pg.locator('#accObra .pl').nth(1)
    ok(campo.evaluate("e => getComputedStyle(e).appearance") == 'textfield', 'los precios del cotizador ya no muestran las flechitas')
    campo.fill('1500'); campo.focus(); campo.hover()
    pg.mouse.wheel(0, 300); pg.wait_for_timeout(300)
    ok(campo.input_value() == '1500', 'mover la rueda del ratón sobre el precio ya no lo cambia: sigue en %s' % campo.input_value())
    campo.fill('2350'); pg.evaluate("sumaPre()")
    suma = pg.evaluate("[].reduce.call(document.querySelectorAll('#accObra .pl'), function(a,e){ return a + (Number(e.value)||0); }, 0)")
    ok(campo.input_value()=='2350' and '{:,}'.format(int(suma)) in pg.text_content('#preTot'), 'escribir el número funciona igual, y el total se actualiza: %s' % pg.text_content('#preTot'))
    b.close()
    b, pg = abrir(pw, 'PM.html', 'pm', idioma='es')
    ok(pg.evaluate("[...document.styleSheets].some(s => [...s.cssRules].some(r => r.cssText.indexOf('inner-spin-button')>=0))"), 'en la app del PM, lo mismo')
    b.close()
print('\n' + ('%d FALLAS' % fallas if fallas else 'TODO BIEN'))
