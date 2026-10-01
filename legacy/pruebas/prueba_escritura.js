const H = require('/tmp/harness.js');
eval(require('fs').readFileSync('/home/claude/ijm/App_PM.gs','utf8'));
guardarFotos_ = () => 'https://drive/foto';
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
H.cache['pm_T'] = 'luis';
const antesAv = H.SHEETS['Avance'].length, antesMO = H.SHEETS['Mano_Obra'].length;

console.log('\nCierre de día en OB-004 trabajando baño Y closet el mismo día');
const r = pmCerrarDia('T', { obra:'OB-004',
  partidas:['AR-0008|Demolición y retiro de escombro','AR-0009|Demolición'], terminadas:[],
  cuadrilla:[{trabajador:'TRB-02', horas:8, partida:'AR-0009|Demolición'}],
  subs:[], incidencia:'', fotos:[{mime:'image/jpeg',data:'x'}] });
ok(r.ok, 'el cierre se guarda');
const av = H.SHEETS['Avance'].slice(antesAv);
ok(av.length===2, 'dos filas de avance, una por área');
ok(av.some(a=>a[3]==='Demolición y retiro de escombro' && a[8]==='AR-0008'), 'demolición del baño con su área');
ok(av.some(a=>a[3]==='Demolición' && a[8]==='AR-0009'), 'demolición del closet con su área');
const mo = H.SHEETS['Mano_Obra'].slice(antesMO);
ok(mo.length===1 && mo[0][4]==='Demolición' && mo[0][9]==='AR-0009', 'la hora de cuadrilla cae en el closet');
const bit = H.SHEETS['Bitacora'][H.SHEETS['Bitacora'].length-1];
ok(/Baño de visitas · Demolición/.test(bit[4]) && /Closet principal · Demolición/.test(bit[4]),
   'la bitácora nombra cada área: "'+bit[4]+'"');

console.log('\nRegla del hito, área por área');
// PC1 del baño de OB-004 no tiene inspección: terminar la demolición del baño debe bloquearse
let bloqueo=''; try{ pmCerrarDia('T',{obra:'OB-004',partidas:['AR-0008|Demolición y retiro de escombro'],
  terminadas:['AR-0008|Demolición y retiro de escombro'],cuadrilla:[],subs:[],fotos:[{mime:'x',data:'x'}]}); }
  catch(e){ bloqueo=e.message; }
ok(/PC1/.test(bloqueo) && /Baño de visitas/.test(bloqueo), 'bloquea y nombra el área: "'+bloqueo.slice(0,70)+'…"');
// la demolicion del closet ahora tiene PC1: tambien se bloquea, y nombra al closet
let b2=''; try{ pmCerrarDia('T',{obra:'OB-004',partidas:['AR-0009|Demolición'],terminadas:['AR-0009|Demolición'],
  cuadrilla:[],subs:[],fotos:[{mime:'x',data:'x'}]}); } catch(e){ b2=e.message; }
ok(/PC1/.test(b2) && /Closet principal/.test(b2), 'la demolición del closet también pide su PC1');
// pintura del closet no tiene hito: cierra libre
let libre=true; try{ pmCerrarDia('T',{obra:'OB-004',partidas:['AR-0009|Pintura'],terminadas:['AR-0009|Pintura'],
  cuadrilla:[],subs:[],fotos:[{mime:'x',data:'x'}]}); } catch(e){ libre=false; console.log('    '+e.message); }
ok(libre, 'una partida del closet sin hito (pintura) se cierra sin problema');

console.log('\nGasto sin partida → Generales de obra');
const g = pmGasto('T',{obra:'OB-004',monto:450,categoria:'Permisos',partida:'',proveedor:'City of Austin',descripcion:'Permiso'});
const fila = H.SHEETS['Gastos'].find(x=>x[0]===g.id);
ok(fila && fila[14]==='AR-0007', 'un gasto sin partida va a Generales (AR-0007)');
console.log('\n'+(fallas? fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
