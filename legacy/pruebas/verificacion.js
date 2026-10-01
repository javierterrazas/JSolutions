const fs=require('fs');
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const fresco=()=>{ delete require.cache[require.resolve('/tmp/harness.js')]; return require('/tmp/harness.js'); };

console.log('\n1. KPI de cierre con una semana perfecta');
let H=fresco(); eval(fs.readFileSync('/home/claude/ijm/App_Dueno.gs','utf8')); H.cache['du_T']='javier';
const B=H.SHEETS['Bitacora']; B.length=1; const hoy=new Date(); let n=0;
for(let i=1;n<5;i++){ const f=new Date(hoy.getTime()-i*86400000); if(f.getDay()===0||f.getDay()===6) continue; n++;
  ['OB-001','OB-002','OB-003'].forEach(o=>{ B.push(['B'+i+o,f,o,'x','','','','',f,'Vigente']); B.push(['C'+i+o,f,o,'x','','','','',f,'Vigente']); }); }
const kc=duDatos('T').kpis.find(k=>/Tasa de cierre/.test(k.nombre));
ok(Math.abs(kc.real-1)<0.001 && kc.sem==='VERDE', 'cinco de cinco días hábiles → '+Math.round(kc.real*100)+'%, '+kc.sem+' (antes 71%, ROJO)');
ok(kc.real<=1, 'cerrar dos veces el mismo día no infla el porcentaje');

console.log('\n6 y 7. Presentación de subs y el KPI que nunca fallaba');
H=fresco(); H.SHEETS['Ordenes_Trabajo'].push(['OT-0099','OB-001','SUB-06','Pintura','x',900,new Date(),new Date(),'Confirmada','','SI','','','Pintura primera mano','AR-0002']);
eval(fs.readFileSync('/home/claude/ijm/App_Dueno.gs','utf8')+'\nfunction __limpiar(){for(const k in _memo) delete _memo[k];}'); H.cache['du_T']='javier';
const ks=duDatos('T').kpis;
const kp=ks.find(k=>/presentacion/.test(k.nombre));
ok(kp.real<=1, 'un sub que llegó sin confirmar → '+Math.round(kp.real*100)+'% (antes 133%)');
ok(!ks.some(k=>/OC ejecutadas sin autorizacion/.test(k.nombre)), 'el KPI que siempre daba verde ya no existe');
ok(ks.filter(k=>k.top).length===6, 'siguen siendo seis los KPIs principales');

console.log('\n9. Agregar un espacio');
duAgregarArea('T','OB-004',{tipo:'Baño',nombre:'Medio baño',pies2:20});
__limpiar();
ok(duDatos('T').tablero.find(t=>t.id==='OB-004').pies2===76, 'OB-004 pasa de 56 a 76 pies² sin tocar nada más');

console.log('\n4 y 5. Permisos por obra, y el PM ve los cambios');
H=fresco(); eval(fs.readFileSync('/home/claude/ijm/App_PM.gs','utf8')); guardarFotos_=()=>'https://x'; H.cache['pm_C']='carlos';
const intenta=(f,t)=>{ try{ f(); ok(false,t+' — lo dejó pasar'); }catch(e){ ok(/no esta asignada|no es de esta obra/.test(e.message), t+' → rechazado'); } };
intenta(()=>pmGasto('C',{proveedor:'Home Depot',obra:'OB-003',monto:999,partida:''}), 'carlos: gasto en la obra de luis');
intenta(()=>pmCerrarDia('C',{obra:'OB-003',partidas:['AR-0006|Rough de plomería'],terminadas:[],cuadrilla:[],subs:[],fotos:[{mime:'x',data:'x'}]}), 'carlos: cierre de día en la obra de luis');
intenta(()=>pmAprobarOT('C','OT-0003'), 'carlos: aprobar el plomero de luis');
intenta(()=>pmBloqueo('C',{obra:'OB-003',tipo:'Otro',descripcion:'aviso en obra ajena'}), 'carlos: aviso en la obra de luis');
intenta(()=>pmManoObra('C',{obra:'OB-003',cuadrilla:[{trabajador:'TRB-01',horas:8}]}), 'carlos: horas en la obra de luis');
intenta(()=>pmCerrarDia('C',{obra:'OB-001',partidas:['AR-0002|Lechada y sellado'],terminadas:[],cuadrilla:[],subs:[{ot:'OT-0003',llego:true}],fotos:[{mime:'x',data:'x'}]}),
  'carlos: marcar "llegó" a un sub de OTRA obra desde su propia obra');
let propia=true; try{ pmGasto('C',{proveedor:'Home Depot',obra:'OB-001',monto:50,partida:''}); }catch(e){ propia=false; }
ok(propia, 'carlos en SU obra sigue trabajando normal');
const ob2=construirDatos_('carlos').obras.find(o=>o.id==='OB-002');
ok(ob2.cambios.length===1 && /isla/.test(ob2.cambios[0].descripcion), 'carlos ve la OC autorizada de OB-002: "'+ob2.cambios[0].descripcion.slice(0,40)+'…"');
ok(!('precio' in ob2.cambios[0]) && !('costo' in ob2.cambios[0]) && !JSON.stringify(ob2.cambios).match(/3400|2150/),
   'sin montos: ni precio, ni costo, ni margen viajan al PM');
ok(ob2.diasExtraOC===4, 'y sabe que la entrega se mueve +4 días');

console.log('\n3. Fecha de captura');
H=fresco(); eval(fs.readFileSync('/home/claude/ijm/App_PM.gs','utf8')); guardarFotos_=()=>'https://x'; H.cache['pm_C']='carlos';
const ayer=new Date(Date.now()-26*3600000);
pmCerrarDia('C',{obra:'OB-001',capturado:ayer.toISOString(),partidas:['AR-0002|Lechada y sellado'],terminadas:[],
  cuadrilla:[{trabajador:'TRB-01',horas:8,partida:'AR-0002|Lechada y sellado'}],subs:[],fotos:[{mime:'x',data:'x'}]});
const bit=H.SHEETS['Bitacora'][H.SHEETS['Bitacora'].length-1];
const mo=H.SHEETS['Mano_Obra'][H.SHEETS['Mano_Obra'].length-1];
ok(fecha_(bit[1])===fecha_(ayer) && fecha_(mo[1])===fecha_(ayer), 'un cierre de ayer enviado hoy queda con fecha de AYER');
ok(fecha_(bit[8])===fecha_(new Date()), 'y el timestamp dice cuándo llegó realmente: el envío tardío queda visible');
let fut; pmGasto('C',{proveedor:'Home Depot',obra:'OB-001',monto:10,partida:'',capturado:new Date(Date.now()+5*86400000).toISOString()});
fut=H.SHEETS['Gastos'][H.SHEETS['Gastos'].length-1];
ok(fut[1]<=new Date(), 'una fecha futura no se acepta: se usa la del servidor');

console.log('\nLas cuatro funciones que estaban rotas en la versión publicada');
H=fresco(); eval(fs.readFileSync('/home/claude/ijm/App_PM.gs','utf8')); guardarFotos_=()=>'https://x'; H.cache['pm_L']='luis';
const corre=(f,t)=>{ try{ const r=f(); ok(r && r.ok!==false, t); }catch(e){ ok(false, t+' — '+e.message); } };
corre(()=>pmInspeccion('L',{obra:'OB-004',hito:'PC1 Post demolición',partida:'Demolición',area:'AR-0009',ok:8,total:8,defectos:[],fotos:[{mime:'x',data:'x'}]}), 'pmInspeccion: inspección del closet guardada');
corre(()=>pmPunch('L',{obra:'OB-003',item:'Silicón disparejo en el vanity',origen:'Defecto'}), 'pmPunch: detalle agregado al punch list');
corre(()=>pmMedida('L','AR-0008',32,0), 'pmMedida: medida del baño de visitas guardada');
corre(()=>({ok:Array.isArray(pmCorregibles('L'))}), 'pmCorregibles: lista de capturas recientes');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
