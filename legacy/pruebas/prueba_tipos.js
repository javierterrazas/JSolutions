const fs=require('fs'), vm=require('vm');
const H=require('/tmp/harness.js');
function servidor(archivo){ const cache={};
  const _pr={}; const ctx={ PropertiesService:{getScriptProperties(){return {getProperty:k=>(k in _pr?_pr[k]:null),setProperty(k,v){_pr[k]=String(v);}};}}, SpreadsheetApp, Session, Utilities, LockService, MailApp:{sendEmail(){}}, Logger, HtmlService:{}, DriveApp:{},
    CacheService:{ getScriptCache(){ return { get:k=>cache[k]||null, put:(k,v)=>{cache[k]=v;}, remove:k=>{delete cache[k];} }; } },
    console, JSON, Math, Date, String, Number, Array, Object, RegExp, parseInt, isNaN, Error };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync('/home/claude/ijm/'+archivo,'utf8')+'\nfunction __n(){for(const k in _memo) delete _memo[k];}', ctx);
  ctx.guardarFotos_=()=>'https://x'; return ctx; }
const A=servidor('App_Dueno.gs'), P=servidor('App_PM.gs');
const llama=(S,f,...a)=>{ S.__n(); return S[f](...a); };          // cada llamada, una ejecucion nueva
const falla=(S,f,...a)=>{ try{ llama(S,f,...a); return ''; }catch(e){ return e.message; } };
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const ta=llama(A,'duLogin','javier','482915').token, tp=llama(P,'pmLogin','carlos','2468').token;

console.log('\nCrear "Piso de cemento" desde cero');
const partidas=['Protección y preparación de superficie','Reparación de grietas','Desbaste y pulido','Aplicación de sellador','Aplicación de sellador'];
const r=llama(A,'duCrearTipo',ta,{nombre:'Piso de cemento',partidas:partidas,pesoTotal:40});
ok(r.ok && r.n===4 && r.peso===10, 'creado con 4 partidas (la repetida se quita sola), 10 de peso cada una');
ok(llama(A,'duDatos',ta).tiposArea.includes('Piso de cemento'), 'ya aparece para escoger al dar de alta una obra');
ok(/Ya existe/.test(falla(A,'duCrearTipo',ta,{nombre:'piso de CEMENTO',partidas:['x']})), 'no se puede crear dos veces, aunque cambien mayúsculas');
ok(/Generales/.test(falla(A,'duCrearTipo',ta,{nombre:'Generales',partidas:['x']})), '"Generales" está reservado');
ok(/al menos una partida/.test(falla(A,'duCrearTipo',ta,{nombre:'Terraza',partidas:['  ','']})), 'sin partidas no se crea');

console.log('\nSu propio punto de control');
ok(/PC1 a PC5/.test(falla(A,'duGuardarPunto',ta,{hito:'PC3 Concreto',punto:'Base limpia',orden:1,foto:true})),
   '"PC3 Concreto" se rechaza: le habría exigido prueba de inundación a un piso');
ok(llama(A,'duGuardarPunto',ta,{hito:'PC6 Pre-sellado',punto:'Superficie sin polvo ni humedad',orden:1,foto:true}).ok, '"PC6 Pre-sellado" se crea');
llama(A,'duGuardarPunto',ta,{hito:'PC6 Pre-sellado',punto:'Grietas reparadas y niveladas',orden:2,foto:false});
ok(llama(A,'duDatos',ta).checklist['PC6 Pre-sellado'].length===2, 'y se le agregan más preguntas: 2');
ok(/no existe/.test(falla(A,'duGuardarPartida',ta,{tipo:'Piso de cemento',orden:4,partida:'Aplicación de sellador',hito:'PC6 Pre sellado',partidaOriginal:'Aplicación de sellador',peso:10})),
   'amarrar una partida a un punto mal escrito se rechaza');
ok(llama(A,'duGuardarPartida',ta,{tipo:'Piso de cemento',orden:4,partida:'Aplicación de sellador',hito:'PC6 Pre-sellado',partidaOriginal:'Aplicación de sellador',peso:10}).ok,
   'el sellador queda amarrado a PC6');

console.log('\nUna obra combinada: baño + piso de cemento');
const o=llama(A,'duNuevaObra',ta,{telefono:'512-555-0100',cliente:'Familia Ortega',direccion:'Austin',pm:'carlos',inicio:'2026-09-20',finEst:'2026-10-30',contrato:28000,
  areas:[{tipo:'Baño',nombre:'Baño de visitas',pies2:40},{tipo:'Piso de cemento',nombre:'Cochera',pies2:420}]});
ok(o.ok, 'obra '+o.id+' creada');
{ const ars=H.SHEETS['Areas'].slice(1).filter(a=>a[1]===o.id && a[2]!=='Generales');     // sin presupuesto no arranca
  const pre=llama(A,'duPresupuesto',ta,o.id);
  const pr=llama(A,'duGuardarPresupuesto',ta,o.id,pre.areas.filter(a=>!a.generales).map(a=>({area:a.id,etapa:a.etapas[0].etapa,monto:1000})));
  ok(pre.areas.find(a=>a.tipo==='Piso de cemento').etapas[0].etapa==='Otras partidas', 'un tipo nuevo sin etapas junta sus partidas en "Otras partidas"');
  ok(pr.completo, 'presupuesto por partida capturado: la obra puede arrancar'); }
let obra=llama(P,'construirDatos_','carlos').obras.find(x=>x.id===o.id);
const coch=obra.areas.find(a=>a.nombre==='Cochera');
ok(coch && coch.partidas.length===4 && coch.partidas[0].partida==='Protección y preparación de superficie', 'el PM ve la cochera con sus 4 partidas, en orden');
ok(coch.controles.length===1 && coch.controles[0].hito==='PC6 Pre-sellado', 'y su punto de control PC6 en la vista de Calidad');

console.log('\nEl PM trabaja la cochera');
const clave=coch.id+'|Aplicación de sellador';
llama(P,'pmCerrarDia',tp,{obra:o.id,partidas:[clave],terminadas:[],cuadrilla:[],subs:[],fotos:[{mime:'x',data:'x'}]});
ok(/PC6 Pre-sellado/.test(falla(P,'pmCerrarDia',tp,{obra:o.id,partidas:[clave],terminadas:[clave],cuadrilla:[],subs:[],fotos:[{mime:'x',data:'x'}]})),
   'no puede cerrar el sellador sin la inspección PC6');
const ins=llama(P,'pmInspeccion',tp,{obra:o.id,hito:'PC6 Pre-sellado',partida:'Aplicación de sellador',area:coch.id,ok:2,total:2,defectos:[],fotos:[{mime:'x',data:'x'}]});
ok(ins.aprobado, 'PC6 se aprueba con sus fotos, SIN pedir prueba de inundación');
ok(!falla(P,'pmCerrarDia',tp,{obra:o.id,partidas:[clave],terminadas:[clave],cuadrilla:[],subs:[],fotos:[{mime:'x',data:'x'}]}), 'y el sellador ya se puede cerrar');
obra=llama(P,'construirDatos_','carlos').obras.find(x=>x.id===o.id);
ok(Math.abs(obra.avance-10/(8+90+40))<0.001, 'el avance sube 10 de 138 puntos: '+(obra.avance*100).toFixed(1)+'% (generales 8 + baño 90 + cochera 40)');

console.log('\nEl PC3 de fábrica sigue exigiendo su prueba de agua');
const baño=obra.areas.find(a=>a.nombre==='Baño de visitas');
ok(/prueba de inundacion/.test(falla(P,'pmInspeccion',tp,{obra:o.id,hito:'PC3 Impermeabilización',partida:'Impermeabilización + prueba de inundación',area:baño.id,ok:6,total:6,defectos:[],fotos:[{mime:'x',data:'x'}]})),
   'la impermeabilización del baño no se aprueba sin prueba de inundación');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
