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
const n0=H.SHEETS['Proyectos'].length;
const obra={cliente:'Familia Ortiz',telefono:'(512) 555-0142',direccion:'1400 Oak St, Austin',pm:'carlos',inicio:'2026-10-05',finEst:'2026-10-30',contrato:28000,
  areas:[{tipo:'Baño',nombre:'',pies2:45}]};
console.log('\nAlta de obra');
let m=falla(A,'duNuevaObra',ta,{areas:[{tipo:'Baño',pies2:40}]});
ok(m==='Faltan: cliente, teléfono del cliente, dirección, PM, fecha de inicio, fecha de entrega, monto del contrato.', 'vacía: un solo mensaje con todo lo que falta');
ok(H.SHEETS['Proyectos'].length===n0, 'y no se guardó nada');
ok(/10 dígitos/.test(falla(A,'duNuevaObra',ta,Object.assign({},obra,{telefono:'555-0142'}))), 'teléfono incompleto: rechazado');
ok(/no existe o no está activo/.test(falla(A,'duNuevaObra',ta,Object.assign({},obra,{pm:'javier'}))), 'el PM tiene que ser un PM activo (no el administrador)');
ok(/antes del inicio/.test(falla(A,'duNuevaObra',ta,Object.assign({},obra,{finEst:'2026-10-01'}))), 'entrega antes del inicio: rechazada');
ok(/monto del contrato/.test(falla(A,'duNuevaObra',ta,Object.assign({},obra,{contrato:0}))), 'contrato en cero: rechazado');
ok(falla(A,'duNuevaObra',ta,Object.assign({},obra,{areas:[{tipo:'Baño',nombre:'Baño principal'}]}))==='Faltan: pies² de Baño principal.', 'espacio sin pies cuadrados: rechazado, con su nombre');
const r=ll(A,'duNuevaObra',ta,obra);
ok(r.ok && H.SHEETS['Areas'].slice(1).some(a=>a[1]===r.id && a[3]==='Baño'), 'completa: se crea, y el espacio sin nombre toma el de su tipo');
const d2=ll(A,'duNuevaObra',ta,Object.assign({},obra,{cliente:'familia  ortiz'}));
ok(d2.confirmar && d2.codigo==='duplicada', 'el mismo cliente en la misma dirección (doble clic): pide confirmar');
ok(ll(A,'duNuevaObra',ta,Object.assign({},obra,{confirmado:['duplicada']})).ok, 'confirmado: sí la crea');
console.log('\nLos demás formularios');
ok(falla(A,'duCrearOT',ta,{obra:r.id,partida:'x',precio:500})==='Faltan: subcontratista, alcance, fecha de inicio, fecha de fin.', 'orden de trabajo sin sub, alcance ni fechas');
ok(falla(A,'duCrearOC',ta,{obra:r.id,precio:900})==='Faltan: motivo, descripción, fecha del hallazgo, costo.', 'orden de cambio sin motivo, descripción, hallazgo ni costo');
ok(falla(A,'duCobro',ta,{obra:r.id,monto:5000})==='Faltan: concepto, método de pago.', 'cobro sin concepto ni método');
ok(falla(A,'duGasto',ta,{obra:r.id,monto:900})==='Faltan: proveedor, qué se compró.', 'compra de la oficina sin proveedor ni descripción');
ok(falla(A,'duGarantia',ta,{obra:r.id})==='Faltan: descripción del reclamo.', 'garantía sin descripción (antes no validaba nada)');
ok(falla(A,'duNoCalidad',ta,{obra:r.id})==='Faltan: descripción, costo.', 'no calidad sin descripción ni costo (antes no validaba nada)');
ok(falla(A,'duGuardarSub',ta,{nombre:'Tile Pro',oficio:'Tile'})==='Faltan: teléfono.', 'sub sin teléfono');
ok(falla(A,'duGuardarTrabajador',ta,{nombre:'Luis Mora',tipoPago:'Por hora',tarifa:0})==='Faltan: tarifa.', 'trabajador con tarifa en cero');
ok(falla(P,'pmGasto',tp,{obra:'OB-001',monto:80,categoria:'Material'})==='Faltan: proveedor.', 'gasto del PM sin proveedor');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
