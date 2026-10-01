process.env.TZ='America/Chicago';
const fs=require('fs'), vm=require('vm');
const RealDate=Date; let AHORA=new RealDate('2026-10-07T10:00:00').getTime();
class FD extends RealDate{ constructor(...a){ if(!a.length) super(AHORA); else super(...a); } static now(){ return AHORA; } }
global.Date=FD;
const H=require('/tmp/harness.js');
function servidor(archivo){ const cache={}, pr={};
  const ctx={ PropertiesService:{getScriptProperties(){return {getProperty:k=>(k in pr?pr[k]:null),setProperty(k,v){pr[k]=String(v);}};}},
    SpreadsheetApp, Session, Utilities, LockService, MailApp:{sendEmail(){}}, Logger, HtmlService:{}, DriveApp:{},
    CacheService:{ getScriptCache(){ return { get:k=>(k in cache?cache[k]:null), put:(k,v)=>{cache[k]=v;}, remove:k=>{delete cache[k];},
      getAll:ks=>{ const o={}; ks.forEach(k=>{ if(k in cache) o[k]=cache[k]; }); return o; }, putAll:o=>{ Object.assign(cache,o); } }; } },
    console, JSON, Math, Date:FD, String, Number, Array, Object, RegExp, parseInt, isNaN, Error };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync('/home/claude/ijm/'+archivo,'utf8')+'\nfunction __n(){for(const k in _memo) delete _memo[k];}\nfunction __borrar(k){ delete _memo[k]; }', ctx);
  ctx.guardarFotos_=()=>'x'; return ctx; }
const A=servidor('App_Dueno.gs'), P=servidor('App_PM.gs');
const ll=(S,f,...a)=>{ S.__n(); return S[f](...a); }, falla=(S,f,...a)=>{ try{ ll(S,f,...a); return ''; }catch(e){ return e.message; } };
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const ta=ll(A,'duLogin','javier','482915').token, tp=ll(P,'pmLogin','carlos','2468').token;
let calculos=0; const orig=A.calcularDatos_; A.calcularDatos_=function(){ calculos++; return orig.apply(this, arguments); };
console.log('\nTu Inicio en memoria');
const d1=ll(A,'duDatos',ta), d2=ll(A,'duDatos',ta);
ok(calculos===1 && JSON.stringify(d1)===JSON.stringify(d2), 'volver a Inicio sin cambios: sale de memoria, idéntico (1 cálculo para 2 cargas)');
ll(A,'duGasto',ta,{obra:'OB-001',monto:420,categoria:'Material',proveedor:'Ferguson',metodo:'Tarjeta',descripcion:'Llaves de regadera'});
const d3=ll(A,'duDatos',ta);
ok(calculos===2 && d3.sello!==d1.sello, 'después de guardar algo, se recalcula: nunca se sirve un Inicio viejo');
AHORA+=3600*1000; ll(A,'duDatos',ta);
ok(calculos===3, 'al cambiar la hora también: los indicadores que dependen del reloj se refrescan');
console.log('\nGuardar y ver en un solo viaje');
ok(/no se puede hacer así/.test(falla(A,'duHacer',ta,'duDatos',[])), 'una función que no está en la lista se rechaza');
ok(/no se puede hacer así/.test(falla(A,'duHacer',ta,'duLogin',['javier','482915'])), 'tampoco se puede usar para entrar como otro');
const x=ll(A,'duHacer',ta,'duGasto',[{obra:'OB-001',monto:77,categoria:'Material',proveedor:'Lowes',metodo:'Tarjeta',descripcion:'Silicón'}],'OB-001',false);
ok(x.r && x.r.ok && x.det && x.det.id==='OB-001' && JSON.stringify(x.det).indexOf('Lowes')>=0, 'guarda y regresa la obra ya con la compra, en el mismo viaje');
ok(/Faltan: proveedor/.test(falla(A,'duHacer',ta,'duGasto',[{obra:'OB-001',monto:10,descripcion:'x'}],'OB-001')), 'las validaciones de siempre aplican igual ("Faltan: proveedor")');
const y=ll(A,'duHacer',ta,'duRevisarGasto',[x.r.id],null,true);
ok(y.d && y.d.sello && !y.det, 'desde una lista, regresa tu Inicio actualizado');
const od=ll(P,'pmDatos',tp).obras.find(o=>o.id==='OB-001'), kk=od.areas.find(a=>!a.generales).partidas[0].key;
const z=ll(P,'pmHacer',tp,'pmCerrarDia',[{obra:'OB-001',capturado:new Date().toISOString(),partidas:[kk],terminadas:[],cuadrilla:[],subs:[],fotos:[{mime:'x',data:'x'}]}]);
ok(z.r && z.r.ok && z.datos && z.datos.obras.find(o=>o.id==='OB-001').cerradoHoy===true, 'en la app del PM: cierra el día y regresa la app ya con el día cerrado, en el mismo viaje');
ok(/no se puede hacer así/.test(falla(P,'pmHacer',tp,'pmDatos',[])) && /no se puede hacer así/.test(falla(P,'pmHacer',tp,'pmGasto',[{}])), 'y con su propia lista cerrada (el gasto no está: ya guardaba en un solo viaje)');
console.log('\nEl cronograma, una sola vez por carga');
A.__n(); const c1=A.cronogramaObra_('OB-001'), c2=A.cronogramaObra_('OB-001');
ok(c1===c2, 'dos veces en la misma carga: se calcula una sola vez');
A.__n(); const c3=A.cronogramaObra_('OB-001');
ok(JSON.stringify(c1)===JSON.stringify(c3), 'y da exactamente lo mismo que calculado de cero');
const av=H.SHEETS['Avance'], baño=H.SHEETS['Areas'].find(a=>a[1]==='OB-001' && a[2]==='Baño')[0];
const fila=['AV-9999', new Date('2026-10-06T16:00:00'), 'OB-001', 'Demolición y retiro de escombro', 'Terminada', 'carlos', new Date(), 'Vigente', baño];
A.__n(); A.cronogramaObra_('OB-001'); av.push(fila); A.__borrar('Avance');
const c4=A.cronogramaObra_('OB-001');
ok(c4!==c1 && JSON.stringify(c4)!==JSON.stringify(c3), 'si el avance se vuelve a leer después de escribir, se recalcula: la memoria no sirve datos viejos');
av.pop();
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
