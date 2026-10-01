const fs=require('fs'), vm=require('vm'); const H=require('/tmp/harness.js');
const SHEETS=H.SHEETS, prot={};
const base=SpreadsheetApp.openById().getSheetByName;
function ext(n){ if(!SHEETS[n]) return null; const s=base(n);
  s.getName=()=>n; s.getLastColumn=()=>(SHEETS[n][0]||[]).length; s.deleteRows=(a,k)=>SHEETS[n].splice(a-1,k);
  const nueva=(tipo)=>{ const p={d:'',w:false,tipo, setDescription(x){p.d=x;}, setWarningOnly(x){p.w=x;}, getDescription(){return p.d;}, remove(){ prot[n]=prot[n].filter(q=>q!==p); }};
    (prot[n]=prot[n]||[]).push(p); return p; };
  s.protect=()=>nueva('SHEET'); const gr=s.getRange; s.getRange=function(){ const r=gr.apply(s,arguments); r.protect=()=>nueva('RANGE'); return r; };
  s.getProtections=t=>(prot[n]||[]).filter(p=>p.tipo===t); return s; }
global.SpreadsheetApp={ ProtectionType:{SHEET:'SHEET',RANGE:'RANGE'}, flush(){},
  openById(){ return { getSheetByName:ext, getId:()=>'LIBRO', getSheets:()=>Object.keys(SHEETS).map(ext),
    insertSheet:n=>{ SHEETS[n]=[[]]; return ext(n); } }; } };
let reloj=0; const carpetas=[], triggers=[];
const DriveApp={ getFileById:()=>({ makeCopy(nombre, c){ const f={nombre,t:++reloj,papelera:false, getName:()=>nombre, getDateCreated:()=>new Date(2026,0,1,0,0,f.t), setTrashed(x){f.papelera=x;}}; c.archivos.push(f); } }),
  getFoldersByName:n=>{ const l=carpetas.filter(c=>c.n===n); let i=0; return { hasNext:()=>i<l.length, next:()=>l[i++] }; },
  createFolder:n=>{ const c={n, archivos:[], getFiles(){ const l=c.archivos.filter(f=>!f.papelera); let i=0; return { hasNext:()=>i<l.length, next:()=>l[i++] }; }}; carpetas.push(c); return c; } };
const ScriptApp={ WeekDay:{SUNDAY:'SUNDAY'}, getProjectTriggers:()=>triggers.map(t=>({getHandlerFunction:()=>t})),
  newTrigger:fn=>{ const ch={ timeBased:()=>ch, onWeekDay:()=>ch, atHour:()=>ch, create:()=>triggers.push(fn) }; return ch; } };
function servidor(archivo){ const cache={}, pr={};
  const ctx={ PropertiesService:{getScriptProperties(){return {getProperty:k=>(k in pr?pr[k]:null),setProperty(k,v){pr[k]=String(v);}};}},
    SpreadsheetApp, Session, Utilities, LockService, MailApp:{sendEmail(){}}, Logger, HtmlService:{}, DriveApp, ScriptApp,
    CacheService:{ getScriptCache(){ return { get:k=>cache[k]||null, put:(k,v)=>{cache[k]=v;}, remove:k=>{delete cache[k];} }; } },
    console, JSON, Math, Date, String, Number, Array, Object, RegExp, parseInt, isNaN, Error };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync('/home/claude/ijm/'+archivo,'utf8')+'\nfunction __n(){for(const k in _memo) delete _memo[k];}', ctx);
  ctx.guardarFotos_=()=>'x'; return ctx; }
const A=servidor('App_Dueno.gs'), P=servidor('App_PM.gs');
const ll=(S,f,...a)=>{ S.__n(); return S[f](...a); }, falla=(S,f,...a)=>{ try{ ll(S,f,...a); return ''; }catch(e){ return e.message; } };
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const ta=ll(A,'duLogin','javier','482915').token, tp=ll(P,'pmLogin','carlos','2468').token;
const copia=()=>JSON.parse(JSON.stringify(SHEETS,(k,v)=>v)), restaurar=c=>{ Object.keys(c).forEach(n=>{ SHEETS[n].length=0; c[n].forEach(r=>SHEETS[n].push(r)); }); };

console.log('\nSalud del libro');
let p=ll(A,'revisarLibro_');
ok(p.length===0, 'el libro de ejemplo, sano: '+(p.length?p.length+' falsa(s) alarma(s): '+p.slice(0,3).map(x=>x.hoja+' — '+x.detalle).join(' | '):'sin falsas alarmas'));
const orig=copia();
SHEETS['Gastos'].forEach(r=>r.splice(3,0,r===SHEETS['Gastos'][0]?'columna_nueva':''));
p=ll(A,'revisarLibro_').filter(x=>x.hoja==='Gastos');
ok(p.length===1 && /parece que se insertó/.test(p[0].detalle), 'una columna insertada a mano en Gastos: "'+(p[0]||{}).detalle+'"');
restaurar(orig); const fila=SHEETS['Avance'][1].slice(); fila[0]=''; SHEETS['Avance'].splice(3,0,fila);
p=ll(A,'revisarLibro_').filter(x=>x.hoja==='Avance');
ok(p.length===1 && /fila 4 tiene datos pero no tiene ID/.test(p[0].detalle), 'un renglón con datos y sin ID: "'+(p[0]||{}).detalle+'"');
restaurar(orig); SHEETS['Bitacora'].push(SHEETS['Bitacora'][1].slice());
p=ll(A,'revisarLibro_').filter(x=>x.hoja==='Bitacora');
ok(p.length===1 && /IDs repetidos/.test(p[0].detalle), 'un ID repetido: "'+(p[0]||{}).detalle+'"');
restaurar(orig);
console.log('\nNúmeros de registro con notas al pie (como la plantilla)');
const ult=SHEETS['Trabajadores'].filter(r=>/^TRB-/.test(r[0])).length;
ll(A,'duGuardarTrabajador',ta,{nombre:'Luis Mora',puesto:'Ayudante',tipoPago:'Por hora',tarifa:18,telefono:'512-555-0111'});
const nuevo=SHEETS['Trabajadores'].slice(-1)[0][0];
ok(nuevo==='TRB-0'+(ult+1) || nuevo==='TRB-'+String(ult+1).padStart(2,'0'), 'con la nota de la plantilla abajo, el trabajador nuevo recibe '+nuevo+' (antes habría recibido TRB-01, repetido)');
ok(ll(A,'revisarLibro_').filter(x=>/IDs repetidos/.test(x.detalle)).length===0, 'y no hay IDs repetidos en ninguna hoja');
restaurar(orig);
console.log('\nRespaldo semanal');
let r=ll(A,'duActivarRespaldo',ta);
ok(r.nuevo && triggers.join()==='respaldoSemanal' && carpetas[0].n==='IJM_Respaldos' && carpetas[0].archivos.length===1, 'activarlo: programa el domingo y guarda la primera copia en IJM_Respaldos');
ll(A,'duActivarRespaldo',ta);
ok(triggers.length===1, 'activarlo otra vez no duplica la tarea');
for(let i=0;i<14;i++) ll(A,'respaldoSemanal');
ok(carpetas[0].archivos.filter(f=>!f.papelera).length===12, 'con 16 copias hechas, conserva las 12 más recientes');
console.log('\nProtección');
r=ll(A,'duProtegerHojas',ta);
ok(prot['Gastos'].length===1 && prot['Gastos'][0].tipo==='SHEET' && prot['Gastos'][0].w, 'Gastos: protegida completa, con advertencia (no bloqueo)');
ok(prot['Config'][0].tipo==='RANGE', 'Config: solo los encabezados, porque se edita a mano');
ll(A,'duProtegerHojas',ta);
ok(prot['Gastos'].length===1, 'volver a proteger no apila protecciones');
console.log('\nRegistro de errores');
const n0=SHEETS['Errores'].length;
falla(A,'duNuevaObra',ta,{cliente:'x'});
ok(SHEETS['Errores'].length===n0, 'un error de negocio ("Faltan: …") no se registra');
A.costosUnitarios_=()=>{ return null.x; };
ok(/null/.test(falla(A,'duPresupuesto',ta,'OB-001')), 'un error inesperado le llega igual a la pantalla');
const e1=SHEETS['Errores'].slice(-1)[0];
ok(SHEETS['Errores'].length===n0+1 && e1[1]==='Admin' && e1[2]==='duPresupuesto' && e1[3]==='javier', 'y queda registrado: Admin · duPresupuesto · javier');
P.construirDatos_=()=>{ throw new TypeError('algo falló'); };
falla(P,'pmDatos',tp);
const e2=SHEETS['Errores'].slice(-1)[0];
ok(e2[1]==='PM' && e2[2]==='pmDatos' && e2[3]==='carlos', 'también los de la app del PM: PM · pmDatos · carlos');
console.log('\nLo que ves en tu app');
ll(A,'duRevisarLibro',ta);
const s=ll(A,'duSistema',ta);
ok(s.respaldoActivo===true && s.respaldoUltimo && s.salud && s.salud.problemas.length===0 && s.protegido && s.errores.length===2, 'Catálogo → Sistema: respaldo activo, libro sano, hojas protegidas y 2 errores');
delete A.costosUnitarios_;
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
