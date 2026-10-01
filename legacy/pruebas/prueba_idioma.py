import json, re, sys
sys.path.insert(0,'/tmp'); from navegador import *
datos=set()
for hoja,filas in json.load(open('/tmp/libro.json')).items():
    if hoja in ('Partidas_Catalogo','Checklist_Calidad','Config','Instrucciones'): continue
    for r in filas[1:]:
        for v in r:
            if isinstance(v,str) and v.strip(): datos.add(v.strip())
ES = re.compile(r"[áéíóúñ¿¡]|\b(de|la|el|los|las|del|que|para|con|sin|por|una|hay|obra|obras|partida|partidas|días?|hoy|avance|gasto|aviso|cerrar|registrar|faltan?|está|esta|sus?|tus?|ya|más|todo|nada|cada|sobre|aquí|así|cobro|pago|saldo|fecha|orden|órdenes|cuadrilla|presupuesto|entrega|calidad|punto|puntos)\b", re.I)
def sobrantes(textos):
    malos=set()
    for t in textos:
        for seg in re.split(r'\s·\s|\s\|\s', t):
            seg=seg.strip(' ·')
            if not seg or seg in datos or any(seg in d or d in seg for d in datos if len(d)>6 and (seg in d or d in seg)): continue
            if ES.search(seg): malos.add(seg)
    return malos
def espera(pg): pg.wait_for_timeout(60)
todos={}
with sync_playwright() as pw:
    # ------------------------------------------------------------- PM (luis: ingles guardado)
    b, pg = abrir(pw, 'PM.html', 'pm')
    pg.fill('#lEmail','luis'); pg.fill('#lPin','1357'); pg.evaluate("entrar()"); pg.wait_for_timeout(400)
    print('PM · idioma al entrar:', pg.evaluate("IDIOMA"), '· menú:', pg.inner_text('#nav').replace('\n',' | '))
    for obra in pg.evaluate("S.d.obras.map(o=>o.id)"):
        pg.evaluate("S.obra='%s'" % obra)
        for v in ['hoy','gasto','aviso']:
            pg.evaluate("ir('%s')" % v); espera(pg); todos['PM '+v]=sobrantes(pg.evaluate(TEXTOS))
        for vo in ['resumen','secuencia','calidad','fotos','entrega']:
            pg.evaluate("S.vo='%s'; S.album=[]; S.albumDe=S.obra; ir('obra')" % vo); espera(pg); todos['PM obra/'+vo]=sobrantes(pg.evaluate(TEXTOS))
        pg.evaluate("var a=obraActual().areas.find(x=>x.controles.length); if(a) abrirInspeccionDe(a.id,0)"); espera(pg)
        todos['PM inspección']=sobrantes(pg.evaluate(TEXTOS))
        pg.evaluate("salirInspeccion(); S.v='gasto'; render(); verCorregibles()"); pg.wait_for_timeout(250)
        todos['PM correcciones']=sobrantes(pg.evaluate(TEXTOS))
    # la categoria se muestra traducida pero se guarda en su forma canonica
    pg.evaluate("ir('gasto')"); espera(pg)
    opc = pg.evaluate("[...document.querySelectorAll('#gCat option')].map(o=>[o.textContent,o.value])")
    print('PM · categorías (se ve → se guarda):', opc[:3])
    pg.click('header .idioma'); espera(pg)
    print('PM · tras el botón → idioma:', pg.evaluate("IDIOMA"), '· menú:', pg.inner_text('#nav').replace('\n',' | '))
    pg.click('header .idioma'); espera(pg)
    print('PM · de vuelta     → idioma:', pg.evaluate("IDIOMA"), '· menú:', pg.inner_text('#nav').replace('\n',' | '))
    b.close()
    # ------------------------------------------------------------- administrador (cambia con el boton)
    b, pg = abrir(pw, 'Dueno.html', 'du')
    pg.fill('#lEmail','javier'); pg.fill('#lPin','482915'); pg.evaluate("entrar()"); pg.wait_for_timeout(500)
    pg.click('header .idioma'); espera(pg)
    print('Admin · idioma:', pg.evaluate("IDIOMA"), '· pestañas:', pg.inner_text('#tabs').replace('\n',' | '))
    for v in ['inicio','obras','avisos','cambios','subs','catalogo']:
        pg.evaluate("S.todos=true; S.verTarjeta=true; ir('%s')" % v); espera(pg); todos['Admin '+v]=sobrantes(pg.evaluate(TEXTOS))
    for o in ['OB-001','OB-002','OB-003','OB-004']:
        pg.evaluate("ir('obras'); detalle('%s')" % o); pg.wait_for_timeout(250); todos['Admin detalle '+o]=sobrantes(pg.evaluate(TEXTOS))
        for f in ["formPresupuesto('%s')","formCobro('%s')","preCierre('%s')","formGarantia('%s')"]:
            try: pg.evaluate(f % o)
            except Exception: continue
            pg.wait_for_timeout(200); todos['Admin '+f.split('(')[0]+' '+o]=sobrantes(pg.evaluate(TEXTOS))
    for f in ["ir('cambios');formOC('OB-001')","formNC()","ir('subs');formOT()","formPago('OT-0002')","ir('catalogo');editarTrab(0)",
              "editarPartida(0)","editarPunto(0,1)","editarSub(0)","verCorrecciones()","ir('historico')"]:
        try: pg.evaluate(f)
        except Exception as e: print('   (no aplica', f, ')'); continue
        pg.wait_for_timeout(300); todos['Admin '+f]=sobrantes(pg.evaluate(TEXTOS))
    b.close()
res={}
for k,v in todos.items():
    for s in v: res.setdefault(s,k)
print('\nTEXTOS EN ESPAÑOL QUE QUEDARON:', len(res))
for s,k in sorted(res.items(), key=lambda x:x[1]): print('  ['+k+']', s[:110])
json.dump(res, open('/tmp/sobrantes.json','w'), ensure_ascii=False)
