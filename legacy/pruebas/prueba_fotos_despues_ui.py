import sys; sys.path.insert(0,'/tmp'); from navegador import *
fallas=0
def ok(c,m):
    global fallas; print(('  ✓ ' if c else '  ✗ ')+m); fallas += (0 if c else 1)
LOG=[]; FALLAR={'pmSubirFotoCierre':0}
def srv(puente, a, f, args):
    LOG.append(f)
    if FALLAR.get(f): FALLAR[f]-=1; return {'ok':False, 'e':'NetworkError: Connection failure due to HTTP 0'}
    return puente.llamar(a, f, args)
def abrir_app(ctx, puente):
    pg = ctx.new_page()
    html = open('/home/claude/ijm/PM.html').read()
    pg.route('https://app.prueba/**', lambda r: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=html))
    pg.goto('https://app.prueba/PM.html'); pg.on('dialog', lambda d: d.accept())
    pg.wait_for_timeout(300)
    if pg.is_visible('#lEmail'): pg.fill('#lEmail','carlos')       # la segunda vez la app ya recuerda al usuario
    pg.fill('#lPin','2468'); pg.evaluate("entrar()"); pg.wait_for_timeout(700); pg.evaluate("aplicarIdioma('es')")
    return pg
def cerrar(pg, obra):
    pg.evaluate("S.obra='%s'; ir('hoy')" % obra); pg.wait_for_timeout(300)
    if pg.evaluate("document.querySelectorAll('#hPart .opt[data-on=\"1\"]').length") == 0: pg.locator('#hPart .opt').first.click()
    pg.evaluate("S.fotos=[1,2,3].map(function(n){ return {mime:'image/jpeg',data:'AAAA'+n,prev:'x',tomada:new Date().toISOString()}; })")
    del LOG[:]; pg.evaluate("cerrarDia()")
bit = lambda puente, ta, obra: puente.llamar('du','duDetalleObra',[ta,obra])['v']['bitacora'][0]
with sync_playwright() as pw:
    puente = Puente(); ta = puente.llamar('du','duLogin',['javier','482915',''])['v']['token']
    b = pw.chromium.launch(); ctx = b.new_context(viewport={'width':390,'height':844})
    ctx.expose_function('__srv', lambda a,f,args: srv(puente, a, f, args))
    ctx.add_init_script("window.__APP='pm';" + STUB + "localStorage.setItem('ijm_idioma','es');")
    pg = abrir_app(ctx, puente)
    print('  con señal:')
    cerrar(pg, 'OB-001'); pg.wait_for_timeout(2500)
    d = bit(puente, ta, 'OB-001')
    ok(LOG[:1]==['pmHacer'] and LOG.count('pmSubirFotoCierre')==3 and d['fotosPendientes']==0 and len(d['fotos'].split(' | '))==3, 'el cierre primero; luego la cola sube las 3 fotos, una vez cada una: %s' % LOG)
    ok('pmDatos' not in LOG[1:], 'al terminar de subir fotos no se recarga la app: nada visible cambió')
    print('  sin señal para las fotos, y el PM cierra la app en seguida:')
    FALLAR['pmSubirFotoCierre'] = 999; cerrar(pg, 'OB-002'); pg.wait_for_timeout(2000)
    ok(pg.evaluate("S.d.obras.find(function(o){return o.id==='OB-002';}).cerradoHoy") and bit(puente, ta, 'OB-002')['fotosPendientes']==3, 'el día quedó cerrado; tu bitácora dice "subiendo 3 fotos"')
    ok('Subiendo fotos del cierre' in (pg.text_content('#banner') or '') or 'sin enviar' in (pg.text_content('#banner') or ''), 'la barra del PM dice que las fotos están pendientes')
    pg.close()                                                       # el PM cierra la app
    FALLAR['pmSubirFotoCierre'] = 0
    pg = abrir_app(ctx, puente)                                      # la vuelve a abrir, ya con señal
    ok(pg.evaluate("S.cola.filter(function(x){return x.tipo==='foto';}).length")==3, 'al volver a abrirla, las 3 fotos siguen en su cola: no se perdieron')
    pg.evaluate("procesarCola(true)"); pg.wait_for_timeout(2500)
    d = bit(puente, ta, 'OB-002')
    ok(pg.evaluate("S.cola.length")==0 and d['fotosPendientes']==0 and len(d['fotos'].split(' | '))==3, 'y se envían: las 3 completas')
    b.close()
print('\n' + ('%d FALLAS' % fallas if fallas else 'TODO BIEN'))
