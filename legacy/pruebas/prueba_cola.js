const fs=require('fs');
const html=fs.readFileSync('/home/claude/ijm/PM.html','utf8');
const js=html.match(/<script>([\s\S]*)<\/script>/)[1];
const saca=n=>{ const i=js.indexOf('function '+n+'('); let d=0,j=js.indexOf('{',i);
  for(let k=j;k<js.length;k++){ if(js[k]==='{')d++; else if(js[k]==='}'){ d--; if(d===0) return js.slice(i,k+1);} } };
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true,writable:true});
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
let enviados=[], respuesta;
global.google={script:{run:{ withSuccessHandler(s){ this._s=s; return this; }, withFailureHandler(f){ this._f=f; return this; },
  pmCerrarDia(t,p){ const r=respuesta(p); if(r) this._f(r); else { enviados.push(p.id); this._s({}); } },
  pmGasto(t,p){ const r=respuesta(p); if(r) this._f(r); else { enviados.push(p.id); this._s({}); } },
  pmBloqueo(t,p){ enviados.push(p.id); this._s({}); } }}};
const $=()=>({innerHTML:''}); const grabarCola=()=>{}, pintarBanner=()=>{}, guardado=()=>{}, toast=()=>{}, cargar=()=>{}, traerCambios=()=>{};   // al vaciarse la cola ahora se recarga con respeto a lo que se esté llenando
let S;
eval(saca('tipoDeFalla')+'\n'+saca('procesarCola'));

console.log('\nUn registro que el servidor rechaza por una regla, con otros dos detrás');
S={token:'T', enviando:false, cola:[
  {tipo:'dia', payload:{id:'lunes'}, etiqueta:'Cierre del lunes', intentos:0},
  {tipo:'gasto', payload:{id:'gasto'}, etiqueta:'Gasto $86', intentos:0},
  {tipo:'dia', payload:{id:'martes'}, etiqueta:'Cierre del martes', intentos:0}], rechazados:[]};
respuesta=p=> p.id==='lunes' ? new Error('Antes de cerrar "Tile" de Baño hay que aprobar la inspeccion PC3.') : null;
procesarCola(true);
ok(S.cola.length===0, 'la cola se vacía (antes se quedaba atorada en el primero para siempre)');
ok(enviados.join(',')==='gasto,martes', 'lo que venía detrás se envió: '+enviados.join(', '));
ok(S.rechazados.length===1 && /PC3/.test(S.rechazados[0].msg), 'el rechazado se le muestra al PM con la razón');

console.log('\nSin señal: se queda y se reintenta');
enviados=[]; S={token:'T', enviando:false, cola:[{tipo:'gasto',payload:{id:'g'},etiqueta:'Gasto',intentos:0}], rechazados:[]};
respuesta=()=>new Error('NetworkError: Connection failure due to HTTP 0');
procesarCola(true);
ok(S.cola.length===1 && S.cola[0].intentos===1 && !S.rechazados.length, 'un error de red NO descarta el registro');
respuesta=()=>new Error('El sistema esta ocupado con otra captura. Intenta de nuevo en unos segundos.');
procesarCola(true);
ok(S.cola.length===1, 'el candado ocupado tampoco lo descarta: es temporal');

console.log('\nSesión vencida: se detiene y pide entrar, sin perder nada');
S={token:'T', enviando:false, cola:[{tipo:'gasto',payload:{id:'g'},etiqueta:'Gasto',intentos:0},
  {tipo:'gasto',payload:{id:'h'},etiqueta:'Gasto 2',intentos:0}], rechazados:[]};
respuesta=()=>new Error('Sesion expirada. Vuelve a entrar.');
procesarCola(true);
ok(S.sesionVencida===true && S.cola.length===2 && !S.rechazados.length, 'marca la sesión vencida y conserva los dos registros');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
