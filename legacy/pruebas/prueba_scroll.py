import sys; sys.path.insert(0,'/tmp'); from navegador import *
EXTERIOR = """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0">
<div style="height:48px;background:#fff3cd;font:13px sans-serif;padding:8px">Esta aplicación la creó un usuario de Google Apps Script</div>
<iframe id="f" src="https://app.prueba/APP" style="border:0;width:100%;height:100vh;display:block"></iframe>
</body></html>"""
def prueba(archivo, app, usuario, pin):
    with sync_playwright() as pw:
        puente = Puente()
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={'width':390,'height':700}, has_touch=True, is_mobile=True, device_scale_factor=2)
        pg = ctx.new_page()
        pg.expose_function('__srv', lambda a,f,args: puente.llamar(a,f,args))
        html = open('/home/claude/ijm/'+archivo).read()
        ctx.add_init_script("window.__APP='%s';" % app + STUB + "try{localStorage.clear()}catch(e){}")
        pg.route('https://app.prueba/APP', lambda r: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=html))
        pg.route('https://google.prueba/', lambda r: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=EXTERIOR))
        pg.goto('https://google.prueba/'); pg.wait_for_timeout(400)
        fr = pg.frame_locator('#f'); inner = [f for f in pg.frames if 'app.prueba' in f.url][0]
        inner.fill('#lEmail', usuario); inner.fill('#lPin', pin); inner.evaluate("entrar()"); pg.wait_for_timeout(600)
        if app=='pm': inner.evaluate("S.v='obra'; S.vo='secuencia'; render()")
        else: inner.evaluate("ir('obras')")
        pg.wait_for_timeout(300)
        alto = inner.evaluate("document.documentElement.scrollHeight - innerHeight")
        cdp = ctx.new_cdp_session(pg)
        def desliza(dy):   # dedo real: dy negativo = hacia arriba (baja el contenido)
            cdp.send('Input.synthesizeScrollGesture', {'x':195,'y':420,'yDistance':dy,'speed':1600,'gestureSourceType':'mouse','repeatCount':1})
            pg.wait_for_timeout(700)
        for _ in range(8): desliza(-600)                        # hasta abajo, y un poco más
        abajo = inner.evaluate("scrollY"); exterior_bajo = pg.evaluate("scrollY")
        desliza(350)                                            # UN gesto hacia arriba
        regreso = abajo - inner.evaluate("scrollY")
        b.close()
        return alto, abajo, exterior_bajo, regreso
for archivo, app, u, pin in [('PM.html','pm','carlos','2468'), ('Dueno.html','du','javier','482915')]:
    alto, abajo, ext, reg = prueba(archivo, app, u, pin)
    print('%-11s contenido %4d px · al fondo: la app en %4d, la PÁGINA DE AFUERA se movió %3d px · un gesto hacia arriba regresa %4d px'
          % (archivo, alto, abajo, ext, reg))
