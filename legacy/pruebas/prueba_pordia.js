const fs=require('fs');
delete require.cache[require.resolve('/tmp/harness.js')]; const H=require('/tmp/harness.js');
eval(fs.readFileSync('/home/claude/ijm/App_PM.gs','utf8')+'\nfunction __n(){for(const k in _memo) delete _memo[k];}');
guardarFotos_=()=>'x'; H.cache['pm_L']='luis';
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const falla=(f)=>{ try{ __n(); f(); return ''; }catch(e){ return e.message; } };
const d=construirDatos_('luis'); const o3=d.obras.find(o=>o.id==='OB-003'), o4=d.obras.find(o=>o.id==='OB-004');
const k3=o3.areas.find(a=>!a.generales).partidas[0].key, k4=o4.areas.find(a=>!a.generales).partidas[0].key;
const cierre=(obra,k,cuad)=>({obra, partidas:[k], terminadas:[], cuadrilla:cuad, subs:[], fotos:[{mime:'x',data:'x'}]});
const bits=()=>H.SHEETS['Bitacora'].length, mo=()=>H.SHEETS['Mano_Obra'].length;

console.log('\nAngel (por día, $220) repartido entre las dos obras de Luis el mismo día');
ok(!falla(()=>pmCerrarDia('L',cierre('OB-003',k3,[{trabajador:'TRB-04',horas:0.5,partida:k3}]))), 'medio día en OB-003: se registra');
ok(!falla(()=>pmCerrarDia('L',cierre('OB-004',k4,[{trabajador:'TRB-04',horas:0.5,partida:k4}]))), 'medio día en OB-004: se registra (suma un día)');
const b0=bits(), m0=mo();
let msg=falla(()=>pmCerrarDia('L',cierre('OB-004',k4,[{trabajador:'TRB-04',horas:0.5,partida:k4}])));
ok(/no puede pasar de un dia/.test(msg), 'otro medio día el mismo día: rechazado — "'+msg.slice(0,58)+'…"');
ok(bits()===b0 && mo()===m0, 'y el rechazo no dejó un cierre a medias: ni bitácora ni horas');
msg=falla(()=>pmCerrarDia('L',cierre('OB-003',k3,[{trabajador:'TRB-04',horas:8,partida:k3}])));
ok(/se registra como dia completo o medio dia/.test(msg), 'poner "8" a un trabajador por día: rechazado (antes cobraba 8 días)');

console.log('\nRuben (por hora) en las dos obras');
ok(!falla(()=>pmCerrarDia('L',cierre('OB-003',k3,[{trabajador:'TRB-03',horas:8,partida:k3}]))), '8 h en OB-003');
msg=falla(()=>pmCerrarDia('L',cierre('OB-004',k4,[{trabajador:'TRB-03',horas:10,partida:k4}])));
ok(/El maximo es 16/.test(msg), '10 h más en OB-004 (serían 18): rechazado');
ok(!falla(()=>pmCerrarDia('L',cierre('OB-004',k4,[{trabajador:'TRB-03',horas:6,partida:k4}]))), '6 h más (14 en total): se registra');

console.log('\nCorregir y ver lo capturado');
__n(); const lista=pmCorregibles('L');
const angel=lista.find(x=>/Angel/.test(x.titulo));
ok(angel && /medio día/.test(angel.titulo), 'en "mis capturas recientes" dice: "'+(angel&&angel.titulo)+'" (antes "0.5 h")');
msg=falla(()=>pmCorregir('L','Mano_Obra',angel.id,{horas:1},'Fue el día completo'));
ok(/no puede pasar de un dia/.test(msg), 'corregir ese medio día a día completo, con otro medio día ya en la otra obra: rechazado');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
