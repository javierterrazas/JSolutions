import sys; sys.path.insert(0,'/tmp'); from navegador import *
fallas=0
def ok(c,m):
    global fallas; print(('  ✓ ' if c else '  ✗ ')+m); fallas += (0 if c else 1)
def nav(pw, puente, archivo, app):
    b = pw.chromium.launch(); ctx = b.new_context(viewport={'width':390,'height':844}); pg = ctx.new_page()
    pg.expose_function('__srv', lambda a,f,args: puente.llamar(a,f,args))
    pg.add_init_script("window.__APP='%s';" % app + STUB + "localStorage.setItem('ijm_idioma','es');")
    html = open('/home/claude/ijm/'+archivo).read()
    pg.route('https://app.prueba/**', lambda r: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=html))
    pg.goto('https://app.prueba/'+archivo); return b, pg
with sync_playwright() as pw:
    puente = Puente()
    ta = puente.llamar('du','duLogin',['javier','482915',''])['v']['token']
    import datetime; hoy = datetime.date.today().isoformat()
    obra = puente.llamar('du','duNuevaObra',[ta,{'telefono':'512-555-0100','cliente':'Familia Soto','direccion':'Austin','pm':'carlos','inicio':hoy,'finEst':hoy,'contrato':30000,
             'areas':[{'tipo':'Baño','nombre':'Baño','pies2':40}]}])['v']['id']
    b, pg = nav(pw, puente, 'Dueno.html', 'du')
    pg.fill('#lEmail','javier'); pg.fill('#lPin','482915'); pg.evaluate("entrar()"); pg.wait_for_timeout(700)
    ok('Obras que no pueden arrancar' in pg.text_content('#vista'), 'tu Inicio: "Obras que no pueden arrancar" en rojo')
    pg.evaluate("ir('obras')"); pg.wait_for_timeout(200)
    tarjeta = pg.locator('.grid .card', has_text='Familia Soto')
    ok('Falta presupuesto' in tarjeta.text_content() and tarjeta.locator('text=Capturar presupuesto').count()==1, 'la tarjeta de la obra: "Falta presupuesto" y botón para capturarlo')
    b.close()
    b, pg = nav(pw, puente, 'PM.html', 'pm')
    pg.fill('#lEmail','carlos'); pg.fill('#lPin','2468'); pg.evaluate("entrar()"); pg.wait_for_timeout(600)
    pg.evaluate("aplicarIdioma('es'); S.obra='%s'; ir('hoy')" % obra); pg.wait_for_timeout(250)
    t = pg.text_content('#vista')
    ok('todavía no puede arrancar' in t and pg.locator('#bDia').count()==0, 'el PM ve el aviso en lugar del cierre de día (no puede llenar algo que se va a rechazar)')
    b.close()
print('\n' + ('%d FALLAS' % fallas if fallas else 'TODO BIEN'))
