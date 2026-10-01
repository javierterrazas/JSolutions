// comun/datos.js — Acceso al libro: hojas, lecturas con memoria, fechas.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

/**
 * IJM - CONTROL DE OBRA (app del dueno)
 * Procesos 3 (control diario) y 4 (ordenes de cambio).
 *
 * Esta app ve TODO: montos, margenes, costos y KPIs.
 * Se despliega como un proyecto de Apps Script SEPARADO del de campo.
 *
 * Instalacion: ver INSTALACION.md
 */

const SS_ID = 'PEGAR_AQUI_EL_ID_DEL_SPREADSHEET';

const _memo = {};

function ss_() {
  if (!_ss) _ss = SpreadsheetApp.openById(SS_ID);
  return _ss;
}

function hoja_(n) { return ss_().getSheetByName(n); }

/** Lee una hoja una sola vez por ejecucion y deja fuera lo anulado. */
function datos_(nombre) {
  if (_memo[nombre]) return _memo[nombre];
  const sh = hoja_(nombre);
  if (!sh) return (_memo[nombre] = []);            // hoja nueva que el libro todavia no tiene
  const v = sh.getDataRange().getValues();
  v.shift();
  let filas = v.filter(r => String(r[0]).trim() !== '');
  if (ANULABLE.hasOwnProperty(nombre)) {
    const col = ANULABLE[nombre];
    filas = filas.filter(r => String(r[col]) !== 'Anulado');
  }
  _memo[nombre] = filas;
  return filas;
}

function fecha_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'MM/dd/yyyy');
  }
  return String(v);
}

// ------------------------------------------------------------- correcciones
/*
 * Nada se borra. Un registro equivocado se ANULA (queda en la hoja, sale de
 * todos los calculos) o se EDITA campo por campo. Las dos cosas dejan rastro
 * en la hoja Correcciones, con motivo obligatorio.
 */

// hoja -> indice (base 0) de la columna de estado
const ANULABLE = { 'Gastos': 13, 'Avance': 7, 'Bitacora': 9, 'Mano_Obra': 8,
                   'Cobros': 9, 'Pagos_Sub': 11 };
