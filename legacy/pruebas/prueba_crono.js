process.env.TZ='America/Chicago';
const fs=require('fs'), vm=require('vm');
const RealDate=Date; let AHORA=new RealDate('2026-10-05T08:00:00').getTime();
class FD extends RealDate{ constructor(...a){ if(!a.length) super(AHORA); else super(...a); } static now(){ return AHORA; } }
global.Date=FD;
const H=require('/tmp/harness.js');
['Proyectos','Areas','Avance','Ordenes_Trabajo','Ordenes_Cambio','Partidas_Obra','Plan_Semanal','Bitacora','Entrega'].forEach(h=>{ if(H.SHEETS[h]) H.SHEETS[h].length=1; });
eval(fs.readFileSync('/home/claude/ijm/App_Dueno.gs','utf8')+'\nfunction __n(){for(const k in _memo) delete _memo[k];}');
H.cache['du_T']='javier';
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const iso=d=>d.toISOString().slice(0,10);
__n(); const o=duNuevaObra('T',{telefono:'512-555-0100',cliente:'Prueba',direccion:'x',pm:'carlos',inicio:'2026-10-05',finEst:'2026-10-30',contrato:24000,areas:[{tipo:'Baño',nombre:'Baño',pies2:45}]});
__n(); let cr=cronogramaObra_(o.id);
const f=n=>cr.filas.find(x=>x.partida===n);
console.log('\nPlan de un baño que arranca el lunes 5 de octubre');
ok(iso(f('Demolición y retiro de escombro').planFin)==='2026-10-06', 'demolición: lun 5 – mar 6');
ok(iso(f('Rough eléctrico y extractor').planIni)==='2026-10-07' && iso(f('Rough de plomería').planFin)==='2026-10-08', 'roughs en paralelo: el eléctrico arranca con la plomería (mié 7)');
ok(iso(f('Blocking y framing').planIni)==='2026-10-09', 'framing espera al rough MÁS LARGO: vie 9');
ok(iso(f('Tile de piso y muro').planIni)==='2026-10-16' && iso(f('Tile de piso y muro').planFin)==='2026-10-20', 'tile: vie 16 – mar 20 (brinca el fin de semana)');
ok(iso(f('Instalación de countertop').planIni)==='2026-10-28', 'countertop: 3 días hábiles de fabricación después de la plantilla → mié 28');
ok(iso(f('Limpieza final y punch list').planIni)==='2026-10-30', 'limpieza final después de todo: vie 30');
ok(iso(cr.planFin)==='2026-10-30' && habilesEntre_(new Date('2026-10-05T12:00:00'), cr.planFin)+1===20, 'baño completo: 20 días hábiles');
__n(); const pr=duProponerEntrega('T','2026-10-05',['Baño','Closet']);
ok(pr && pr.fecha==='2026-10-30', 'al dar de alta baño + closet propone entregar el '+(pr&&pr.fecha)+' ('+(pr&&pr.dias)+' días hábiles)');

console.log('\nLa previsión se mueve con la realidad');
const ar=H.SHEETS['Areas'].slice(1).find(a=>a[1]===o.id && a[2]==='Baño');
AHORA=new RealDate('2026-10-07T17:00:00').getTime();      // la demolicion termino un dia tarde
H.SHEETS['Avance'].push(['AV-1',new Date('2026-10-05T16:00:00'),o.id,'Demolición y retiro de escombro','En progreso','carlos',new Date(),'Vigente',ar[0]]);
H.SHEETS['Avance'].push(['AV-2',new Date('2026-10-07T16:00:00'),o.id,'Demolición y retiro de escombro','Terminada','carlos',new Date(),'Vigente',ar[0]]);
__n(); cr=cronogramaObra_(o.id);
ok(iso(f('Rough de plomería').ini)==='2026-10-08' && iso(cr.prevFin)==='2026-11-02', 'demolición un día tarde → todo se recorre: entrega prevista lun 2 nov (plan: vie 30)');
__n(); const t=duDatos('T').tablero.find(x=>x.id===o.id);

ok(t.atrasoPrevisto===1 && t.atraso===0, 'el tablero lo avisa ANTES de la fecha: +'+t.atrasoPrevisto+' día previsto, 0 días vencidos');

console.log('\nEsta semana');
AHORA=new RealDate('2026-10-05T08:00:00').getTime(); H.SHEETS['Avance'].length=1;
__n(); const s=duDatos('T').semana;
const quien=s.porProgramar.map(x=>x.partida+' → '+(x.sub||'¿?')).join(' · ');
ok(s.porProgramar.some(x=>x.partida==='Rough de plomería' && x.sub==='SUB-01' && x.iniISO==='2026-10-07'), 'programar al plomero para el mié 7, sub sugerido por su oficio');
ok(!s.porProgramar.some(x=>x.partida==='Tile de piso y muro'), 'el tile (vie 16) todavía no aparece: está a más de 5 días hábiles');
__n(); duCrearOT('T',{obra:o.id,sub:'SUB-01',oficio:'',partida:ar[0]+'|Rough de plomería',alcance:'x',precio:1800,inicio:'2026-10-07',fin:'2026-10-08'});
__n(); ok(!duDatos('T').semana.porProgramar.some(x=>x.partida==='Rough de plomería'), 'al emitir su orden, sale de la lista');
console.log('\nLas fechas capturadas ya no se corren un día');
const pr2=H.SHEETS['Proyectos'].find(r=>r[0]===o.id), ot=H.SHEETS['Ordenes_Trabajo'][1];
ok(fecha_(pr2[6])==='10/05/2026' && fecha_(pr2[7])==='10/30/2026', 'alta de obra: inicio 10/05 y entrega 10/30, como se capturaron');
ok(fecha_(ot[6])==='10/07/2026', 'orden de trabajo: arranca el 10/07, no el 10/06');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
