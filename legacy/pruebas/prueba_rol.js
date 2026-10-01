const fs=require('fs');
let fallas=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fallas++; };
for (const rol of ['admin','administrador','dueno','Admin ']) {
  delete require.cache[require.resolve('/tmp/harness.js')];
  const H=require('/tmp/harness.js');
  H.SHEETS['Usuarios'][1][3]=rol;
  eval(fs.readFileSync('/home/claude/ijm/App_Dueno.gs','utf8'));
  const r=duLogin('javier','482915');
  ok(r.ok, 'rol "'+rol+'" entra a la app del administrador');
  ok(correoDueno_()==='javier@ijm.com', '   y los avisos le siguen llegando');
}
delete require.cache[require.resolve('/tmp/harness.js')];
const H=require('/tmp/harness.js');
eval(fs.readFileSync('/home/claude/ijm/App_Dueno.gs','utf8'));
const r=duLogin('carlos','2468');
ok(!r.ok && /solo para administradores/.test(r.msg), 'un PM que intenta entrar lee: "'+r.msg+'"');
console.log('\n'+(fallas?fallas+' FALLAS':'TODO BIEN')); process.exit(fallas?1:0);
