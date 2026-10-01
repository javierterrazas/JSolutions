import os as _os
AQUI = _os.path.dirname(_os.path.abspath(__file__))
import json, importlib.util, sys
spec = importlib.util.spec_from_file_location('idioma_en', '/home/claude/ijm/idioma_en.py')
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
EN = {k.strip(): v for k, v in mod.EN.items()}
BLOQUE = r"""
/* ================================================================ IDIOMA
 * Español / inglés. Las pantallas se escriben en español y se traducen AL DIBUJAR:
 * un observador ve cada cambio y traduce el texto nuevo. Nada se traduce al guardar:
 * los datos siempre quedan en su forma canónica, para que un PM en inglés y otro en
 * español no partan tus reportes en dos categorías distintas.
 */
var IDIOMA = (function(){ try{ return localStorage.getItem('ijm_idioma') || ''; }catch(e){ return ''; } })()
  || (String(navigator.language||'es').toLowerCase().indexOf('es')===0 ? 'es' : 'en');
var EN = __EN__;
var EN_PAT = [__PAT__];
function tr(s){
  if(IDIOMA!=='en' || s==null) return s;
  var txt=String(s), m=/^(\s*)([\s\S]*?)(\s*)$/.exec(txt);
  return m[2] ? m[1]+trCuerpo(m[2])+m[3] : txt;
}
function trCuerpo(c){
  if(EN.hasOwnProperty(c)) return EN[c];
  var pre=/^(· |✓ |\+ )([\s\S]+)$/.exec(c);                    // prefijos: "· ", "✓ ", "+ "
  if(pre){ var r=trCuerpo(pre[2]); if(r!==pre[2]) return pre[1]+r; }
  if(c.indexOf(' · ')>0){                                     // "A · B · C": cada parte por su lado
    var hubo=false, t=c.split(' · ').map(function(p){ var x=trCuerpo(p); if(x!==p) hubo=true; return x; });
    if(hubo) return t.join(' · ');
  }
  var n=/^([\s\S]+?) \((\d+)\)$/.exec(c);                     // "Texto (3)"
  if(n){ var r2=trCuerpo(n[1]); if(r2!==n[1]) return r2+' ('+n[2]+')'; }
  for(var i=0;i<EN_PAT.length;i++) if(EN_PAT[i][0].test(c)) return c.replace(EN_PAT[i][0], EN_PAT[i][1]);
  return c;
}
var _orig = new WeakMap(), _puesto = new WeakMap();
function traducirTexto(nodo){
  var p=nodo.parentNode;
  if(!p || /^(SCRIPT|STYLE|TEXTAREA|PRE)$/.test(p.tagName) || (p.closest && p.closest('[data-sin-traducir]'))) return;
  var v=nodo.nodeValue;
  if(!v || !v.trim() || _puesto.get(nodo)===v) return;       // ya lo puse yo: no se retraduce
  var t=tr(v);
  if(t!==v){ if(!_orig.has(nodo)) _orig.set(nodo, v); _puesto.set(nodo, t); nodo.nodeValue=t; }
}
function traducirAtributos(el){
  if(!el.getAttribute) return;
  // una opcion sin value manda su TEXTO al guardar: se congela antes de traducirlo
  if(el.tagName==='OPTION' && !el.hasAttribute('value')) el.setAttribute('value', el.textContent);
  traducirAtributo(el,'placeholder'); traducirAtributo(el,'title'); traducirAtributo(el,'label');
}
var _attrPuesto = new WeakMap();
function traducirAtributo(el, a){
  var v=el.getAttribute && el.getAttribute(a); if(!v) return;
  var puestos=_attrPuesto.get(el)||{};
  if(puestos[a]===v) return;                                   // lo puse yo: no se retraduce
  var t=tr(v); if(t===v) return;
  var o=_orig.get(el)||{}; o[a]=v; _orig.set(el,o);            // el valor que puso el codigo es el original
  puestos[a]=t; _attrPuesto.set(el,puestos); el.setAttribute(a,t);
}
function traducirArbol(raiz){
  if(IDIOMA!=='en' || !raiz) return;
  if(raiz.nodeType===3){ traducirTexto(raiz); return; }
  if(raiz.nodeType!==1 || /^(SCRIPT|STYLE)$/.test(raiz.tagName)) return;
  traducirAtributos(raiz);
  var w=document.createTreeWalker(raiz, 5, null), n;           // 1 = elementos, 4 = textos
  while((n=w.nextNode())){ if(n.nodeType===3) traducirTexto(n); else traducirAtributos(n); }
}
function restaurarArbol(raiz){                                  // de regreso a español
  var w=document.createTreeWalker(raiz, 5, null), n;
  while((n=w.nextNode())){
    if(n.nodeType===3){ if(_orig.has(n)){ n.nodeValue=_orig.get(n); _orig.delete(n); _puesto.delete(n); } }
    else { var o=_orig.get(n); if(o){ for(var a in o) n.setAttribute(a,o[a]); _orig.delete(n); _attrPuesto.delete(n); } }
  }
}
// si el navegador no tiene observador (muy viejo), la app sigue funcionando en espanol
if(typeof MutationObserver!=='undefined' && document.body && document.body.nodeType===1)
  new MutationObserver(function(ms){
    if(IDIOMA!=='en') return;
    ms.forEach(function(m){
      if(m.type==='characterData') traducirTexto(m.target);
      else if(m.type==='attributes') traducirAtributo(m.target, m.attributeName);
      else for(var i=0;i<m.addedNodes.length;i++) traducirArbol(m.addedNodes[i]);
    });
  }).observe(document.body, { childList:true, subtree:true, characterData:true,
                              attributes:true, attributeFilter:['placeholder','title','label'] });
(function(){                                                    // los dialogos del navegador
  var c=window.confirm, p=window.prompt;
  if(typeof c!=='function' || typeof p!=='function') return;
  window.confirm=function(m){ return c.call(window, tr(m)); };
  window.prompt=function(m,d){ return p.call(window, tr(m), d==null ? d : tr(d)); };
})();
function aplicarIdioma(l){
  var antes=IDIOMA; IDIOMA=(l==='en'?'en':'es');
  try{ localStorage.setItem('ijm_idioma', IDIOMA); }catch(e){}
  if(document.documentElement) document.documentElement.lang=IDIOMA;
  if(!document.createTreeWalker) return;
  if(antes==='en' && IDIOMA==='es') restaurarArbol(document.body);
  if(IDIOMA==='en') traducirArbol(document.body);
  var b=document.querySelectorAll('.idioma');
  for(var i=0;i<b.length;i++) b[i].textContent = IDIOMA==='en' ? 'ES' : 'EN';
}
function cambiarIdioma(){
  aplicarIdioma(IDIOMA==='en' ? 'es' : 'en');
  if(typeof alCambiarIdioma==='function') alCambiarIdioma();
}
if(document.documentElement) document.documentElement.lang=IDIOMA;
/* ============================================================ FIN IDIOMA */
"""
pat = open(_os.path.join(AQUI, 'idioma_en.py')).read()
pat = pat[pat.index('PATRONES_JS = r"""')+len('PATRONES_JS = r"""'):pat.rindex('"""')]
js = BLOQUE.replace('__EN__', json.dumps(EN, ensure_ascii=False, indent=0)).replace('__PAT__', pat)
open(_os.path.join(AQUI, 'idioma_bloque.js'),'w').write(js)
print('entradas exactas:', len(EN), '· reglas:', pat.count('[/^'), '· tamaño:', round(len(js.encode())/1024), 'KB')
