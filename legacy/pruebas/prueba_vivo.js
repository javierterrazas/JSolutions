const fs=require('fs'), vm=require('vm');
const H=require('/tmp/harness.js');                       // un solo libro compartido

// ---------- dos proyectos de Apps Script: mismo libro, CACHE PROPIA cada uno
function servidor(archivo){
  const cache={};
  const _pr={}; const ctx={ PropertiesService:{getScriptProperties(){return {getProperty:k=>(k in _pr?_pr[k]:null),setProperty(k,v){_pr[k]=String(v);}};}}, SpreadsheetApp, Session, Utilities, LockService, MailApp, Logger, HtmlService:{}, DriveApp:{},
    CacheService:{ getScriptCache(){ return { get:k=>cache[k]||null, put:(k,v)=>{cache[k]=v;}, remove:k=>{delete cache[k];} }; } },
    console, JSON, Math, Date, String, Number, Array, Object, RegExp, parseInt, isNaN, Error };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('/home/claude/ijm/'+archivo,'utf8')+
    '\nfunction __nueva(){for(const k in _memo) delete _memo[k];}', ctx);
  ctx.cache=cache; ctx.llamadas={};
  return ctx;
}
const SA=servidor('App_Dueno.gs'), SP=servidor('App_PM.gs');
SP.guardarFotos_=()=>'https://x';

// ---------- dos navegadores; cada llamada es una ejecucion nueva de Apps Script
function navegador(archivo, srv){
  const els={}, toasts=[];
  const el=id=>els[id]||(els[id]={id,innerHTML:'',className:'',textContent:'',value:'',dataset:{},style:{},
    scrollIntoView(){},querySelectorAll(){return[];},querySelector(){return null;},focus(){}});
  const doc={ visibilityState:'visible', activeElement:{tagName:'BODY'}, campos:[],
    getElementById:el, querySelector:()=>null, createElement:()=>el('x'), addEventListener(){},
    querySelectorAll(sel){ return /#vista input/.test(sel) ? doc.campos : []; } };
  const run=()=>{ let ok=()=>{}, ko=()=>{};
    const r=new Proxy({},{get(_,f){
      if(f==='withSuccessHandler') return g=>{ok=g;return r;};
      if(f==='withFailureHandler') return g=>{ko=g;return r;};
      return (...a)=>{ srv.__nueva(); srv.llamadas[f]=(srv.llamadas[f]||0)+1;
        try{ const v=srv[f](...a); ok(JSON.parse(JSON.stringify(v===undefined?null:v))); }catch(e){ ko(e); } };
    }}); return r; };
  const ctx={ console, JSON, Math, Date, String, Number, Array, Object, RegExp, parseInt, isNaN,
    document:doc, window:{addEventListener(){},scrollTo(){}}, navigator:{onLine:true},
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}}, setInterval(){}, setTimeout(){},
    confirm:()=>true, prompt:()=>'x', google:{script:{get run(){return run();}}} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('/home/claude/ijm/'+archivo,'utf8').match(/<script>([\s\S]*)<\/script>/)[1], ctx);
  vm.runInContext("toast=function(m,e){ __t.push(m); }", Object.assign(ctx,{__t:toasts}));
  ctx.toasts=toasts; ctx.doc=doc; ctx.els=els;
  return ctx;
}
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };

// ---------- los dos entran
const A=navegador('Dueno.html', SA), P=navegador('PM.html', SP);
const ta=SA.duLogin('javier','482915'), tp=SP.pmLogin('carlos','2468');
vm.runInContext("S.token='"+ta.token+"'; S.v='obras'; cargar();", A);
vm.runInContext("S.token='"+tp.token+"'; S.v='obra'; S.vo='resumen'; cargar();", P);
const gastoAntes=vm.runInContext("S.d.tablero.find(t=>t.id==='OB-001').materiales", A);

console.log('\nSin cambios: solo se pregunta por la celda');
SA.llamadas={};
vm.runInContext("revisarCambios(false)", A);
ok(SA.llamadas.duSello===1 && !SA.llamadas.duDatos, 'pregunta una celda y NO descarga los datos completos');

console.log('\nEl PM registra un gasto mientras tú tienes el tablero abierto');
SP.__nueva(); SP.pmGasto(tp.token,{obra:'OB-001',monto:275,partida:'AR-0002|Lechada y sellado',proveedor:'Home Depot'});
vm.runInContext("revisarCambios(false)", A);
const gastoDespues=vm.runInContext("S.d.tablero.find(t=>t.id==='OB-001').materiales", A);
ok(gastoDespues===gastoAntes+275, 'tu tablero pasa de $'+gastoAntes+' a $'+gastoDespues+' sin recargar');
ok(A.toasts.some(t=>/Gasto nuevo · Familia Ruiz/.test(t)), 'y te avisa qué pasó: "'+A.toasts[A.toasts.length-1]+'"');

console.log('\nSi estás escribiendo, no se te borra nada');
A.doc.campos=[{type:'textarea',value:'Compra el galvanizado en Ferguson',defaultValue:''}];
SP.__nueva(); SP.pmGasto(tp.token,{obra:'OB-001',monto:90,partida:'',proveedor:'Lowes'});
const antes2=vm.runInContext("S.d.tablero.find(t=>t.id==='OB-001').materiales", A);
vm.runInContext("revisarCambios(false)", A);
ok(vm.runInContext("S.d.tablero.find(t=>t.id==='OB-001').materiales", A)===antes2, 'los datos NO se reemplazan mientras escribes');
ok(/Actualizar/.test(A.els.vivoBar.innerHTML) && /Gasto nuevo/.test(A.els.vivoBar.innerHTML), 'aparece la barra: "Gasto nuevo · Familia Ruiz · Actualizar"');
A.doc.campos=[];
vm.runInContext("aplicarPendientes()", A);
ok(vm.runInContext("S.d.tablero.find(t=>t.id==='OB-001').materiales", A)===antes2+90 && !A.els.vivoBar.innerHTML, 'al tocar Actualizar entra el cambio y la barra se va');

console.log('\nTu propio registro no te dispara una descarga extra');
vm.runInContext("cargar()", A); SA.llamadas={};
vm.runInContext("revisarCambios(false)", A);
ok(!SA.llamadas.duDatos, 'después de tu cargar(), el sondeo ya no vuelve a descargar');

console.log('\nCon la pestaña en segundo plano no se gasta nada');
A.doc.visibilityState='hidden'; SA.llamadas={};
vm.runInContext("revisarCambios(false)", A);
ok(!SA.llamadas.duSello, 'oculta: ni siquiera pregunta');
A.doc.visibilityState='visible';

console.log('\nAl revés: respondes un aviso y el PM lo ve');
// luis levanta un aviso en su obra; carlos tiene el aviso BLQ-0003 en OB-002
const respAntes=vm.runInContext("S.d.respuestas.length", P);
SA.__nueva(); SA.duResponderBloqueo(ta.token,'BLQ-0003','No se cambia el backsplash: ya se ordenó. Explícale al cliente.');
vm.runInContext("revisarCambios(false)", P);
ok(vm.runInContext("S.d.respuestas.length", P)===respAntes+1, 'al PM le llega tu respuesta sin recargar');
ok(P.toasts.some(t=>/Te respondió el administrador/.test(t)), 'con el aviso "Te respondió el administrador"');
ok(!SP.cache['pmd_carlos'] || JSON.parse(SP.cache['pmd_carlos']).sello===vm.runInContext("S.d.sello",P),
   'la caché del PM (otro proyecto) no le sirvió datos viejos');

console.log('\nEl PM con fotos a medio cierre: no se le borran');
SA.__nueva(); SA.duEstadoOC(ta.token,'OC-0003','Autorizada');
vm.runInContext("S.v='hoy'; S.fotos=[{mime:'x',data:'x',prev:'x'}];", P);
vm.runInContext("revisarCambios(false)", P);
ok(vm.runInContext("S.fotos.length", P)===1, 'sus fotos siguen ahí');
ok(/El cliente autorizó un cambio/.test(vm.runInContext("S.vivoMsg", P)), 'y le aparece la barra: "El cliente autorizó un cambio · Ver"');

console.log('\nOtro PM registra algo que a carlos no le importa');
vm.runInContext("S.fotos=[]; S.v='obra'; aplicarPendientes();", P); P.toasts.length=0;
SP.__nueva(); const tl=SP.pmLogin('luis','1357'); SP.__nueva();
SP.pmGasto(tl.token,{obra:'OB-003',monto:40,partida:'',proveedor:'x'});
vm.runInContext("revisarCambios(false)", P);
ok(P.toasts.length===0 && !vm.runInContext("S.vivoMsg", P), 'se actualiza en silencio, sin avisos que no le tocan');
ok(vm.runInContext("S.d.obras.map(o=>o.id).join(',')", P)==='OB-001,OB-002', 'y sigue viendo solo SUS obras: '+vm.runInContext("S.d.obras.map(o=>o.id).join(', ')", P));
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
