import sys, datetime; sys.path.insert(0,'/tmp'); from navegador import *
fallas=0
def ok(c,m):
    global fallas; print(('  ✓ ' if c else '  ✗ ')+m); fallas += (0 if c else 1)
def habil_atras(n):
    d = datetime.date.today(); k = 0
    while k < n:
        d -= datetime.timedelta(days=1)
        if d.weekday() < 5: k += 1
    return d
def nav(pw, puente, archivo, app):            # el navegador, conectado al MISMO servidor donde se preparo la obra
    b = pw.chromium.launch(); ctx = b.new_context(viewport={'width':390,'height':844}); pg = ctx.new_page()
    pg.expose_function('__srv', lambda a,f,args: puente.llamar(a,f,args))
    pg.add_init_script("window.__APP='%s';" % app + STUB + "localStorage.setItem('ijm_idioma','es');")
    html = open('/home/claude/ijm/'+archivo).read()
    pg.route('https://app.prueba/**', lambda r: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=html))
    pg.goto('https://app.prueba/'+archivo); return b, pg
with sync_playwright() as pw:
    puente = Puente()
    ta = puente.llamar('du','duLogin',['javier','482915',''])['v']['token']
    inicio = habil_atras(4).isoformat()
    obra = puente.llamar('du','duNuevaObra',[ta,{'telefono':'512-555-0100','cliente':'Familia Garza','direccion':'Austin','pm':'carlos','inicio':inicio,'finEst':datetime.date.today().isoformat(),'contrato':24000,'areas':[{'tipo':'Baño','nombre':'Baño','pies2':45}]}])['v']['id']
    det = puente.llamar('du','duDetalleObra',[ta, obra])['v']; area = [x['areaId'] for x in det['partidas'] if x['area']=='Baño'][0]
    _pre = puente.llamar('du','duPresupuesto',[ta, obra])['v']
    puente.llamar('du','duGuardarPresupuesto',[ta, obra, [{'area':ar['id'],'etapa':ar['etapas'][0]['etapa'],'monto':1000} for ar in _pre['areas'] if not ar['generales']]])
    tp = puente.llamar('pm','pmLogin',['carlos','2468',''])['v']['token']
    anteayer = habil_atras(2)
    r = puente.llamar('pm','pmCerrarDia',[tp,{'obra':obra,'capturado':anteayer.isoformat()+'T21:00:00.000Z','partidas':[area+'|Demolición y retiro de escombro'],'terminadas':[],'cuadrilla':[],'subs':[],'fotos':[{'mime':'x','data':'x'}]}])
    b, pg = nav(pw, puente, 'PM.html', 'pm')
    pg.on('dialog', lambda d: (DIALOGOS.append(d.message), d.accept()))
    DIALOGOS = []
    pg.fill('#lEmail','carlos'); pg.fill('#lPin','2468'); pg.evaluate("entrar()"); pg.wait_for_timeout(700)
    pg.evaluate("aplicarIdioma('es'); S.obra='%s'; ir('hoy')" % obra); pg.wait_for_timeout(300)
    ok('TE FALTÓ CERRAR' in pg.text_content('#vista').upper(), 'al abrir la app: "Te faltó cerrar" con el día de ayer')
    pg.locator('#vista .tl', has_text=obra).locator('text=Cerrarlo ahora').click(); pg.wait_for_timeout(250)   # el de ESTA obra
    ok(pg.evaluate("S.tardio.obra")==obra, 'toca el pendiente de su obra (el aviso junta los de todas sus obras)')
    t = pg.text_content('#vista')
    ok('Cierre del' in t and pg.locator('#bDia').count()==1, 'entra al modo de cierre tardío: "Cierre del …" con el formulario de siempre')
    if pg.evaluate("document.querySelectorAll('#hPart .opt[data-on=\"1\"]').length") == 0:   # la sugerida ya viene marcada
        pg.locator('#hPart .opt').first.click(); pg.wait_for_timeout(80)
    pg.evaluate("S.fotos=[{mime:'image/jpeg',data:'x',prev:'x',tomada:new Date().toISOString()}]")   # foto de HOY
    pg.evaluate("cerrarDia()"); pg.wait_for_timeout(900)
    ok(not any('otro día' in m for m in DIALOGOS), 'con una foto de hoy no sale ninguna advertencia de fecha')
    od = [x for x in puente.llamar('pm','pmDatos',[tp])['v']['obras'] if x['id']==obra][0]
    ok(len(od['diasSinCierre'])==0 and not pg.evaluate("!!S.tardio"), 'el día quedó cerrado y la app regresa a la normalidad')
    b.close()
print('\n' + ('%d FALLAS' % fallas if fallas else 'TODO BIEN'))
