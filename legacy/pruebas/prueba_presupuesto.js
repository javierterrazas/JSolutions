const fs=require('fs'), vm=require('vm'); const H=require('/tmp/harness.js');
function servidor(archivo){ const cache={}, pr={};
  const ctx={ PropertiesService:{getScriptProperties(){return {getProperty:k=>(k in pr?pr[k]:null),setProperty(k,v){pr[k]=String(v);}};}},
    SpreadsheetApp, Session, Utilities, LockService, MailApp:{sendEmail(){}}, Logger, HtmlService:{}, DriveApp:{},
    CacheService:{ getScriptCache(){ return { get:k=>cache[k]||null, put:(k,v)=>{cache[k]=v;}, remove:k=>{delete cache[k];} }; } },
    console, JSON, Math, Date, String, Number, Array, Object, RegExp, parseInt, isNaN, Error };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync('/home/claude/ijm/'+archivo,'utf8')+'\nfunction __n(){for(const k in _memo) delete _memo[k];}', ctx);
  ctx.guardarFotos_=()=>'x'; return ctx; }
const A=servidor('App_Dueno.gs'), P=servidor('App_PM.gs');
const ll=(S,f,...a)=>{ S.__n(); return S[f](...a); }, falla=(S,f,...a)=>{ try{ ll(S,f,...a); return ''; }catch(e){ return e.message; } };
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const ta=ll(A,'duLogin','javier','482915').token, tp=ll(P,'pmLogin','carlos','2468').token;
const hoy=new Date().toISOString().slice(0,10);
const o=ll(A,'duNuevaObra',ta,{telefono:'512-555-0100',cliente:'Familia Soto',direccion:'Austin',pm:'carlos',inicio:hoy,finEst:hoy,contrato:30000,
  areas:[{tipo:'Baño',nombre:'Baño',pies2:40},{tipo:'Closet',nombre:'Closet',pies2:25}]});
const est=()=>H.SHEETS['Proyectos'].find(r=>r[0]===o.id)[9];
console.log('\nAl darla de alta');
ok(est()==='Sin presupuesto', 'la obra nace "Sin presupuesto"');
let od=ll(P,'construirDatos_','carlos').obras.find(x=>x.id===o.id);
ok(od && od.puedeArrancar===false, 'el PM la ve, marcada como que todavía no puede arrancar');
const k=od.areas.find(a=>!a.generales).partidas[0].key;
const cierre={obra:o.id,partidas:[k],terminadas:[],cuadrilla:[],subs:[],fotos:[{mime:'x',data:'x'}]};
ok(/todavia no puede arrancar/.test(falla(P,'pmCerrarDia',tp,cierre)), 'su primer día de trabajo se rechaza con el motivo');
ok(!falla(P,'pmCerrarDia',tp,{obra:o.id,sinTrabajo:true,motivo:'Otro',incidencia:'esperando arranque',subs:[]}), 'reportar "hoy no hubo trabajo" sí se puede');
const d0=ll(A,'duDatos',ta);
ok(d0.tablero.find(t=>t.id===o.id).alerta==='Falta presupuesto', 'tu tablero la marca: "Falta presupuesto"');
ok(JSON.stringify(od).indexOf('presupuest')<0 || !/"presupuesto(do)?":\s*\d/.test(JSON.stringify(od)), 'al teléfono del PM no llega ningún monto del presupuesto');

console.log('\nCapturas solo el baño');
const areas=H.SHEETS['Areas'].slice(1).filter(a=>a[1]===o.id);
const baño=areas.find(a=>a[2]==='Baño'), closet=areas.find(a=>a[2]==='Closet');
let r=ll(A,'duGuardarPresupuesto',ta,o.id,[{area:baño[0],partida:'Tile de piso y muro',monto:3600,cantidad:40,unidad:'pie2'}]);
ok(!r.completo && r.faltan.join()==='Closet' && est()==='Sin presupuesto', 'se guarda, pero avisa: falta el closet — y sigue sin poder arrancar');
console.log('\nCompletas el closet');
r=ll(A,'duGuardarPresupuesto',ta,o.id,[{area:baño[0],partida:'Tile de piso y muro',monto:3600,cantidad:40,unidad:'pie2'},
  {area:closet[0],partida:'Instalación de estructura',monto:1200,cantidad:1,unidad:'lote'}]);
ok(r.completo && est()==='Lista para arranque', 'presupuesto completo → "Lista para arranque"');
ok(ll(P,'construirDatos_','carlos').obras.find(x=>x.id===o.id).puedeArrancar===true, 'al PM le aparece el cierre de día');
ok(!falla(P,'pmCerrarDia',tp,cierre) && est()==='En obra', 'su primer día entra y la obra pasa a "En obra"');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
