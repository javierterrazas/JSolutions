const fs=require('fs'), vm=require('vm'); const H=require('/tmp/harness.js');
let subidas=0;
function servidor(archivo){ const cache={}, pr={};
  const ctx={ PropertiesService:{getScriptProperties(){return {getProperty:k=>(k in pr?pr[k]:null),setProperty(k,v){pr[k]=String(v);}};}},
    SpreadsheetApp, Session, Utilities, LockService, MailApp:{sendEmail(){}}, Logger, HtmlService:{}, DriveApp:{},
    CacheService:{ getScriptCache(){ return { get:k=>cache[k]||null, put:(k,v)=>{cache[k]=v;}, remove:k=>{delete cache[k];} }; } },
    console, JSON, Math, Date, String, Number, Array, Object, RegExp, parseInt, isNaN, Error };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync('/home/claude/ijm/'+archivo,'utf8')+'\nfunction __n(){for(const k in _memo) delete _memo[k];}', ctx);
  ctx.guardarFotos_=(f, et)=>{ if(!f||!f.length) return ''; subidas+=f.length; return f.map((x,i)=>'https://drive/'+et+(f.length>1?'_'+(i+1):'')).join(' | '); }; return ctx; }
const A=servidor('App_Dueno.gs'), P=servidor('App_PM.gs');
const ll=(S,f,...a)=>{ S.__n(); return S[f](...a); }, falla=(S,f,...a)=>{ try{ ll(S,f,...a); return ''; }catch(e){ return e.message; } };
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const tc=ll(P,'pmLogin','carlos','2468').token, tl=ll(P,'pmLogin','luis','1357').token, ta=ll(A,'duLogin','javier','482915').token;
const od=ll(P,'pmDatos',tc).obras.find(o=>o.id==='OB-001'), k=od.areas.find(a=>!a.generales).partidas[0].key;
const bit=id=>H.SHEETS['Bitacora'].find(r=>r[0]===id), foto=n=>({mime:'image/jpeg',data:'AAAA'+n,tomada:''});
console.log('\nEl cierre, sin esperar a las fotos');
ok(/requiere al menos una foto/.test(falla(P,'pmCerrarDia',tc,{obra:'OB-001',partidas:[k],terminadas:[],cuadrilla:[],subs:[],fotos:[]})), 'sin fotos ni fotos comprometidas: se rechaza, como siempre');
subidas=0;
const r=ll(P,'pmCerrarDia',tc,{obra:'OB-001',partidas:[k],terminadas:[],cuadrilla:[],subs:[],fotos:[],fotosPorSubir:3});
ok(r.ok && subidas===0 && bit(r.id)[7]==='' && bit(r.id)[11]==='1,2,3', 'con 3 fotos comprometidas: el cierre entra al momento, sin subir ninguna todavía');
const d1=ll(A,'duDetalleObra',ta,'OB-001').bitacora[0];          // el mas reciente va primero
ok(d1 && d1.fotosPendientes===3, 'tu bitácora lo muestra: "subiendo 3 fotos"');
console.log('\nLas fotos, después, una por una');
let x=ll(P,'pmSubirFotoCierre',tc,r.id,foto(2),2);
ok(x.ok && x.quedan===2 && bit(r.id)[11]==='1,3' && /_2$/.test(bit(r.id)[7]), 'llega la 2: queda en su lugar, faltan la 1 y la 3');
x=ll(P,'pmSubirFotoCierre',tc,r.id,foto(2),2);
ok(x.repetida && bit(r.id)[7].split(' | ').length===1, 'se reintenta la 2 (la señal falló después de guardarla): no se duplica');
ok(/No tienes acceso|obra|asignad/i.test(falla(P,'pmSubirFotoCierre',tl,r.id,foto(9),1)), 'otro PM no puede subir fotos a un cierre que no es de su obra');
ll(P,'pmSubirFotoCierre',tc,r.id,foto(1),1); x=ll(P,'pmSubirFotoCierre',tc,r.id,foto(3),3);
ok(x.quedan===0 && bit(r.id)[11]==='' && bit(r.id)[7].split(' | ').length===3, 'llegan la 1 y la 3: completas, 3 enlaces y nada pendiente');
ok(ll(A,'duDetalleObra',ta,'OB-001').bitacora[0].fotosPendientes===0, 'y en tu bitácora ya no dice "subiendo"');
console.log('\nSin señal al cerrar: todo junto, como antes');
subidas=0;
const od2=ll(P,'pmDatos',tc).obras.find(o=>o.id==='OB-002'), k2=od2.areas.find(a=>!a.generales).partidas[0].key;
const r2=ll(P,'pmCerrarDia',tc,{obra:'OB-002',partidas:[k2],terminadas:[],cuadrilla:[],subs:[],fotos:[foto(1),foto(2)]});
ok(r2.ok && subidas===2 && bit(r2.id)[7].split(' | ').length===2 && !bit(r2.id)[11], 'el cierre de la cola trae sus fotos: se guardan juntas y no queda nada pendiente');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
