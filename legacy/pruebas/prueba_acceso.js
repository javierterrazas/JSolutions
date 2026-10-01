const H = require('/tmp/harness.js');
eval(require('fs').readFileSync('/home/claude/ijm/App_PM.gs','utf8') + '\nfunction __limpiar(){ for (const k in _memo) delete _memo[k]; }');
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };

console.log('\nEntrar con nombre de usuario');
ok(pmLogin('carlos','2468').ok, '"carlos" + PIN entra');
ok(pmLogin('  Carlos ','2468').ok, 'sin importar mayúsculas ni espacios');
ok(!pmLogin('javier','482915').ok && /solo para Project/.test(pmLogin('javier','482915').msg),
   'el dueño no entra por la app del PM');

console.log('\nLímite de intentos');
const r1 = pmLogin('luis','0000');
ok(r1.msg==='Usuario o PIN incorrectos.', 'primer fallo, mensaje neutro');
pmLogin('luis','0000'); pmLogin('luis','0000');
const r4 = pmLogin('luis','0000');
ok(/Te queda 1 intento\./.test(r4.msg), 'avisa cuando queda uno: "'+r4.msg+'"');
pmLogin('luis','0000');
const bloq = pmLogin('luis','1357');
ok(!bloq.ok && bloq.bloqueado, 'al sexto intento, con el PIN CORRECTO, sigue bloqueado');
ok(pmLogin('carlos','2468').ok, 'el bloqueo es por usuario: carlos entra normal');
const fant = pmLogin('noexiste','1111');
ok(fant.msg==='Usuario o PIN incorrectos.', 'un usuario que no existe recibe el mismo mensaje (no revela quién está)');

console.log('\nUn acceso exitoso reinicia el contador');
pmLogin('carlos','9999'); pmLogin('carlos','9999'); pmLogin('carlos','2468');
pmLogin('carlos','9999'); pmLogin('carlos','9999'); pmLogin('carlos','9999');
ok(pmLogin('carlos','2468').ok, 'tres fallos después de entrar no bloquean: el contador se reinició');

console.log('\nCorreo de avisos');
ok(correoDueno_()==='javier@ijm.com', 'los avisos van a correo_avisos, no al usuario');
const u = H.SHEETS['Usuarios']; const fila = u.findIndex(r=>r[3]==='admin');
u[fila][7] = '';
__limpiar();
ok(correoDueno_()==='', 'sin correo_avisos y con usuario sin @: no hay a dónde mandar');
u[fila][0] = 'javier@ijm.com'; __limpiar();
ok(correoDueno_()==='javier@ijm.com', 'compatibilidad: si el usuario es un correo, sirve de respaldo');
console.log('\n'+(fallas? fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
