const fs=require('fs');
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const cerca=(a,b)=>Math.abs(a-b)<0.0005;

// --- dueño
delete require.cache[require.resolve('/tmp/harness.js')];
let H=require('/tmp/harness.js');
eval(fs.readFileSync('/home/claude/ijm/App_Dueno.gs','utf8'));
H.cache['du_T']='javier';
const tab=duDatos('T').tablero; const T=id=>tab.find(t=>t.id===id);

console.log('\nAvance ponderado, calculado a mano contra el sistema');
// OB-001: generales 8 + baño 90 = 98. Terminadas: impermeabilización 5 + tile 18 = 23
ok(cerca(T('OB-001').avance.pct, 23/98), 'OB-001: (5 + 18) / 98 = '+(23/98*100).toFixed(1)+'% → sistema '+(T('OB-001').avance.pct*100).toFixed(1)+'%');
ok(T('OB-001').avance.curso===0, 'OB-001: el tile terminado no se cuenta también como "en curso"');
// OB-002: generales 8 + cocina 98 = 106. Terminado gabinetes 20; en curso plantilla 1
ok(cerca(T('OB-002').avance.pct, 20/106), 'OB-002: gabinetes 20 / 106 = '+(20/106*100).toFixed(1)+'%');
ok(cerca(T('OB-002').avance.curso, 1/106), 'OB-002: la plantilla en curso va aparte ('+(1/106*100).toFixed(1)+'%)');
// OB-003: rough en curso 10 / 98; nada terminado
ok(T('OB-003').avance.pct===0 && cerca(T('OB-003').avance.curso,10/98), 'OB-003: 0% terminado aunque el rough (10) va en curso');
// contar partidas habría dado otra cosa
ok(Math.round(2/20*100)!==Math.round(23/98*100), 'contar partidas en OB-001 daría '+Math.round(2/20*100)+'%; el peso real da '+Math.round(23/98*100)+'%');

console.log('\nCosto incurrido, no comprometido');
// presupuesto OB-001 = 9,900. incurrido = materiales 1,426 + cuadrilla 864 + OT tile aprobada 3,800 = 6,090
ok(cerca(T('OB-001').pctCosto, 6090/9900), 'OB-001: 6,090 / 9,900 = '+(6090/9900*100).toFixed(1)+'%');
// OB-003: OTs de plomería y eléctrico NO aprobadas → no entran aunque estén comprometidas
const o3=T('OB-003');
ok(o3.pctCosto!==null && o3.pctCosto < o3.gastado/3100, 'OB-003: las órdenes sin aprobar no inflan el costo ('+(o3.pctCosto*100).toFixed(0)+'% vs '+(o3.gastado/3100*100).toFixed(0)+'% si fuera comprometido)');
ok(T('OB-004').pctCosto===null, 'OB-004 sin presupuesto: no inventa un porcentaje de costo');

console.log('\nEl PM ve el mismo número');
const avDueno = {}; tab.forEach(t=>avDueno[t.id]=t.avance.pct);
delete require.cache[require.resolve('/tmp/harness.js')];
H=require('/tmp/harness.js');
eval(fs.readFileSync('/home/claude/ijm/App_PM.gs','utf8'));
['carlos','luis'].forEach(pm=>construirDatos_(pm).obras.forEach(o=>{
  ok(cerca(o.avance, avDueno[o.id]), o.id+': PM '+(o.avance*100).toFixed(1)+'% = dueño '+(avDueno[o.id]*100).toFixed(1)+'%');
}));
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
