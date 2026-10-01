const H = require('/tmp/harness.js');
eval(require('fs').readFileSync('/home/claude/ijm/App_PM.gs','utf8'));
let fallas = 0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
for (const pm of ['carlos','luis']) {
  const d = construirDatos_(pm);
  console.log('\n'+pm+': '+d.obras.length+' obras');
  d.obras.forEach(o => {
    console.log('  '+o.id+' '+o.tipo+' · áreas: '+o.areas.map(a=>a.nombre+'('+a.total+')').join(', ')+
      ' · abiertas '+o.abiertas.length+' · pies2 '+o.pies2);
  });
}
const d2 = construirDatos_('luis');
const combo = d2.obras.find(o=>o.id==='OB-004');
ok(combo && combo.tipo==='Baño + Closet', 'OB-004 se etiqueta Baño + Closet');
ok(combo.areas.length===3, 'OB-004 tiene 3 áreas (Generales + baño + closet)');
ok(combo.pies2===56, 'pies² de OB-004 = 30 + 26 = 56 (Generales no suma)');
const claves = combo.partidas.map(p=>p.key);
ok(new Set(claves).size===claves.length, 'ninguna clave área|partida se repite en la obra combinada');
const d1 = construirDatos_('carlos');
const o1 = d1.obras.find(o=>o.id==='OB-001');
const tile = o1.partidas.find(p=>p.partida==='Tile de piso y muro');
ok(tile && tile.estado==='Terminada' && tile.area==='AR-0002', 'OB-001: tile terminado y en el área del baño');
ok(o1.areas.find(a=>a.generales).partidas.length===4, 'Generales trae sus 4 partidas');
const pc3 = o1.partidas.find(p=>p.hito && /PC3/.test(p.hito));
ok(pc3 && pc3.inspeccion==='Aprobado', 'OB-001: PC3 aprobado (última inspección manda)');
const banoPr = o1.areas.find(a=>a.tipo==='Baño').prueba;
ok(banoPr && banoPr.resultado==='Sin fugas', 'OB-001: la prueba de agua cuelga del área del baño');
// clave con barra partida correctamente
const k = partirClave_('AR-0002|Tile de piso y muro','OB-001');
ok(k.area==='AR-0002' && k.partida==='Tile de piso y muro', 'partirClave_ separa área y partida');
const leg = partirClave_('Rough de plomería','OB-003');
ok(leg.area==='AR-0006', 'un registro viejo sin área se deduce al área correcta');
console.log('\n'+(fallas? fallas+' FALLAS' : 'TODO BIEN'));
process.exit(fallas?1:0);
