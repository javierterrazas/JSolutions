// Base de la simulacion: reloj simulado, los dos proyectos de Apps Script y registro de hallazgos.
// Correr con TZ=America/Chicago para que las horas sean las de Austin.
const fs = require('fs'), vm = require('vm');

// ---------------------------------------------------------------- reloj simulado
const RealDate = Date;
let AHORA = new RealDate('2026-10-05T07:00:00').getTime();
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(AHORA); else super(...a); }
  static now() { return AHORA; }
}
FakeDate.UTC = RealDate.UTC; FakeDate.parse = RealDate.parse;
global.Date = FakeDate;
const reloj = {
  fija(fechaISO, hora) { AHORA = new RealDate(fechaISO + 'T' + hora + ':00').getTime(); },
  mas(min) { AHORA += min * 60000; },
  ahora() { return new RealDate(AHORA); }
};

// ---------------------------------------------------------------- libro limpio: solo catalogos
const H = require('/tmp/harness.js');
const TRANSACCIONALES = ['Proyectos', 'Areas', 'Bitacora', 'Avance', 'Gastos', 'Mano_Obra', 'Ordenes_Trabajo',
  'Bloqueos', 'Ordenes_Cambio', 'Pagos_Sub', 'Presupuesto', 'Cobros', 'Punch_List', 'Calidad', 'Pruebas_Agua',
  'Entrega', 'No_Calidad', 'Correcciones', 'Obras_Cerradas'];
TRANSACCIONALES.forEach(h => { if (H.SHEETS[h]) H.SHEETS[h].length = 1; else console.log('  (no existe la hoja ' + h + ')'); });

// ---------------------------------------------------------------- dos proyectos, cada uno con su cache
const CORREOS = [];
function cacheConVencimiento() {
  const m = {};
  return { get: k => { const e = m[k]; if (!e) return null; if (e.exp && AHORA > e.exp) { delete m[k]; return null; } return e.v; },
           put: (k, v, s) => { m[k] = { v: v, exp: s ? AHORA + s * 1000 : 0 }; }, remove: k => { delete m[k]; } };
}
function servidor(archivo) {
  const cache = cacheConVencimiento();
  const props = {};                                   // cada proyecto de Apps Script tiene las suyas
  const ctx = { SpreadsheetApp, Session, Utilities, LockService, Logger, HtmlService: {}, DriveApp: {},
    PropertiesService: { getScriptProperties() { return { getProperty: k => (k in props ? props[k] : null), setProperty(k, v) { props[k] = String(v); } }; } },
    MailApp: { sendEmail(a, s, c) { CORREOS.push({ cuando: reloj.ahora(), para: a, asunto: s, cuerpo: c }); } },
    CacheService: { getScriptCache() { return cache; } },
    console: { log() {}, error() {} }, JSON, Math, Date: FakeDate, String, Number, Array, Object, RegExp, parseInt, isNaN, Error };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('/home/claude/ijm/' + archivo, 'utf8') +
    '\nfunction __n(){ for (const k in _memo) delete _memo[k]; }', ctx);
  ctx.guardarFotos_ = (fotos, pref) => fotos.map((f, i) => 'https://drive.fake/' + pref + '_' + i).join(' | ');
  return ctx;
}
const ADMIN = servidor('App_Dueno.gs'), PMSRV = servidor('App_PM.gs');

// ---------------------------------------------------------------- registro
const DIARIO = [], HALLAZGOS = [];
let DIA_TXT = '';
function diario(txt) { DIARIO.push(DIA_TXT + ' ' + txt); }
function hallazgo(sev, titulo, detalle) {
  const clave = titulo;
  const ya = HALLAZGOS.find(h => h.titulo === clave);
  if (ya) { ya.veces++; return; }
  HALLAZGOS.push({ sev, titulo: clave, detalle, dia: DIA_TXT, veces: 1 });
}
// cada llamada del telefono es una ejecucion nueva de Apps Script
function llama(S, fn, ...args) { S.__n(); return S[fn](...args); }
// llamada "normal": si truena sin que el escenario lo espere, es un hallazgo
function haz(quien, S, fn, args, esperado) {
  try {
    const r = llama(S, fn, ...args);
    if (esperado) hallazgo('MEDIA', 'Se esperaba un rechazo que no ocurrió: ' + fn, quien + ' · esperaba /' + esperado.source + '/');
    return r;
  } catch (e) {
    const msg = String(e && e.message || e);
    if (esperado && esperado.test(msg)) return { rechazado: true, msg };
    if (/Sesion expirada/.test(msg)) return { sesionVencida: true, msg };
    hallazgo('ALTA', 'Error inesperado en ' + fn, quien + ' → ' + msg.slice(0, 220));
    return null;
  }
}
const foto = (n) => Array.from({ length: n || 1 }, () => ({ mime: 'image/jpeg', data: 'x', tomada: reloj.ahora().toISOString() }));
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

module.exports = { reloj, H, ADMIN, PMSRV, CORREOS, DIARIO, HALLAZGOS, diario, hallazgo, llama, haz, foto, iso,
  setDia(t) { DIA_TXT = t; }, RealDate };
