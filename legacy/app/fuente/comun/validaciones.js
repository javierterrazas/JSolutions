// comun/validaciones.js — Datos obligatorios, horas de cuadrilla y numeración de registros.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

/*
 * Un trabajador por dia se registra como dia completo o medio dia, y la suma de todas las
 * obras en la misma fecha no puede pasar de un dia (ni de 16 horas si cobra por hora).
 * Sin esto, anotarlo completo en las dos obras de un PM lo cobraba doble.
 * excluirId: al corregir, el registro que se esta cambiando no cuenta contra si mismo.
 */
function validarHoras_(trabajadorId, fecha, horasNuevas, excluirId) {
  const t = datos_(SH.TRABAJADORES).find(x => x[0] === trabajadorId);
  if (!t) return;
  const porDia = String(t[3]) === 'Por dia';
  const h = Number(horasNuevas) || 0;
  if (porDia && h !== 0.5 && h !== 1) {
    throw new Error(t[1] + ' cobra por dia: se registra como dia completo o medio dia.');
  }
  const dia = fecha_(fecha);
  const previos = datos_(SH.MANO_OBRA).filter(r => r[3] === trabajadorId && r[0] !== excluirId && fecha_(r[1]) === dia);
  const ya = previos.reduce((a, r) => a + (Number(r[5]) || 0), 0);
  const obras = previos.map(r => r[2]).filter((v, i, a) => a.indexOf(v) === i).join(', ');
  if (porDia && ya + h > 1) {
    throw new Error(t[1] + ' ya tiene ' + (ya === 1 ? 'un dia completo' : 'medio dia') + ' registrado el ' + dia +
      (obras ? ' en ' + obras : '') + '. Un trabajador por dia no puede pasar de un dia sumando todas las obras.');
  }
  if (!porDia && ya + h > 16) {
    throw new Error(t[1] + ' ya tiene ' + ya + ' h registradas el ' + dia + (obras ? ' en ' + obras : '') +
      '; con estas serian ' + (ya + h) + ' h. El maximo es 16 al dia.');
  }
}

function validarCuadrilla_(lista, fecha) {
  const suma = {};                                    // el mismo trabajador dos veces en la misma captura
  (lista || []).forEach(t => {
    if (!t.trabajador || !(Number(t.horas) > 0)) return;
    suma[t.trabajador] = (suma[t.trabajador] || 0) + Number(t.horas);
  });
  Object.keys(suma).forEach(id => validarHoras_(id, fecha, suma[id], null));
}

/** Junta TODOS los datos que faltan en un solo mensaje: "Faltan: cliente, fecha de entrega." */
function exigir_(pares) {
  const faltan = pares.filter(x => x[0] === undefined || x[0] === null || String(x[0]).trim() === '').map(x => x[1]);
  if (faltan.length) throw new Error('Faltan: ' + faltan.join(', ') + '.');
}

/*
 * El numero mas alto de la columna A (PRE-0012 -> 12). NO se lee el ultimo renglon: en Google Sheets
 * el ultimo renglon incluye notas sin ID (como las que trae la plantilla debajo de los ejemplos), y
 * leerlo reiniciaba la numeracion en 1 y repetia IDs existentes.
 */
function maxNum_(sh, ultima) {
  const ult = ultima === undefined ? sh.getLastRow() : ultima;      // quien ya la conoce, la pasa: una consulta menos
  if (ult < 2) return 0;
  let n = 0;
  sh.getRange(1, 1, ult, 1).getValues().forEach(r => {
    const m = String(r[0]).trim().match(/^[A-Z]+-(\d+)$/);
    if (m) n = Math.max(n, parseInt(m[1], 10));
  });
  return n;
}
