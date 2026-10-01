const fs=require('fs'), vm=require('vm'); const H=require('/tmp/harness.js');
function servidor(archivo){ const cache={}, pr={};
  const ctx={ PropertiesService:{getScriptProperties(){return {getProperty:k=>(k in pr?pr[k]:null),setProperty(k,v){pr[k]=String(v);}};}},
    SpreadsheetApp, Session, Utilities, LockService, MailApp:{sendEmail(){}}, Logger, HtmlService:{}, DriveApp:{},
    CacheService:{ getScriptCache(){ return { get:k=>cache[k]||null, put:(k,v)=>{cache[k]=v;}, remove:k=>{delete cache[k];} }; } },
    console, JSON, Math, Date, String, Number, Array, Object, RegExp, parseInt, isNaN, Error };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync('/home/claude/ijm/'+archivo,'utf8')+'\nfunction __n(){for(const k in _memo) delete _memo[k];}', ctx); return ctx; }
const A=servidor('App_Dueno.gs'), P=servidor('App_PM.gs');
const ll=(S,f,...a)=>{ S.__n(); return S[f](...a); };
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const C=H.SHEETS['Checklist_Calidad'], fotos=()=>C.slice(1).filter(r=>r[3]==='SI').length;
ok(fotos()===9, 'la plantilla ya viene con foto en 9 de '+(C.length-1)+' puntos');
C.slice(1).forEach(r=>{ r[3]='SI'; });                                             // un libro instalado antes, con todas pidiendo foto
C.push(['PC2 Pre-cierre de muros', 9, 'Mi punto: foto del medidor de agua', 'SI']);     // y un punto que agregaste tú
const ta=ll(A,'duLogin','javier','482915').token;
const r=ll(A,'duFotosCriticas',ta);
ok(r.criticos===9 && C.slice(1).filter(x=>x[3]==='SI').length===10, 'el botón deja foto en los 9 críticos de la plantilla ('+r.cambiados+' cambiados)');
ok(C[C.length-1][3]==='SI', 'y respeta el punto que agregaste tú: sigue pidiendo foto');
ok(ll(A,'duFotosCriticas',ta).cambiados===0, 'volver a tocarlo no cambia nada');
C.pop();
const tp=ll(P,'pmLogin','carlos','2468').token, ck=ll(P,'pmDatos',tp).checklist;            // la lista va en la carga general del PM
const porHito={}; Object.keys(ck).forEach(k=>{ porHito[k]=ck[k].filter(p=>p.foto).length; });
const maximo=Math.max.apply(null, Object.values(porHito).concat([0]));
ok(Object.keys(porHito).length>0 && maximo<=2, 'en la app del PM, cada inspección pide como máximo 2 fotos: '+JSON.stringify(porHito));
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
