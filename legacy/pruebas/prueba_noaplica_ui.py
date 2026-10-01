import sys, re; sys.path.insert(0,'/tmp'); from navegador import *
fallas=0
def ok(c,m):
    global fallas; print(('  ✓ ' if c else '  ✗ ')+m); fallas += (0 if c else 1)
def navegador_con(pw, puente, archivo, app):
    b = pw.chromium.launch(); ctx = b.new_context(viewport={'width':390,'height':844}); pg = ctx.new_page()
    pg.expose_function('__srv', lambda a,f,args: puente.llamar(a,f,args))
    pg.add_init_script("window.__APP='%s';" % app + STUB + "localStorage.setItem('ijm_idioma','es');")
    html = open('/home/claude/ijm/'+archivo).read()
    pg.route('https://app.prueba/**', lambda r: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=html))
    pg.goto('https://app.prueba/'+archivo); return b, pg
with sync_playwright() as pw:
    puente = Puente()
    ta = puente.llamar('du','duLogin',['javier','482915',''])['v']['token']
    puente.llamar('du','duCrearTipo',[ta,{'nombre':'Piso de cemento','partidas':['Preparación de superficie','Desbaste y pulido','Aplicación de sellador'],'pesoTotal':34}])
    obra = puente.llamar('du','duNuevaObra',[ta,{'telefono':'512-555-0100','cliente':'Familia Ortega','direccion':'Austin','pm':'carlos','inicio':'2026-09-20','finEst':'2026-10-02','contrato':9000,
             'areas':[{'tipo':'Piso de cemento','nombre':'Cochera','pies2':420}]}])['v']['id']
    ars = [a for a in json.load(open('/tmp/libro.json'))['Areas'][1:]] if False else None
    det = puente.llamar('du','duDetalleObra',[ta, obra])['v']
    ids = sorted({x['areaId'] for x in det['partidas'] if x['area'] != 'Generales de obra'})
    _pre = puente.llamar('du','duPresupuesto',[ta, obra])['v']
    puente.llamar('du','duGuardarPresupuesto',[ta, obra, [{'area':ar['id'],'etapa':ar['etapas'][0]['etapa'],'monto':1000} for ar in _pre['areas'] if not ar['generales']]])
    # ---------------------------------------------------------------- el PM
    b, pg = navegador_con(pw, puente, 'PM.html', 'pm')
    pg.on('dialog', lambda d: (print('    (confirmación: %s)' % d.message[:70]), d.accept()))
    pg.fill('#lEmail','carlos'); pg.fill('#lPin','2468'); pg.evaluate("entrar()"); pg.wait_for_timeout(600)
    pg.evaluate("S.obra='%s'; S.vo='calidad'; ir('obra')" % obra); pg.wait_for_timeout(200)
    pg.evaluate("var g=obraActual().areas.find(a=>a.generales); abrirInspeccionDe(g.id,0)"); pg.wait_for_timeout(200)
    filas = pg.locator('#vista .opt[data-i]'); n = filas.count()
    ok(n == 9 and pg.locator('#vista .opt .na').count() == 9, 'la inspección final muestra sus 9 preguntas, cada una con su botón "No aplica"')
    baño = re.compile(r'regadera|Plomería|extractor|GFCI|Cajones|gabinetes|registro', re.I)
    for i in range(n):
        t = filas.nth(i).locator('.t').inner_text()
        if baño.search(t): filas.nth(i).locator('.na').click()
        else: filas.nth(i).locator('.t').click()
    na_filas = pg.locator('#vista .opt[data-na="1"]')
    ok(na_filas.count()==7 and na_filas.first.locator('.box').inner_text()=='—', '7 de baño marcadas "No aplica": se ven tachadas, con un guion')
    ok(pg.locator('#vista .opt[data-on="1"]').count()==2, 'las 2 que sí aplican, marcadas como cumple')
    idx = pg.evaluate("[...document.querySelectorAll('#vista .opt[data-i]')].findIndex(e=>e.dataset.na==='1')")
    f = filas.nth(idx)                                  # fijo por posicion: el selector por estado cambia al tocarla
    f.locator('.t').click()
    ok(f.get_attribute('data-na')=='0' and f.get_attribute('data-on')=='1', 'tocar la pregunta quita el "No aplica" y la marca como cumple')
    f.locator('.na').click()
    pg.evaluate("S.fotosIn=[{mime:'image/jpeg',data:'x',prev:'x',tomada:new Date().toISOString()}]")
    pg.click('#bIn'); pg.wait_for_timeout(800)
    ok('Inspección aprobada' in pg.inner_text('#toast'), 'al guardar: "%s"' % pg.inner_text('#toast'))
    pg.evaluate("S.vo='calidad'; ir('obra')"); pg.wait_for_timeout(200)
    ok('7 no aplican' in pg.inner_text('#vista'), 'y en su vista de Calidad: "… · 7 no aplican"')
    pg.evaluate("var g=obraActual().areas.find(a=>a.generales); abrirInspeccionDe(g.id,0)"); pg.wait_for_timeout(150)
    pg.click('header .idioma'); pg.wait_for_timeout(150)
    ok(pg.locator('#vista .opt .na').first.inner_text()=='N/A' and 'tap N/A' in pg.inner_text('#vista'), 'en inglés el botón dice "N/A" y la instrucción lo explica')
    b.close()
    # ---------------------------------------------------------------- el administrador
    b, pg = navegador_con(pw, puente, 'Dueno.html', 'du')
    pg.fill('#lEmail','javier'); pg.fill('#lPin','482915'); pg.evaluate("entrar()"); pg.wait_for_timeout(600)
    pg.evaluate("ir('obras'); detalle('%s')" % obra); pg.wait_for_timeout(400)
    tabla = pg.evaluate("[...document.querySelectorAll('#detObra .card')].find(c=>/Puntos de control/.test(c.innerText)).innerText")
    ok('+7 no aplican' in tabla and 'No aplican:' in tabla and 'regadera' in tabla, 'tu detalle de obra muestra "+7 no aplican" y cuáles fueron')
    b.close()
print('\n' + ('%d FALLAS' % fallas if fallas else 'TODO BIEN'))
