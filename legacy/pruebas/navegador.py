import json, subprocess, re
from playwright.sync_api import sync_playwright
class Puente:
    def __init__(s): s.p = subprocess.Popen(['node','/tmp/rpc_servidor.js'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    def llamar(s, app, fn, args):
        s.p.stdin.write(json.dumps({'app':app,'fn':fn,'args':args})+'\n'); s.p.stdin.flush()
        return json.loads(s.p.stdout.readline())
STUB = """
window.google = { script: { get run(){ var ok=function(){}, ko=function(){};
  var r = new Proxy({}, { get: function(_, f){
    if (f==='withSuccessHandler') return function(g){ ok=g; return r; };
    if (f==='withFailureHandler') return function(g){ ko=g; return r; };
    return function(){ var a=[].slice.call(arguments);
      window.__srv(window.__APP, f, a).then(function(x){ if(x.ok) ok(x.v); else ko(new Error(x.e)); }); };
  }}); return r; } } };
"""
def abrir(pw, archivo, app, idioma=None):
    puente = Puente()
    b = pw.chromium.launch(); ctx = b.new_context(viewport={'width':390,'height':844})
    pg = ctx.new_page()
    pg.expose_function('__srv', lambda a, f, args: puente.llamar(a, f, args))
    pg.add_init_script("window.__APP='%s';" % app + STUB + ("localStorage.setItem('ijm_idioma','%s');" % idioma if idioma else "localStorage.clear();"))
    html = open('/home/claude/ijm/'+archivo).read()
    # se sirve desde una direccion propia: asi corren los scripts de arranque y hay localStorage
    pg.route('https://app.prueba/**', lambda ruta: ruta.fulfill(status=200, content_type='text/html; charset=utf-8', body=html))
    pg.goto('https://app.prueba/'+archivo, wait_until='load')
    return b, pg
TEXTOS = """() => { var out=[], w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  var n; while((n=w.nextNode())){ var p=n.parentNode, st=getComputedStyle(p);
    if(/^(SCRIPT|STYLE)$/.test(p.tagName) || st.display==='none' || p.closest('.hide')) continue;
    var t=n.nodeValue.trim(); if(t) out.push(t); }
  document.querySelectorAll('[placeholder]').forEach(function(e){ if(!e.closest('.hide')) out.push(e.getAttribute('placeholder')); });
  return out; }"""
