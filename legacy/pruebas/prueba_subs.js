const fs=require('fs');
delete require.cache[require.resolve('/tmp/harness.js')];
const H=require('/tmp/harness.js');
eval(fs.readFileSync('/home/claude/ijm/App_Dueno.gs','utf8')+'\nfunction __limpiar(){for(const k in _memo) delete _memo[k];}');
H.cache['du_T']='javier';
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const cat=()=>{ __limpiar(); return duDatos('T'); };

console.log('\nAlta');
const r=duGuardarSub('T',{nombre:"O'Brien Tile",oficio:'Tile',telefono:'512-555-0399',contacto:'Sean',
  seguroVence:'2027-05-31',w9:true,activo:true});
ok(r.ok && r.id==='SUB-07', "O'Brien Tile dado de alta como "+r.id+' (el apóstrofe ya no rompe nada)');
let d=cat(); let s=d.subsCatalogo.find(x=>x.id==='SUB-07');
ok(s && s.seguroVence==='2027-05-31' && s.w9 && s.contacto==='Sean', 'sus datos regresan tal como se capturaron, fechas incluidas');
ok(d.subs.some(x=>x.id==='SUB-07'), 'aparece de inmediato para emitirle órdenes de trabajo');
const ot=duCrearOT('T',{obra:'OB-001',sub:'SUB-07',oficio:'Tile',partida:'AR-0002|Lechada y sellado',
  alcance:'Resellado de lechada',precio:450,inicio:'2026-10-01',fin:'2026-10-02'});
ok(ot.ok, 'y ya se le puede emitir una orden: '+ot.id);

console.log('\nNo se duplica');
let dup=''; try{ duGuardarSub('T',{telefono:'512-555-0199',nombre:"o'brien tile",oficio:'Tile'}); }catch(e){ dup=e.message; }
ok(/Ya existe/.test(dup), 'dar de alta el mismo nombre (aunque cambie mayúsculas) se rechaza');

console.log('\nEdición');
duGuardarSub('T',{id:'SUB-07',nombre:"O'Brien Tile",oficio:'Tile',telefono:'512-555-0400',
  seguroVence:'2027-12-31',w9:true,activo:true});
s=cat().subsCatalogo.find(x=>x.id==='SUB-07');
ok(s.telefono==='512-555-0400' && s.seguroVence==='2027-12-31', 'teléfono y seguro actualizados, mismo ID');

console.log('\nRevisión de papeles');
const e=cat().subsCatalogo.find(x=>x.id==='SUB-02');
ok(e.avisos.some(a=>/requiere licencia estatal/.test(a)), 'Hill Country Electric: "'+e.avisos[0]+'"');
const t=cat().subsCatalogo.find(x=>x.id==='SUB-03');
ok(!t.avisos.some(a=>/licencia/.test(a)), 'al de tile no se le pide licencia: en Texas no la requiere');
const r2=duGuardarSub('T',{telefono:'512-555-0199',nombre:'Bolt Electric',oficio:'Eléctrico',seguroVence:'2020-01-01',activo:true});
ok(r2.avisos.length===2, 'al guardar un eléctrico con seguro vencido y sin licencia, avisa las dos cosas');

console.log('\nBaja y reactivación');
const b=duActivarSub('T','SUB-07',false);
d=cat();
ok(!d.subs.some(x=>x.id==='SUB-07'), 'de baja: ya no aparece al emitir órdenes nuevas');
ok(d.subsCatalogo.find(x=>x.id==='SUB-07').activo===false, 'pero sigue en el catálogo, con su historial');
ok(b.abiertas===1, 'y avisa que su orden abierta sigue vigente ('+b.abiertas+')');
duActivarSub('T','SUB-07',true);
ok(cat().subs.some(x=>x.id==='SUB-07'), 'reactivado: vuelve a estar disponible');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
