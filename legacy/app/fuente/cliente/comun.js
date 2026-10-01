// cliente/comun.js — lo que comparten las dos pantallas. Después de editar, corre construir.py.

function $(id){ return document.getElementById(id); }

/* PIN oculto por seguridad; el ojo lo muestra un momento para revisar lo tecleado
   (con el bloqueo tras 5 intentos, no poder revisarlo cuesta caro) */
function verPin(btn){
  var i=document.getElementById('lPin'), oculto=i.type==='password';
  i.type = oculto ? 'text' : 'password';
  btn.title = oculto ? 'Ocultar PIN' : 'Mostrar PIN';
  btn.style.opacity = oculto ? '1' : '.75';
  i.focus();
}

function pinOculto(){ var i=document.getElementById('lPin'); if(i) i.type='password'; }

/* ------------------------------------------------ campos obligatorios */
// marca en rojo los que faltan y regresa sus nombres; el rojo se quita en cuanto escribes
function marcarFaltantes(campos){
  var faltan=[];
  campos.forEach(function(c){ var e=$(c[0]); if(!e) return; var v=String(e.value||'').trim();
    var mal = !v || (c[2]==='num' && !(Number(v)>0)) || (c[2]==='tel' && v.replace(/\D/g,'').length<10);
    e.classList.toggle('falta', mal); if(mal) faltan.push(c[1]); });
  return faltan;
}

/** Cualquier campo que ya no tiene su valor original, incluidas listas y casillas: alguien lo esta llenando. */
function formularioSucio(){
  var campos = document.querySelectorAll('#vista input, #vista textarea, #vista select');
  for(var k=0;k<campos.length;k++){ var c=campos[k];
    if(c.type==='hidden' || c.type==='file') continue;
    if(c.tagName==='SELECT'){ for(var j=0;j<c.options.length;j++) if(c.options[j].selected!==c.options[j].defaultSelected) return true; continue; }
    if(c.type==='checkbox' || c.type==='radio'){ if(c.checked!==c.defaultChecked) return true; continue; }
    if(c.value!==c.defaultValue) return true;
  }
  return false;
}

// la rueda del raton sobre un campo de numero lo cambiaba sin avisar (un precio de $1,500 se volvia $1,497):
// ahora la rueda mueve la pagina y el numero se queda como lo escribiste
document.addEventListener('wheel', function(ev){
  var e = document.activeElement;
  if(e && e.type === 'number' && e === ev.target) e.blur();
}, { passive:true });

// el tipo baño, con o sin ñ: los libros anteriores dicen "Bano"
function esBano(t){ return String(t||'').replace(/ñ/g,'n').replace(/Ñ/g,'N').toLowerCase().trim() === 'bano'; }
