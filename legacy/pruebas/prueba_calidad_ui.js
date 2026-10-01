const fs=require('fs'), vm=require('vm');
// datos reales desde el servidor simulado
const H=require('/tmp/harness.js');
eval(fs.readFileSync('/home/claude/ijm/App_PM.gs','utf8')+'\nfunction __nuevaEjecucion(){for(const k in _memo) delete _memo[k];}');
const datos={ carlos:construirDatos_('carlos'), luis:construirDatos_('luis') };

// navegador minimo
const els={};
const el=id=>els[id]||(els[id]={id, innerHTML:'', className:'', textContent:'', dataset:{}, style:{},
  scrollIntoView(){}, querySelectorAll(){return [];}, querySelector(){return null;}, focus(){}});
const ctx={ console, JSON, Math, Date, String, Number, Array, Object, RegExp, parseInt, isNaN,
  document:{ getElementById:el, querySelector:()=>el('nav a'), querySelectorAll:()=>[], addEventListener(){}, createElement:()=>el('x') },
  window:{ addEventListener(){}, scrollTo(){} }, navigator:{onLine:true},
  localStorage:{ getItem:()=>null, setItem(){}, removeItem(){} },
  setInterval(){}, setTimeout(){}, confirm:()=>true, prompt:()=>'x',
  google:{script:{run:{withSuccessHandler(){return this;},withFailureHandler(){return this;}}}} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('/home/claude/ijm/PM.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1], ctx);

let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const pinta=(pm,obra)=>{ ctx.S.d=datos[pm]; ctx.S.obra=obra; ctx.S.token='T';
  return vm.runInContext('vCalidad(S.d, obraActual())', ctx); };

console.log('\nOB-001 · baño con tres puntos aprobados');
let h=pinta('carlos','OB-001'); let r;
ok((h.match(/pill ok">aprobado/g)||[]).length===3, 'PC1, PC2 y PC3 aparecen aprobados');
ok(/Última inspección [0-9/]+ · 8 de 8 puntos/.test(h), 'muestra fecha y "8 de 8 puntos" de la última inspección');
ok(/Prueba de inundación: 25\.5 h sin fugas/.test(h), 'el PC3 muestra su prueba de agua: 25.5 h sin fugas');
ok(/Qué se revisa \(8\)/.test(h) && /FOTO PANORÁMICA DE CADA MURO/.test(h), 'las preguntas del PC2 se pueden leer por adelantado');

console.log('\nOB-003 · un punto con defectos');
h=pinta('luis','OB-003');
ok(/pill bad">con defectos/.test(h) && /Falló: Tubo galvanizado corroido/.test(h), 'dice qué falló: "Tubo galvanizado corroido…"');
ok(/Reinspeccionar/.test(h), 'y ofrece reinspeccionar');

console.log('\nOB-002 · gabinetes instalados, PC4 sin inspeccionar');
h=pinta('carlos','OB-002');
ok(/pill warn">toca ahora/.test(h) && /Hacer la inspección/.test(h), 'el PC4 sale como "toca ahora" con su botón');
ok(/Instalación de gabinetes · Instalación de countertop/.test(h), 'un solo PC4 que cubre gabinetes y countertop');
ok(/pill">más adelante/.test(h) && /class="sec" onclick="abrirInspeccionDe[^>]*>Ya se hizo el trabajo/.test(h),
   'lo que no ha arrancado sale como "más adelante", con opción secundaria por si ya se hizo');

console.log('\nOB-004 · baño + closet');
h=pinta('luis','OB-004');
const iBano=h.indexOf('Baño de visitas'), iCloset=h.indexOf('Closet principal'), iGen=h.indexOf('Generales de obra');
ok(iBano>0 && iCloset>iBano && iGen>iCloset, 'agrupado por espacio, y la inspección final (Generales) al último');
ok(/Incluye la prueba de inundación de 24 horas/.test(h), 'avisa que el PC3 del baño incluye la prueba de agua');

console.log('\nEl caso que dejaba al PM atorado: demolición de un día');
// partida nunca marcada "en progreso": el servidor bloquea el cierre y el mensaje debe ser cumplible
H.cache['pm_L']='luis'; guardarFotos_=()=>'x';
let msg=''; try{ pmCerrarDia('L',{obra:'OB-004',partidas:['AR-0009|Demolición'],terminadas:['AR-0009|Demolición'],
  cuadrilla:[],subs:[],fotos:[{mime:'x',data:'x'}]}); }catch(e){ msg=e.message; }
ok(/Obra > Calidad/.test(msg), 'el bloqueo le dice dónde hacer la inspección: "'+msg.slice(msg.indexOf('Hazla'),msg.indexOf('Hazla')+32)+'…"');
h=pinta('luis','OB-004');
ok(/Closet principal[\s\S]*PC1 Post demolición[\s\S]*Ya se hizo el trabajo: inspeccionar/.test(h), 'y en Calidad el PC1 del closet sí tiene cómo inspeccionarse');
__nuevaEjecucion(); r=pmInspeccion('L',{obra:'OB-004',hito:'PC1 Post demolición',partida:'Demolición',area:'AR-0009',ok:8,total:8,defectos:[],fotos:[{mime:'x',data:'x'}]});
__nuevaEjecucion(); let cierra=true; try{ pmCerrarDia('L',{obra:'OB-004',partidas:['AR-0009|Demolición'],terminadas:['AR-0009|Demolición'],
  cuadrilla:[],subs:[],fotos:[{mime:'x',data:'x'}]}); }catch(e){ cierra=false; console.log('    '+e.message); }
ok(r.aprobado && cierra, 'inspecciona, y la demolición ya se puede marcar terminada el mismo día');

console.log('\nAbrir una inspección desde aquí y regresar');
ctx.S.d=datos.luis; ctx.S.obra='OB-004';
vm.runInContext("abrirInspeccionDe('AR-0009',1)", ctx);
ok(ctx.S.insp.hito==='PC4 Pre-acabados' && ctx.S.insp.area==='AR-0009' && ctx.S.insp.areaNombre==='Closet principal',
   'abre el PC4 del closet, no el del baño');
ok(ctx.S.v==='insp' && ctx.S.volver==='calidad', 'entra a la pantalla de inspección recordando de dónde vino');
vm.runInContext("salirInspeccion()", ctx);
ok(ctx.S.v==='obra' && ctx.S.vo==='calidad' && ctx.S.insp===null, 'al salir, regresa a Calidad y no a Hoy');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
