import sys; sys.path.insert(0,'/tmp'); from navegador import *
fallas=0
def ok(c,m):
    global fallas; print(('  ✓ ' if c else '  ✗ ')+m); fallas += (0 if c else 1)
with sync_playwright() as pw:
    b, pg = abrir(pw, 'PM.html', 'pm', idioma='es')
    pg.fill('#lEmail','luis'); pg.fill('#lPin','1357'); pg.evaluate("entrar()"); pg.wait_for_timeout(600)
    pg.evaluate("aplicarIdioma('es'); S.obra='OB-003'; ir('hoy')"); pg.wait_for_timeout(250)  # Luis tiene el inglés guardado
    angel = pg.locator('#hCuad .opt', has_text='Angel')
    ruben = pg.locator('#hCuad .opt', has_text='Ruben')
    ok(angel.locator('.dias button').count()==2 and angel.locator('.hrs').count()==0, 'Angel (por día): dos botones, sin casilla de horas')
    ok(ruben.locator('.hrs').count()==1 and ruben.locator('.u').inner_text()=='h', 'Ruben (por hora): casilla con su "h" al lado')
    angel.locator('button', has_text='Medio día').click(); pg.wait_for_timeout(80)
    ok(angel.get_attribute('data-on')=='1' and angel.locator('.dias').get_attribute('data-dias')=='0.5', 'tocar "Medio día" lo marca presente y guarda 0.5')
    envio = pg.evaluate("""(function(){ var o=obraActual(), part=[...document.querySelectorAll('#hPart .opt[data-on="1"]')].map(e=>e.dataset.p);
      return [...document.querySelectorAll('#hCuad .opt[data-on="1"]')].map(function(e){ return {t:e.dataset.t,
        horas:(e.querySelector('.hrs') ? e.querySelector('.hrs').value : e.querySelector('.dias').dataset.dias)}; }); })()""")
    ok(envio == [{'t':'TRB-04','horas':'0.5'}], 'lo que se envía al cerrar: %s' % envio)
    pg.click('header .idioma'); pg.wait_for_timeout(120)
    ok(angel.locator('button').first.inner_text()=='Full day' and 'daily rate' in angel.inner_text(), 'en inglés: "Full day / Half day" y "daily rate"')
    b.close()
print('\n' + ('%d FALLAS' % fallas if fallas else 'TODO BIEN'))
