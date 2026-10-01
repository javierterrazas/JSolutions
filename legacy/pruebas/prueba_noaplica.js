const fs=require('fs'), vm=require('vm'); const H=require('/tmp/harness.js');
function servidor(archivo){ const cache={};
  const _pr={}; const ctx={ PropertiesService:{getScriptProperties(){return {getProperty:k=>(k in _pr?_pr[k]:null),setProperty(k,v){_pr[k]=String(v);}};}}, SpreadsheetApp, Session, Utilities, LockService, MailApp:{sendEmail(a,s,c){ ctx.correo={s,c}; }}, Logger, HtmlService:{}, DriveApp:{},
    CacheService:{ getScriptCache(){ return { get:k=>cache[k]||null, put:(k,v)=>{cache[k]=v;}, remove:k=>{delete cache[k];} }; } },
    console, JSON, Math, Date, String, Number, Array, Object, RegExp, parseInt, isNaN, Error };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync('/home/claude/ijm/'+archivo,'utf8')+'\nfunction __n(){for(const k in _memo) delete _memo[k];}', ctx);
  ctx.guardarFotos_=()=>'https://x'; return ctx; }
const A=servidor('App_Dueno.gs'), P=servidor('App_PM.gs');
const llama=(S,f,...a)=>{ S.__n(); return S[f](...a); };
const falla=(S,f,...a)=>{ try{ llama(S,f,...a); return ''; }catch(e){ return e.message; } };
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const ta=llama(A,'duLogin','javier','482915').token, tp=llama(P,'pmLogin','carlos','2468').token;
const foto=[{mime:'x',data:'x'}];

// una obra que SOLO es piso de cemento
llama(A,'duCrearTipo',ta,{nombre:'Piso de cemento',partidas:['Preparación de superficie','Desbaste y pulido','Aplicación de sellador'],pesoTotal:34});
const o=llama(A,'duNuevaObra',ta,{telefono:'512-555-0100',cliente:'Familia Ortega',direccion:'Austin',pm:'carlos',inicio:'2026-09-20',finEst:'2026-10-02',contrato:9000,
  areas:[{tipo:'Piso de cemento',nombre:'Cochera',pies2:420}]});
const obra=llama(P,'construirDatos_','carlos').obras.find(x=>x.id===o.id);
const gen=obra.areas.find(a=>a.generales);
const pc5=llama(P,'construirDatos_','carlos').checklist['PC5 Pre-entrega'].map(x=>x.punto);
const deBano=pc5.filter(x=>/regadera|Plomería|extractor|GFCI|Cajones|gabinetes|registro/i.test(x));
const aplican=pc5.filter(x=>deBano.indexOf(x)<0);
console.log('\nLa inspección final de una obra que solo es piso de cemento');
console.log('    PC5 tiene '+pc5.length+' preguntas; '+deBano.length+' son de baño y cocina');
const base={obra:o.id,hito:'PC5 Pre-entrega',partida:'Limpieza final y punch list',area:gen.id,fotos:foto};
let r=llama(P,'pmInspeccion',tp,Object.assign({},base,{cumple:aplican,noAplica:deBano}));
ok(r.aprobado && r.defectos===0 && r.noAplica===deBano.length, 'marca las de baño como No aplica y el resto cumple: APROBADA');
let fila=H.SHEETS['Calidad'][H.SHEETS['Calidad'].length-1];
ok(fila[6]===aplican.length && fila[7]===aplican.length, 'se registra '+fila[6]+' de '+fila[7]+': el total cuenta solo lo que aplica');
ok(fila[13].split(' | ').length===deBano.length && /regadera/.test(fila[13]), 'y cada "No aplica" queda guardado con su pregunta');

console.log('\nLo que no se puede');
ok(/al menos un punto que aplique/.test(falla(P,'pmInspeccion',tp,Object.assign({},base,{cumple:[],noAplica:pc5}))), 'todo "No aplica" no es inspección: se rechaza');
r=llama(P,'pmInspeccion',tp,Object.assign({},base,{cumple:aplican.slice(1),noAplica:deBano}));
ok(!r.aprobado && r.defectos===1, 'lo que aplica y no se marcó sigue siendo defecto');
r=llama(P,'pmInspeccion',tp,Object.assign({},base,{cumple:['Todo bien','Perfecto'],noAplica:[]}));
ok(!r.aprobado && r.defectos===pc5.length, 'un teléfono que manda preguntas inventadas no aprueba: el servidor cuenta contra la lista real');

r=llama(P,'pmInspeccion',tp,Object.assign({},base,{cumple:aplican.slice(1),noAplica:deBano}));
ok(/Marcados como no aplica/.test(P.correo.c), 'el correo de defectos te dice también qué se marcó como no aplica');

console.log('\n"No aplica" no brinca la prueba de inundación');
const b3=llama(P,'construirDatos_','luis').obras.find(x=>x.id==='OB-004');
const baño=b3.areas.find(a=>a.tipo==='Baño');
const pc3=llama(P,'construirDatos_','luis').checklist['PC3 Impermeabilización'].map(x=>x.punto);
const tl=llama(P,'pmLogin','luis','1357').token;
ok(/prueba de inundacion/.test(falla(P,'pmInspeccion',tl,{obra:'OB-004',hito:'PC3 Impermeabilización',partida:'Impermeabilización + prueba de inundación',area:baño.id,fotos:foto,
   cumple:pc3.filter(x=>!/INUNDACION/.test(x)),noAplica:pc3.filter(x=>/INUNDACION/.test(x))})), 'marcar la prueba de agua como No aplica no aprueba la impermeabilización');

console.log('\nTú lo ves en el detalle de la obra');
const det=llama(A,'duDetalleObra',ta,o.id);
const c=det.calidad.find(x=>x.resultado==='Aprobado');
ok(c && c.noAplica.split(' | ').length===deBano.length, 'la inspección aprobada trae sus '+deBano.length+' "No aplica" para que los revises');
const ult=llama(P,'construirDatos_','carlos').obras.find(x=>x.id===o.id).areas.find(a=>a.generales).controles[0].ultima;
ok(ult.na===deBano.length, 'y el PM ve en su vista de Calidad "· '+ult.na+' no aplican"');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
