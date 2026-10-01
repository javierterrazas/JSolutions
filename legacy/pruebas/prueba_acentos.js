// Los nombres con acentos y ñ ("Baño", "Rough de plomería"), sin romper los libros anteriores que no los tienen.
const fs=require('fs'), vm=require('vm'); const H=require('/tmp/harness.js');
function servidor(archivo){ const cache={}, pr={};
  const ctx={ PropertiesService:{getScriptProperties(){return {getProperty:k=>(k in pr?pr[k]:null),setProperty(k,v){pr[k]=String(v);}};}},
    SpreadsheetApp, Session, Utilities, LockService, MailApp:{sendEmail(){}}, Logger, HtmlService:{}, DriveApp:{},
    CacheService:{ getScriptCache(){ return { get:k=>cache[k]||null, put:(k,v)=>{cache[k]=v;}, remove:k=>{delete cache[k];} }; } },
    console, JSON, Math, Date, String, Number, Array, Object, RegExp, parseInt, isNaN, Error };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync('/home/claude/ijm/'+archivo,'utf8')+'\nfunction __n(){for(const k in _memo) delete _memo[k];}', ctx);
  ctx.guardarFotos_=f=>(f&&f.length)?f.map(()=>'https://x').join(' | '):''; return ctx; }
const A=servidor('App_Dueno.gs'), P=servidor('App_PM.gs');
const ll=(S,f,...a)=>{ S.__n(); return S[f](...a); };
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
console.log('\nLa plantilla, ya corregida');
const viejos=['Bano','Demolicion','plomeria','Plomeria','electrico','Electrico','Instalacion','Impermeabilizacion','inundacion',
  'Inspeccion','Proteccion','Reparacion','Iluminacion','disposicion','demolicion',' dano ','diseno','PANORAMICA','INUNDACION','Desague','desague','segun','Silicon',' dia '];
const hallados=[];
['Partidas_Catalogo','Checklist_Calidad'].forEach(h=>H.SHEETS[h].slice(1).forEach(r=>r.forEach(v=>{ const t=' '+String(v)+' ';
  viejos.forEach(w=>{ if(new RegExp('(^|[^A-Za-zÁÉÍÓÚáéíóúñÑ])'+w.trim()+'($|[^A-Za-zÁÉÍÓÚáéíóúñÑ])').test(t)) hallados.push(h+': '+v); }); })));
ok(hallados.length===0, 'catálogo y puntos de control sin nombres viejos'+(hallados.length?': '+hallados.slice(0,3).join(' | '):''));
const tipos=[...new Set(H.SHEETS['Partidas_Catalogo'].slice(1).map(r=>r[0]).filter(Boolean))];
ok(tipos.indexOf('Baño')>=0 && tipos.indexOf('Bano')<0, 'el tipo de obra dice "Baño": '+tipos.join(', '));
console.log('\nLos libros anteriores, sin acentos, siguen funcionando');
ok(A.esBano_('Bano') && A.esBano_('Baño') && A.esBano_(' baño ') && !A.esBano_('Cocina'), '"Bano" y "Baño" son el mismo tipo');
const sug = vm.runInContext("JSON.stringify([porNombre_(CRONO_SUGERIDO, 'Rough de plomeria'), porNombre_(porNombre_(ETAPA_SUGERIDA, 'Bano') || {}, 'Rough de plomeria')])", A);
ok(JSON.parse(sug)[0] && JSON.parse(sug)[1]==='Plomería', 'las sugerencias del catálogo encuentran "Rough de plomeria" de un libro anterior: '+sug);
ok(A.porNombre_({ 'Rough de plomería': 3 }, 'Rough de plomeria')===3 && A.porNombre_({ 'Rough de plomeria': 3 }, 'Rough de plomería')===3, 'y al revés: se encuentran en las dos direcciones');
ok(A.enLista_(['Desagüe con brida y sello correctos'], 'Desague con brida y sello correctos'), 'las fotos críticas reconocen los puntos de un libro anterior');
console.log('\nLo que ya fallaba con acentos, corregido');
ok(A.requiereLicencia_('Eléctrico') && A.requiereLicencia_('Electrico') && A.requiereLicencia_('Plomería') && !A.requiereLicencia_('Tile'),
   'un electricista capturado como "Eléctrico" sí pide licencia de Texas');
ok(A.esAdmin_('dueño') && A.esAdmin_('Dueño') && A.esAdmin_('dueno') && A.esAdmin_('admin') && !A.esAdmin_('pm'), '"dueño" con ñ se reconoce como administrador');
console.log('\nUn cierre que quedó en la cola antes de actualizar');
const tp=ll(P,'pmLogin','carlos','2468').token;
const r=ll(P,'pmCerrarDia',tp,{obra:'OB-001',sinTrabajo:true,motivo:'Esperando fabricacion',partidas:[],terminadas:[],cuadrilla:[],subs:[],fotos:[]});
const b=H.SHEETS['Bitacora'].find(x=>x[0]===r.id);
ok(r.ok && /Esperando fabricación/.test(String(b[6])+String(b[4])), 'su motivo sin acento se acepta, y se guarda con acento: "'+(b[6]||b[4])+'"');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
