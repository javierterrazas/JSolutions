// comun/errores.js — Registro de errores inesperados.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

// ------------------------------------------------------ registro de errores
/*
 * Los errores INESPERADOS (un TypeError, una falla de un servicio de Google, una cuota agotada) quedan
 * en la hoja Errores, y el administrador los ve en su app. Los mensajes de negocio ("Faltan: ...")
 * no se registran: son el sistema funcionando.
 */
function registrarError_(nombre, e, args) {
  try {
    if (!e || e.__registrado) return;
    const msg = String(e.message || e);
    const inesperado = e.name !== 'Error' || /Exception|Service|quota|timed out|timeout|Lock|limit/i.test(msg);
    if (!inesperado) return;
    e.__registrado = true;
    let sh = hoja_('Errores');
    if (!sh) { sh = ss_().insertSheet('Errores'); sh.appendRow(['fecha', 'app', 'funcion', 'usuario', 'mensaje', 'detalle']); }
    let quien = '';
    try { quien = args && args[0] ? auth_(args[0]) : ''; } catch (x) { quien = ''; }
    sh.appendRow([new Date(), APP_NOMBRE_, nombre, quien, msg.slice(0, 500), String(e.stack || '').slice(0, 1500)]);
    if (sh.getLastRow() > 1000) sh.deleteRows(2, 200);                  // se conservan los recientes
  } catch (x) { /* registrar nunca debe romper la respuesta */ }
}

function conRegistro_(nombre, fn) {
  return function () {
    try { return fn.apply(this, arguments); } catch (e) { registrarError_(nombre, e, arguments); throw e; }
  };
}

/** Envuelve cada funcion publica (du* / pm*) para que sus errores inesperados queden registrados. */
function envolverPublicas_(prefijo) {
  const g = (function () { return this; })() || globalThis;
  Object.keys(g).filter(k => k.indexOf(prefijo) === 0 && /^[a-z]{2}[A-Z]/.test(k) && typeof g[k] === 'function' && !g[k].__envuelta)
    .forEach(k => { const w = conRegistro_(k, g[k]); w.__envuelta = true; g[k] = w; });
}
