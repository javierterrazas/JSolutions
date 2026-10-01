import sys; sys.path.insert(0,'/tmp'); from navegador import *
fallas=0
def ok(c,m):
    global fallas; print(('  ✓ ' if c else '  ✗ ')+m); fallas += (0 if c else 1)
LOG=[]
def nav(pw, puente, archivo, app):
    b = pw.chromium.launch(); ctx = b.new_context(viewport={'width':390,'height':844}); pg = ctx.new_page()
    pg.expose_function('__srv', lambda a,f,args: (LOG.append(f), puente.llamar(a,f,args))[1])
    pg.add_init_script("window.__APP='%s';" % app + STUB + "localStorage.setItem('ijm_idioma','es');")
    html = open('/home/claude/ijm/'+archivo).read()
    pg.route('https://app.prueba/**', lambda r: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=html))
    pg.goto('https://app.prueba/'+archivo); return b, pg
with sync_playwright() as pw:
    puente = Puente()
    b, pg = nav(pw, puente, 'Dueno.html', 'du')
    pg.on('dialog', lambda d: d.accept())
    pg.fill('#lEmail','javier'); pg.fill('#lPin','482915'); pg.evaluate("entrar()"); pg.wait_for_timeout(800)
    pg.evaluate("ir('obras'); detalle('OB-001')"); pg.wait_for_timeout(700)
    print('  compra de la oficina, desde el detalle de la obra:')
    pg.evaluate("formGastoOficina()"); pg.wait_for_timeout(200)
    pg.fill('#goMonto','385'); pg.fill('#goProv','Ferguson Plumbing'); pg.fill('#goDesc','Válvula termostática')
    del LOG[:]
    pg.evaluate("guardarGastoOficina()"); pg.wait_for_timeout(1500)
    ok(LOG[:1]==['duHacer'] and 'duDetalleObra' not in LOG, 'un solo viaje para guardar y ver la obra: %s' % LOG)
    ok('Ferguson Plumbing' in pg.text_content('#detObra'), 'la obra ya muestra la compra, sin pedirla de nuevo')
    ok(LOG.count('duDatos')<=1, 'tu Inicio se pone al día por detrás, una sola vez')
    print('  dar de baja a un sub, desde el catálogo:')
    pg.evaluate("ir('catalogo')"); pg.wait_for_timeout(600)
    nombre = pg.evaluate("S.d.subsCatalogo.filter(function(s){return s.activo;})[0].nombre")
    i = pg.evaluate("S.d.subsCatalogo.indexOf(S.d.subsCatalogo.filter(function(s){return s.activo;})[0])")
    del LOG[:]
    pg.evaluate("activarSub(%d,false)" % i); pg.wait_for_timeout(1500)
    ok(LOG.count('duHacer')==1 and 'duDatos' not in LOG, 'un solo viaje para guardar y traer tu Inicio, sin recarga aparte: %s (la tarjeta Sistema del catálogo pide su estado al dibujarse, como antes)' % LOG)
    ok(pg.evaluate("S.d.subsCatalogo[%d].activo" % i)==False, '%s ya aparece dado de baja' % nombre)
    b.close()
print('\n' + ('%d FALLAS' % fallas if fallas else 'TODO BIEN'))
