process.env.TZ='America/Chicago';
const fs=require('fs'), vm=require('vm');
const RealDate=Date; let AHORA=new RealDate('2026-10-05T08:00:00').getTime();
class FD extends RealDate{ constructor(...a){ if(!a.length) super(AHORA); else super(...a); } static now(){ return AHORA; } }
global.Date=FD;
const H=require('/tmp/harness.js');
['Proyectos','Areas','Avance','Mano_Obra','Bitacora','Ordenes_Trabajo','Ordenes_Cambio','Partidas_Obra','Plan_Semanal','Presupuesto','Calidad','Correcciones'].forEach(h=>{ if(H.SHEETS[h]) H.SHEETS[h].length=1; });
function servidor(archivo){ const cache={}, pr={};
  const ctx={ PropertiesService:{getScriptProperties(){return {getProperty:k=>(k in pr?pr[k]:null),setProperty(k,v){pr[k]=String(v);}};}},
    SpreadsheetApp, Session, Utilities, LockService, MailApp:{sendEmail(){}}, Logger, HtmlService:{}, DriveApp:{},
    CacheService:{ getScriptCache(){ return { get:k=>cache[k]||null, put:(k,v)=>{cache[k]=v;}, remove:k=>{delete cache[k];} }; } },
    console, JSON, Math, Date:FD, String, Number, Array, Object, RegExp, parseInt, isNaN, Error };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync('/home/claude/ijm/'+archivo,'utf8')+'\nfunction __n(){for(const k in _memo) delete _memo[k];}', ctx);
  ctx.guardarFotos_=()=>'x'; return ctx; }
const A=servidor('App_Dueno.gs'), P=servidor('App_PM.gs');
const ll=(S,f,...a)=>{ S.__n(); return S[f](...a); }, falla=(S,f,...a)=>{ try{ ll(S,f,...a); return ''; }catch(e){ return e.message; } };
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const fecha_=d=>{ const x=new Date(d); return String(x.getMonth()+1).padStart(2,'0')+'/'+String(x.getDate()).padStart(2,'0')+'/'+x.getFullYear(); };
const en=(dia,hora)=>{ AHORA=new RealDate(dia+'T'+hora+':00').getTime(); };
en('2026-10-02','10:00'); let ta=ll(A,'duLogin','javier','482915').token;
const o=ll(A,'duNuevaObra',ta,{telefono:'512-555-0100',cliente:'Familia Garza',direccion:'Austin',pm:'carlos',inicio:'2026-10-05',finEst:'2026-10-30',contrato:24000,areas:[{tipo:'Baño',nombre:'Baño',pies2:45}]});
const ar=H.SHEETS['Areas'].slice(1).find(a=>a[1]===o.id && a[2]==='Baño');
ll(A,'duGuardarPresupuesto',ta,o.id,[{area:ar[0],partida:'Tile de piso y muro',monto:3600,cantidad:45,unidad:'pie2'}]);
const kDemo=ar[0]+'|Demolición y retiro de escombro';
const cierre=(extra)=>Object.assign({obra:o.id,partidas:[kDemo],terminadas:[],cuadrilla:[{trabajador:'TRB-01',horas:8,partida:kDemo}],subs:[],fotos:[{mime:'x',data:'x'}]},extra||{});
en('2026-10-05','16:00'); let tp=ll(P,'pmLogin','carlos','2468').token;
ll(P,'pmCerrarDia',tp,cierre());                                   // lunes: cierra
console.log('\nEl martes se le olvidó. Miércoles 7 a.m. abre la app');
en('2026-10-07','07:00'); tp=ll(P,'pmLogin','carlos','2468').token;
let od=ll(P,'pmDatos',tp).obras.find(x=>x.id===o.id);
ok(od.diasSinCierre.length===1 && od.diasSinCierre[0].iso==='2026-10-06', 'la app le avisa: "te faltó cerrar el martes 06"');
ok(/inspeccion PC1/.test(falla(P,'pmCerrarDia',tp,cierre({tardio:'2026-10-06',terminadas:[kDemo]}))), 'cerrar tarde no brinca la calidad: terminar la demolición sin su inspección se rechaza');
let r=ll(P,'pmCerrarDia',tp,cierre({tardio:'2026-10-06'}));
const bit=H.SHEETS['Bitacora'].slice(-1)[0], mo=H.SHEETS['Mano_Obra'].slice(-1)[0], av=H.SHEETS['Avance'].slice(-1)[0];
ok(fecha_(bit[1])==='10/06/2026' && fecha_(mo[1])==='10/06/2026' && !H.SHEETS['Avance'].slice(1).some(a=>fecha_(a[1])==='10/07/2026'), 'bitácora y horas quedan con fecha del martes; nada queda con fecha del miércoles');
ok(bit[10]==='SI' && fecha_(bit[8])==='10/07/2026', 'marcado "cerrado tarde", con la fecha real en que se envió');
ok(ll(P,'pmDatos',tp).obras.find(x=>x.id===o.id).diasSinCierre.length===0, 'y el aviso desaparece');
ok(/ya tiene cierre/.test(falla(P,'pmCerrarDia',tp,cierre({tardio:'2026-10-06'}))), 'no se puede cerrar dos veces el mismo día');
ok(/ultimos 2 dias habiles/.test(falla(P,'pmCerrarDia',tp,cierre({tardio:'2026-10-02'}))), 'un día de hace más de 2 días hábiles: se lo pide al administrador');
ok(/no puede pasar de un dia|maximo es 16/.test(falla(P,'pmCerrarDia',tp,cierre({tardio:'2026-10-05',cuadrilla:[{trabajador:'TRB-01',horas:10,partida:kDemo}]}))) ||
   /ya tiene cierre/.test(falla(P,'pmCerrarDia',tp,cierre({tardio:'2026-10-05'}))), 'las horas se validan contra la fecha del día cerrado');
console.log('\nLunes siguiente, olvidó el viernes');
en('2026-10-09','16:00'); tp=ll(P,'pmLogin','carlos','2468').token; ll(P,'pmCerrarDia',tp,cierre({partidas:[ar[0]+'|Rough de plomería'],terminadas:[],cuadrilla:[]}));
en('2026-10-12','07:00'); tp=ll(P,'pmLogin','carlos','2468').token;
od=ll(P,'pmDatos',tp).obras.find(x=>x.id===o.id);
ok(od.diasSinCierre.map(x=>x.iso).join()==='2026-10-08', 'el lunes le avisa del jueves 08 (el viernes sí cerró): brinca el fin de semana');
console.log('\nTú registras un día más viejo');
en('2026-10-16','09:00'); ta=ll(A,'duLogin','javier','482915').token;
ok(/Escribe por que/.test(falla(A,'duCierreTardio',ta,o.id,{fecha:'2026-10-08',partidas:[kDemo]})), 'sin motivo no se puede');
ok(!falla(A,'duCierreTardio',ta,o.id,{fecha:'2026-10-08',partidas:[ar[0]+'|Rough de plomería'],cuadrilla:[{trabajador:'TRB-01',horas:8}],motivo:'El PM me lo dictó por teléfono'}), 'el jueves 08, con motivo: registrado');
const bA=H.SHEETS['Bitacora'].slice(-1)[0];
ok(fecha_(bA[1])==='10/08/2026' && bA[10]==='SI' && /Registrado por el administrador/.test(bA[6]) && H.SHEETS['Correcciones'].some(c=>/Dia olvidado/.test(String(c[5]))), 'queda en su fecha, marcado tarde, con su rastro en Correcciones');
ok(/inspeccion/.test(falla(A,'duCierreTardio',ta,o.id,{fecha:'2026-10-13',partidas:[ar[0]+'|Blocking y framing'],terminadas:[ar[0]+'|Blocking y framing'],motivo:'x'})), 'tampoco deja terminar una partida con punto de control sin su inspección');
console.log('\nLa tasa de cierre');
en('2026-10-09','08:00'); ta=ll(A,'duLogin','javier','482915').token;
const k=ll(A,'duDatos',ta).kpis.find(x=>/Tasa de cierre/.test(x.nombre));
ok(Math.abs(k.real-0.75)<0.001, 'viernes 9: lunes, martes (tarde) y jueves (por ti) cuentan como cerrados; el miércoles no → '+Math.round(k.real*100)+'%');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
