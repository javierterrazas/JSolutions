const H = require('/tmp/harness.js');
eval(require('fs').readFileSync('/home/claude/ijm/App_Dueno.gs','utf8')+'\nfunction __n(){for(const k in _memo) delete _memo[k];}');
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
H.cache['du_T'] = 'javier';

console.log('\nCarga del tablero');
const d = duDatos('T');
ok(d.tablero.length===4, '4 obras activas en el tablero');
ok(d.tablero.find(t=>t.id==='OB-004').tipo==='Baño + Closet', 'el tablero etiqueta la obra combinada');
ok(d.tiposArea.indexOf('Generales')<0 && d.tiposArea.length===3, 'Generales no se ofrece como espacio');

console.log('\nPresupuesto de la obra combinada');
const p = duPresupuesto('T','OB-004');
ok(p.areas.length===3, 'el presupuesto se arma en 3 bloques: '+p.areas.map(a=>a.nombre).join(' / '));
ok(p.areas[0].generales && p.areas[0].etapas.length===1 && p.areas[0].etapas[0].partidas.length===4, 'Generales primero: 1 etapa con sus 4 partidas');
ok(p.areas.find(a=>a.tipo==='Closet').etapas.length===4, 'el closet trae sus 4 etapas: demolición, muros y pintura, sistema de closet y eléctrico');

console.log('\nDetalle: "Rough de plomería" no se mezcla entre áreas');
const o1 = duDetalleObra('T','OB-001');
const rough = o1.costoPorEtapa.filter(x=>x.etapa==='Plomería');
ok(rough.length===1 && rough[0].area==='Baño principal' && rough[0].presupuesto===2600, 'OB-001: una sola etapa de plomería, en el baño, con sus $2,600');
const cont = duDetalleObra('T','OB-003').costoPorPartida.find(x=>x.partida==='Contenedor y disposición');
ok(cont && cont.area==='Generales de obra' && cont.material===385, 'el contenedor ($385) cae en Generales, no en el baño');

console.log('\nCostos unitarios, por tipo de área');
// una etapa entra al historico cuando TODAS sus partidas estan terminadas: se terminan las de acabados del baño
const acab = o1.costoPorEtapa.find(x=>x.etapa==='Tile');
['Tile de piso y muro','Lechada y sellado'].forEach((pp,i)=>H.SHEETS['Avance'].push(['AV-T'+i,new Date(),'OB-001',pp,'Terminada','carlos',new Date(),'Vigente',acab.areaId]));
__n();
const cu = costosUnitarios_();
const ac = cu['Baño|Tile'];
ok(ac && ac.unidad==='pie²' && Math.abs(ac.prom - acab.total/acab.cantidad) < 0.01, 'tile de baño: $'+(ac?ac.prom.toFixed(2):'?')+'/pie², el costo real de la etapa entre los pies² del baño');
ok(!Object.keys(cu).some(k=>/Tile de piso/.test(k)), 'los costos unitarios ya son por etapa, no por partida');
ok(!Object.keys(cu).some(k=>k.indexOf('?|')===0), 'ningún costo unitario queda sin tipo');

console.log('\nPre-cierre por área');
const pc = duPreCierre('T','OB-004');
const puntos = pc.avisos.map(a=>a.t).join(' | ');
ok(/Baño de visitas PC1/.test(puntos) && /Closet principal PC1/.test(puntos) && /Closet principal PC4/.test(puntos), 'los hitos pendientes se nombran por área, incluido el closet');
ok(/prueba de inundacion documentada en Baño de visitas/.test(puntos), 'pide la prueba de agua del baño, no del closet');

console.log('\nAlta de obra con dos baños y cocina');
const antes = H.SHEETS['Areas'].length;
const n = duNuevaObra('T',{telefono:'512-555-0100',cliente:'Prueba',direccion:'x',pm:'carlos',contrato:90000,
  inicio:'2026-10-01',finEst:'2026-12-01',
  areas:[{tipo:'Baño',nombre:'Baño principal',pies2:60},{tipo:'Baño',nombre:'Baño de visitas',pies2:35},
         {tipo:'Cocina',nombre:'Cocina',pies2:200,lineales:26}]});
const nuevas = H.SHEETS['Areas'].slice(antes);
ok(n.areas===4 && nuevas.length===4, 'crea Generales + 3 espacios');
const proy = H.SHEETS['Proyectos'].find(r=>r[0]===n.id);
const piesAreas = H.SHEETS['Areas'].filter(a=>a[1]===n.id && a[2]!=='Generales').reduce((s,a)=>s+(Number(a[4])||0),0);
ok(proy[4]==='Baño + Cocina' && piesAreas===295 && proy.length<=12, 'etiqueta "'+proy[4]+'", 295 pies² en sus áreas y ya no duplicados en Proyectos');

console.log('\nMigración: idempotente');
const m1 = migrarAreas(), m2 = migrarAreas();
ok(m1.areas===0 && m2.areas===0 && m2.registros===0, 'con todo migrado, correrla no duplica nada');

console.log('\n'+(fallas? fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
