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
const o=ll(A,'duNuevaObra',ta,{cliente:'Familia Vega',telefono:'512-555-0177',direccion:'22 Elm St',pm:'carlos',inicio:hoy,finEst:hoy,contrato:40000,
  areas:[{tipo:'Baño',nombre:'Baño',pies2:50},{tipo:'Closet',nombre:'Closet',pies2:30}]});
const ars=H.SHEETS['Areas'].slice(1).filter(a=>a[1]===o.id), baño=ars.find(a=>a[2]==='Baño'), closet=ars.find(a=>a[2]==='Closet');
console.log('\nEl formulario');
const f=ll(A,'duPresupuesto',ta,o.id);
const fb=f.areas.find(a=>a.id===baño[0]), fc=f.areas.find(a=>a.id===closet[0]), fg=f.areas.find(a=>a.generales);
ok(fb.etapas.map(e=>e.etapa).join(' / ')==='Demolición / Plomería / Eléctrico / Carpintería y muros / Impermeabilización / Tile / Vidrio y accesorios / Vanity y countertop / Pintura', 'el baño: 9 etapas, una por tipo de trabajo, en orden de obra');
ok(fc.etapas.length===4 && fg.etapas.length===1, 'el closet: 4 etapas; generales: 1 → 14 precios en total (antes 78 datos)');
ok(fb.etapas.find(e=>e.etapa==='Plomería').partidas.join()==='Rough de plomería,Inspección rough-in,Plomería final y luminarias', 'plomería junta todo lo de plomería, del rough al final');
console.log('\nGuardar');
const L=[['Demolición',1500],['Plomería',3200],['Impermeabilización',1400],['Tile',5200],['Vanity y countertop',4100]].map(x=>({area:baño[0],etapa:x[0],monto:x[1]}))
  .concat([{area:closet[0],etapa:'Muros y pintura',monto:600},{area:closet[0],etapa:'Sistema de closet',monto:3800}]);
let r=ll(A,'duGuardarPresupuesto',ta,o.id,L);
const filas=H.SHEETS['Presupuesto'].slice(1).filter(x=>x[1]===o.id);
ok(r.completo && r.n===7 && r.total===19800, 'se guarda: 7 etapas, $19,800 de costo esperado, la obra ya puede arrancar');
ok(filas.every(x=>x[8]==='Etapa') && filas.find(x=>x[2]==='Tile')[5]===50 && filas.find(x=>x[2]==='Tile')[6]==='pie2', 'cada renglón queda como etapa, con los pies² del espacio como cantidad: nada que teclear');
const antes=H.SHEETS['Presupuesto'].length;
ok(/no es una etapa de este espacio/.test(falla(A,'duGuardarPresupuesto',ta,o.id,[{area:closet[0],etapa:'Tile',monto:900}])), 'una etapa que no es de ese espacio se rechaza');
ok(H.SHEETS['Presupuesto'].length===antes, 'y el rechazo NO borró el presupuesto anterior');
ok(/negativo/.test(falla(A,'duGuardarPresupuesto',ta,o.id,[{area:baño[0],etapa:'Plomería',monto:-5}])), 'un monto negativo se rechaza');
console.log('\nEl costo real del campo se suma a su etapa');
ll(A,'duSugerirDuraciones',ta);
const k=a=>baño[0]+'|'+a;
ll(P,'pmGasto',tp,{obra:o.id,monto:2100,categoria:'Material',partida:k('Tile de piso y muro'),proveedor:'Floor & Decor',descripcion:'tile'});
ll(P,'pmGasto',tp,{obra:o.id,monto:350,categoria:'Material',partida:k('Lechada y sellado'),proveedor:'Home Depot',descripcion:'lechada'});
const det=ll(A,'duDetalleObra',ta,o.id);
const ac=det.costoPorEtapa.find(x=>x.areaId===baño[0] && x.etapa==='Tile');
ok(ac && ac.total===2450 && ac.presupuesto===5200, 'Tile: tile $2,100 + lechada $350 = $2,450 real contra $5,200 presupuestado');
ok(ac.partidas.map(p=>p.partida).join()==='Tile de piso y muro,Lechada y sellado' && Math.abs(ac.unitario-49)<0.01, 'con el detalle por partida y el costo por pie² ($49)');
console.log('\nEl formato anterior sigue funcionando');
r=ll(A,'duGuardarPresupuesto',ta,o.id,[{area:baño[0],partida:'Tile de piso y muro',monto:3000},{area:baño[0],partida:'Lechada y sellado',monto:500},{area:closet[0],partida:'Instalación de estructura',monto:2000}]);
const f2=ll(A,'duPresupuesto',ta,o.id);
ok(f2.areas.find(a=>a.id===baño[0]).etapas.find(e=>e.etapa==='Tile').monto===3500, 'dos partidas del formato viejo se suman a su etapa: Tile $3,500');
H.SHEETS['Presupuesto'].push(['PRE-9999',o.id,'Rough de plomería',1800,'',1,'lote',baño[0]]);   // un renglon viejo, por partida
ok(ll(A,'duPresupuesto',ta,o.id).areas.find(a=>a.id===baño[0]).etapas.find(e=>e.etapa==='Plomería').monto===1800, 'un renglón viejo guardado por partida aparece en su etapa (Plomería)');
console.log('\nEl catálogo');
ok(!falla(A,'duGuardarPartida',ta,{tipo:'Baño',orden:17,partida:'Accesorios de baño',peso:1,dias:1,quien:'Cuadrilla',etapa:'Vidrio y accesorios'}), 'una partida nueva se guarda con su etapa');
const cat=ll(A,'duDatos',ta).partidas.find(p=>p.partida==='Accesorios de baño');
ok(cat && cat.etapa==='Vidrio y accesorios', 'y el catálogo la muestra en su etapa');
console.log('\nCambiar un catálogo con la agrupación anterior');
const C=H.SHEETS['Partidas_Catalogo'], fila=n=>C.find(r=>r[0]==='Baño'&&r[2]===n);
fila('Rough de plomería')[9]='Roughs'; fila('Tile de piso y muro')[9]='Acabados'; fila('Lechada y sellado')[9]='Mis acabados';
const PO=H.SHEETS['Partidas_Obra'], snap=PO.find(r=>r[0]===baño[0]&&r[3]==='Rough de plomería');
snap[11]='Roughs';                                          // esta obra ya tiene presupuesto guardado
ll(A,'duSugerirDuraciones',ta);
ok(fila('Rough de plomería')[9]==='Plomería' && fila('Tile de piso y muro')[9]==='Tile', 'las etiquetas viejas que nadie tocó cambian: Roughs → Plomería, Acabados → Tile');
ok(fila('Lechada y sellado')[9]==='Mis acabados', 'la que modificaste tú ("Mis acabados") se respeta');
ok(snap[11]==='Roughs', 'y la obra que ya tiene presupuesto guardado conserva su agrupación: nada queda huérfano');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
