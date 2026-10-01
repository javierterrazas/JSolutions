const fs=require('fs');
const js=fs.readFileSync('/home/claude/ijm/PM.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const saca=n=>{ const i=js.indexOf('function '+n+'('); let d=0; for(let k=js.indexOf('{',i);k<js.length;k++){
  if(js[k]==='{')d++; else if(js[k]==='}'){ if(--d===0) return js.slice(i,k+1); } } };
var IDIOMA='es';
eval(saca('fechaExif')+saca('textoAFecha')+saca('fotosDeOtroDia'));
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
const lee=f=>{ const b=fs.readFileSync(f); return fechaExif(b.buffer.slice(b.byteOffset,b.byteOffset+b.length)); };
const txt=d=>d? d.toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : 'sin fecha';

console.log('\nLeer la fecha en que se tomó la foto');
let d=lee('/tmp/f_android.jpg');
ok(d && d.getDate()===21 && d.getHours()===15 && d.getMinutes()===12, 'Android (bytes "II", detrás de JFIF): '+txt(d));
ok(d && d.getDate()!==20, 'usa la fecha de TOMA, no la de modificación del archivo');
d=lee('/tmp/f_iphone.jpg');
ok(d && d.getDate()===22 && d.getHours()===17 && d.getMinutes()===45, 'iPhone (bytes "MM"): '+txt(d));
d=lee('/tmp/f_general.jpg');
ok(d && d.getDate()===19, 'si solo trae la fecha general, usa esa: '+txt(d));
ok(lee('/tmp/f_sinexif.jpg')===null, 'JPEG sin datos de fecha: no asume nada');
ok(lee('/tmp/f_captura.png')===null, 'captura de pantalla (PNG): no asume nada');
ok(fechaExif(new ArrayBuffer(3))===null && fechaExif(new Uint8Array([0xFF,0xD8,0xFF,0xE1,0,4,1,2]).buffer)===null,
   'un archivo cortado o dañado no truena');

console.log('\nEl aviso de "otra fecha"');
const hoy=new Date(), ayer=new Date(Date.now()-86400000);
ok(fotosDeOtroDia([{tomada:hoy.toISOString()},{tomada:''}])===null, 'fotos de hoy (o sin fecha): sin aviso');
const r=fotosDeOtroDia([{tomada:hoy.toISOString()},{tomada:ayer.toISOString()},{tomada:ayer.toISOString()}]);
ok(r && r.n===2, 'dos fotos de ayer entre tres: avisa de 2 ('+r.fechas+')');
IDIOMA='en'; const r2=fotosDeOtroDia([{tomada:ayer.toISOString()}]);
IDIOMA='es'; const r3=fotosDeOtroDia([{tomada:ayer.toISOString()}]);
ok(r2.fechas!==r3.fechas, 'la fecha del aviso sale en el formato de cada idioma: "'+r3.fechas+'" / "'+r2.fechas+'"');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
