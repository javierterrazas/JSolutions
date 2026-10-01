// ARCHIVO GENERADO por construir.py a partir de fuente/. No lo edites aquí: tus cambios se perderían
// en la siguiente construcción. Edita fuente/ y vuelve a correr: python3 construir.py

// pm/config.js
// Solo de la app del PM. Lo compartido está en comun/. Después de editar, corre construir.py.

// lo que distingue a esta app en el código compartido
const APP_NOMBRE_ = 'PM';

const PREFIJO_SESION_ = 'pm_';

const SH = {
  CONFIG: 'Config', USUARIOS: 'Usuarios', PROYECTOS: 'Proyectos',
  PARTIDAS: 'Partidas_Catalogo', SUBS: 'Subcontratistas', BITACORA: 'Bitacora',
  AVANCE: 'Avance', GASTOS: 'Gastos', OT: 'Ordenes_Trabajo',
  BLOQUEOS: 'Bloqueos', TRABAJADORES: 'Trabajadores', MANO_OBRA: 'Mano_Obra',
  CHECKLIST: 'Checklist_Calidad', CALIDAD: 'Calidad', AGUA: 'Pruebas_Agua',
  PUNCH: 'Punch_List', ENTREGA: 'Entrega', AREAS: 'Areas', PARTIDAS_OBRA: 'Partidas_Obra', PLAN_SEMANAL: 'Plan_Semanal', OC: 'Ordenes_Cambio'
};

const MOTIVOS_SIN_TRABAJO = ['Esperando fabricación', 'Esperando a un sub', 'Esperando material',
  'Esperando inspección', 'Clima', 'Cliente no disponible', 'Otro'];

// acciones que se pueden hacer con 'guardar y ver' en un solo viaje (generada al transformar las pantallas)
const HACER_PM_ = ['pmAnular', 'pmAnularCierre', 'pmAprobarOT', 'pmCerrarDia', 'pmCerrarPunch', 'pmConfirmarOT', 'pmCorregir', 'pmInspeccion', 'pmMedida', 'pmPruebaFin', 'pmPruebaInicio', 'pmPunch', 'pmSubirRecibo'];

// comun/acceso.js — Sesiones firmadas y verificación de usuarios.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

// ------------------------------------------------------------ sesiones firmadas
/*
 * CacheService no guarda nada mas de 6 horas y la jornada de un PM dura 9: la sesion
 * vencia justo en el cierre de dia. Ahora el pase lleva su propio vencimiento, firmado
 * con un secreto del proyecto, y no se guarda en ningun lado. En cada llamada se revisa
 * ademas que el usuario siga activo: darlo de baja le corta el acceso en ese momento.
 */
const HORAS_SESION = { pm_: 16, du_: 12 };

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

// ------------------------------------------------------------- correcciones
/*
 * Nada se borra. Un registro equivocado se ANULA (queda en la hoja, sale de
 * todos los calculos) o se EDITA campo por campo. Las dos cosas dejan rastro
 * en la hoja Correcciones, con motivo obligatorio.
 */

// hoja -> indice (base 0) de la columna de estado
const ANULABLE = { 'Gastos': 13, 'Avance': 7, 'Bitacora': 9, 'Mano_Obra': 8,
                   'Cobros': 9, 'Pagos_Sub': 11 };

// comun/utilidades.js — Funciones compartidas de uso general.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

let _ss = null;

// hoja -> campos editables con su columna (base 1)
const EDITABLE = {
  'Gastos':    { monto: 7, partida: 13, categoria: 4, proveedor: 5, descripcion: 6, proyecto_id: 3 },
  'Mano_Obra': { horas: 6, partida: 5, proyecto_id: 3 },
  'Bitacora':  { incidencia: 7, partidas: 5 },
  'Cobros':    { monto: 5, concepto: 4, referencia: 7 },
  'Pagos_Sub': { monto: 7, concepto: 6, referencia: 9 },
  'Avance':    {}
};

// hoja -> indices (base 0) de quien lo capturo, cuando, y de que obra es
const META = {
  'Gastos':    { usuario: 10, fecha: 1, obra: 2 },
  'Mano_Obra': { usuario: 6,  fecha: 1, obra: 2 },
  'Avance':    { usuario: 5,  fecha: 1, obra: 2 },
  'Bitacora':  { usuario: 3,  fecha: 1, obra: 2 },
  'Cobros':    { usuario: 7,  fecha: 1, obra: 2 },
  'Pagos_Sub': { usuario: 9,  fecha: 1, obra: 3 }
};

// ------------------------------------------------------------------- areas
/*
 * El proyecto es la unidad comercial (cliente, contrato, entrega).
 * El area es la unidad tecnica (secuencia, pies2, costos, calidad).
 * Toda partida se identifica por AREA + nombre: "Rough de plomería" del bano
 * y la de la cocina son trabajos distintos y nunca se mezclan.
 */

// indice (base 0) de area_id en cada hoja
const COL_AREA = { 'Presupuesto': 7, 'Avance': 8, 'Gastos': 14, 'Mano_Obra': 9,
                   'Ordenes_Trabajo': 14, 'Calidad': 12, 'Pruebas_Agua': 9 };

// ------------------------------------------------------------------- acceso
/*
 * El usuario puede ser un nombre ("carlos") o un correo: es solo el texto
 * con el que se entra. Los correos de aviso salen de la columna correo_avisos.
 *
 * Limite de intentos: 5 fallidos seguidos bloquean ese usuario 15 minutos.
 * Un PIN de 4 digitos son 10,000 combinaciones; sin limite, se adivina.
 * El mensaje de error es el mismo exista o no el usuario, para no revelar
 * quien esta dado de alta.
 */
const MAX_INTENTOS = 5;

const BLOQUEO_SEG = 900;

/*
 * Nombres sin importar acentos ni ñ: "Rough de plomeria" y "Rough de plomería" son la misma partida, y
 * "Bano" y "Baño" el mismo tipo. Los libros anteriores tienen los nombres sin acentos: siguen funcionando.
 * (Sin normalize(): una tabla explicita, igual en cualquier motor.)
 */
const SIN_ACENTOS_ = { 'á':'a','é':'e','í':'i','ó':'o','ú':'u','ü':'u','ñ':'n','Á':'a','É':'e','Í':'i','Ó':'o','Ú':'u','Ü':'u','Ñ':'n' };

function secretoSesion_() {
  const pr = PropertiesService.getScriptProperties();
  let s = pr.getProperty('SECRETO_SESION');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); pr.setProperty('SECRETO_SESION', s); }
  return s;
}

function firmar_(texto) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(texto, secretoSesion_()));
}

function crearPase_(prefijo, usuario) {
  const cuerpo = Utilities.base64EncodeWebSafe(prefijo + '|' + usuario + '|' + (Date.now() + HORAS_SESION[prefijo] * 3600000));
  return cuerpo + '.' + firmar_(cuerpo);
}

function leerPase_(prefijo, token) {
  const t = String(token || ''), i = t.lastIndexOf('.');
  if (i < 1) return null;
  const cuerpo = t.slice(0, i);
  if (firmar_(cuerpo) !== t.slice(i + 1)) return null;
  let partes;
  try { partes = Utilities.newBlob(Utilities.base64DecodeWebSafe(cuerpo)).getDataAsString().split('|'); }
  catch (e) { return null; }
  if (partes.length < 3 || partes[0] !== prefijo || Number(partes[partes.length - 1]) < Date.now()) return null;
  return partes.slice(1, -1).join('|');
}

function auth_(token) {
  // pase firmado; o una sesion de antes del cambio, que sigue valida hasta vencer
  const usuario = leerPase_(PREFIJO_SESION_, token) || CacheService.getScriptCache().get(PREFIJO_SESION_ + token);
  if (!usuario || !usuarioActivo_(usuario)) throw new Error('Sesion expirada. Vuelve a entrar.');
  return usuario;
}

// comun/cronograma.js — El motor del cronograma: plan y previsión.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

// ------------------------------------------------------------------ cronograma
/*
 * El cronograma se calcula, no se dibuja. Cada partida trae duracion (dias habiles), quien la
 * hace, si arranca junto con la anterior y los dias de espera antes (fabricacion del countertop,
 * del vidrio). Con eso y la fecha de inicio sale el PLAN; con lo que el PM reporta cada dia sale
 * la PREVISION: si algo se atrasa, todo lo que sigue se recorre y la entrega prevista se mueve
 * antes de que pase. Los espacios corren en paralelo; la ultima partida de Generales (limpieza
 * final) va despues de todos.
 */
function datosCrono_(c) {
  return { dias: Math.max(1, Number(c[5]) || 1), quien: String(c[6] || '').trim() || 'Cuadrilla',
           paralelo: String(c[7] || '').toUpperCase() === 'SI', espera: Math.max(0, Number(c[8]) || 0) };
}

function esSub_(quien) { return ['cuadrilla', 'pm', ''].indexOf(String(quien || '').trim().toLowerCase()) < 0; }

function hab0_(d) {                                   // mismo dia; si cae en fin de semana, el lunes
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1);
  return x;
}

function masHab_(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  let k = 0;
  while (k < n) { x.setDate(x.getDate() + 1); if (x.getDay() !== 0 && x.getDay() !== 6) k++; }
  return x;
}

/** areas: [{id, nombre, generales, lista}] · real: {area|partida: {ini, fin}} · hoy: null = plan puro */
function calcularCrono_(inicio, areas, real, hoy) {
  const filas = [];
  const cadena = (ar, lista, arranque, todosParalelos) => {
    let base0 = arranque, finGrupo = null, fin = null;
    lista.forEach((c, i) => {
      const cr = datosCrono_(c);
      const paralelo = todosParalelos || (i > 0 && cr.paralelo);
      if (i > 0 && !paralelo) { base0 = masHab_(finGrupo, 1); finGrupo = null; }
      let ini = cr.espera ? masHab_(base0, cr.espera) : base0;
      fin = masHab_(ini, cr.dias - 1);
      const r = real[ar.id + '|' + c[2]];
      let estado = 'Sin iniciar';
      if (r && r.fin) { ini = hab0_(r.ini || r.fin); fin = hab0_(r.fin); estado = 'Terminada'; }
      else if (r && r.ini) { ini = hab0_(r.ini); fin = masHab_(ini, cr.dias - 1); if (hoy && fin < hoy) fin = hoy; estado = 'En progreso'; }
      else if (hoy && ini < hoy) { ini = hoy; fin = masHab_(ini, cr.dias - 1); }   // lo pendiente no arranca en el pasado
      finGrupo = (!finGrupo || fin > finGrupo) ? fin : finGrupo;
      filas.push({ area: ar.id, areaNombre: ar.nombre, partida: c[2], quien: cr.quien, dias: cr.dias,
                   espera: cr.espera, ini: ini, fin: fin, estado: estado });
    });
    return finGrupo;
  };
  let finEspacios = null;
  areas.filter(a => !a.generales).forEach(a => {
    const f = cadena(a, a.lista, inicio, false);
    if (f && (!finEspacios || f > finEspacios)) finEspacios = f;
  });
  areas.filter(a => a.generales).forEach(a => {
    if (!a.lista.length) return;
    const antes = a.lista.slice(0, -1), ultima = a.lista.slice(-1);
    const f = antes.length ? cadena(a, antes, inicio, true) : null;
    const tope = [finEspacios, f].filter(Boolean).sort((x, y) => y - x)[0];
    cadena(a, ultima, tope ? masHab_(tope, 1) : inicio, false);
  });
  const fin = filas.reduce((m, x) => (!m || x.fin > m) ? x.fin : m, null);
  return { filas: filas, fin: fin };
}

/*
 * Memoria dentro de una misma ejecucion: se reutiliza un calculo solo si los datos de los que depende son
 * EXACTAMENTE los mismos objetos que se leyeron. Si algo se escribio y se volvio a leer, son otros objetos y
 * se recalcula: la memoria nunca puede servir datos viejos.
 */
function memoPor_(clave, deps, calcular) {
  const m = _memo['__' + clave];
  if (m && m.deps.length === deps.length && m.deps.every((d, i) => d === deps[i])) return m.valor;
  const valor = calcular();
  _memo['__' + clave] = { deps: deps, valor: valor };
  return valor;
}

function realDeObra_(obraId) {
  return memoPor_('real|' + obraId, [datos_(SH.AVANCE), datos_(SH.AREAS)], function () {
  const real = {};
  datos_(SH.AVANCE).filter(r => r[2] === obraId).forEach(r => {
    const k = areaFila_('Avance', r, obraId, r[3]) + '|' + r[3];
    const x = real[k] || (real[k] = { ini: null, fin: null });
    const f = new Date(r[1]);
    if (!x.ini || f < x.ini) x.ini = f;
    if (r[4] === 'Terminada' && (!x.fin || f < x.fin)) x.fin = f;
  });
  return real;
  });
}

/** Plan y prevision de una obra: cada partida con sus fechas planeadas y previstas. */
function cronogramaObra_(obraId) {
  return memoPor_('crono|' + obraId, [datos_(SH.PROYECTOS), datos_(SH.AREAS), datos_(SH.AVANCE), datos_(SH.PARTIDAS), datos_(SH.PARTIDAS_OBRA)], function () {
  const p = datos_(SH.PROYECTOS).find(r => r[0] === obraId);
  if (!p || !p[6]) return null;
  const inicio = hab0_(new Date(p[6]));
  const areas = areasDe_(obraId).map(a => ({ id: a.id, nombre: a.nombre, generales: a.generales, lista: partidasDeArea_(a) }));
  const plan = calcularCrono_(inicio, areas, {}, null);
  const prev = calcularCrono_(inicio, areas, realDeObra_(obraId), hab0_(new Date()));
  prev.filas.forEach((f, i) => { f.planIni = plan.filas[i].ini; f.planFin = plan.filas[i].fin; });
  return { filas: prev.filas, planFin: plan.fin, prevFin: prev.fin };
  });
}

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

// comun/obra.js — Espacios, partidas y avance de cada obra.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

function areasDe_(obraId) {
  return datos_('Areas').filter(a => a[1] === obraId)
    .sort((a, b) => (Number(a[6]) || 0) - (Number(b[6]) || 0))
    .map(a => ({ id: a[0], obra: a[1], tipo: a[2], nombre: a[3],
                 pies2: Number(a[4]) || 0, lineales: Number(a[5]) || 0,
                 generales: a[2] === 'Generales' }));
}

/** Deduce el area de una partida cuando el registro es anterior a las areas. */
function areaPorPartida_(obraId, partida) {
  const areas = areasDe_(obraId);
  if (!areas.length) return '';
  const cat = datos_('Partidas_Catalogo');
  const gen = areas.find(x => x.generales);
  if (gen && cat.some(c => c[0] === 'Generales' && c[2] === partida)) return gen.id;
  const esp = areas.find(x => !x.generales && cat.some(c => c[0] === x.tipo && c[2] === partida));
  if (esp) return esp.id;
  const primera = areas.find(x => !x.generales);
  return (primera || gen).id;
}

/** Area de una fila: la guardada o, si falta, la deducida. */
function areaFila_(hoja, fila, obraId, partida) {
  const a = fila[COL_AREA[hoja]];
  return a ? a : areaPorPartida_(obraId, partida);
}

/** Parte una clave "AR-0002|Tile de piso y muro" en {area, partida}. */
function partirClave_(clave, obraId) {
  const s = String(clave || '');
  const i = s.indexOf('|');
  if (i < 0) return { area: s ? areaPorPartida_(obraId, s) : '', partida: s };
  return { area: s.slice(0, i), partida: s.slice(i + 1) };
}

// ------------------------------------------------------------ avance ponderado
/*
 * Cada partida pesa segun su complejidad (columna "peso" del catalogo), no
 * segun cuantas son: "Proteccion" y "Tile de piso y muro" no valen lo mismo.
 *
 * Solo cuentan las TERMINADAS. Una partida a medias no es avance que se le
 * pueda mostrar al cliente ni cobrarle; las que van en curso se reportan
 * aparte, como la parte clara de la barra.
 *
 * Los pesos son de esfuerzo, no de dinero: por eso el PM ve el mismo
 * porcentaje sin que se rompa la muralla financiera.
 */
function pesoDe_(filaCatalogo) {
  const p = Number(filaCatalogo && filaCatalogo[4]);
  return p > 0 ? p : 1;
}

function avanceDe_(partidas) {
  const total = partidas.reduce((a, p) => a + (p.peso || 0), 0);
  if (!total) return { pct: 0, curso: 0 };
  const hecho = partidas.filter(p => p.estado === 'Terminada').reduce((a, p) => a + p.peso, 0);
  const curso = partidas.filter(p => p.estado === 'En progreso').reduce((a, p) => a + p.peso, 0);
  return { pct: hecho / total, curso: curso / total };
}

/*
 * Partidas propias de cada espacio. Al crearse, el espacio copia las del catalogo; asi,
 * editar el catalogo solo afecta obras nuevas, y a una obra se le puede quitar o agregar
 * una partida (un bano sin puerta de vidrio). Los espacios anteriores a este cambio, sin
 * copia, siguen leyendo el catalogo.
 */
function partidasDeArea_(ar, cat) {
  const propias = datos_(SH.PARTIDAS_OBRA).filter(r => r[0] === ar.id);
  if (propias.length) {
    return propias.filter(r => String(r[6]) !== 'Quitada')
      .map(r => [ar.tipo, Number(r[2]) || 0, r[3], r[4] || '', Number(r[5]) || 1, r[7], r[8], r[9], r[10], r[11]])
      .sort((a, b) => a[1] - b[1]);
  }
  return (cat || datos_(SH.PARTIDAS)).filter(c => c[0] === ar.tipo).sort((a, b) => a[1] - b[1]);
}

function datosTodos_(nombre) {
  const v = hoja_(nombre).getDataRange().getValues();
  v.shift();
  return v.filter(r => String(r[0]).trim() !== '');
}

function config_() {
  const c = CacheService.getScriptCache().get('cfg');
  if (c) return JSON.parse(c);
  const o = {};
  datos_(SH.CONFIG).forEach(r => { o[r[0]] = r[1]; });
  CacheService.getScriptCache().put('cfg', JSON.stringify(o), 600);
  return o;
}

function buscarFila_(hoja, id) {
  const v = hoja_(hoja).getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (v[i][0] === id) return { fila: i + 1, datos: v[i] };
  throw new Error('No se encontro ' + id + ' en ' + hoja + '.');
}

function obraCerrada_(obraId) {
  return datos_('Obras_Cerradas').some(r => r[1] === obraId);
}

function bitacoraCorreccion_(email, hoja, id, accion, campo, antes, despues, motivo) {
  // ID por sello de tiempo: esta hoja la escriben las dos apps, y el candado
  // no cruza entre proyectos de Apps Script distintos.
  hoja_('Correcciones').appendRow(['COR-' + sello_(), new Date(), email, hoja, id,
                accion, campo || '', String(antes === undefined ? '' : antes),
                String(despues === undefined ? '' : despues), motivo]);
}

/** Valida y aplica. limiteHoras = 0 significa sin limite (dueno). */
function aplicarCorreccion_(email, hoja, id, cambios, motivo, limiteHoras, soloPropios) {
  if (!motivo || motivo.length < 5) throw new Error('Escribe el motivo de la correccion.');
  if (!ANULABLE.hasOwnProperty(hoja)) throw new Error('Esa hoja no admite correcciones.');
  const r = buscarFila_(hoja, id);
  const m = META[hoja];

  if (soloPropios && String(r.datos[m.usuario]).toLowerCase() !== email) {
    throw new Error('Ese registro lo capturo otra persona. Pidele al administrador que lo corrija.');
  }
  if (limiteHoras) {
    const h = (new Date() - r.datos[m.fecha]) / 3600000;
    if (h > limiteHoras) {
      throw new Error('Ese registro tiene mas de ' + limiteHoras + ' horas. ' +
        'Pidele al administrador que lo corrija.');
    }
  }
  if (obraCerrada_(r.datos[m.obra])) {
    throw new Error('Esa obra ya esta cerrada. Su historico no se puede cambiar.');
  }
  if (String(r.datos[ANULABLE[hoja]]) === 'Anulado') {
    throw new Error('Ese registro ya esta anulado.');
  }

  const sh = hoja_(hoja);
  const campos = EDITABLE[hoja] || {};
  let n = 0;
  Object.keys(cambios || {}).forEach(k => {
    if (!campos[k]) return;
    const col = campos[k];
    const antes = r.datos[col - 1];
    let despues = (k === 'monto' || k === 'horas') ? Number(cambios[k]) || 0 : cambios[k];
    // una partida puede venir como "AR-0002|Tile": mover tambien el area
    if (k === 'partida' && String(despues).indexOf('|') >= 0 && COL_AREA[hoja] !== undefined) {
      const i = String(despues).indexOf('|');
      const areaNueva = String(despues).slice(0, i);
      despues = String(despues).slice(i + 1);
      const areaAntes = r.datos[COL_AREA[hoja]];
      if (areaNueva && areaNueva !== areaAntes) {
        sh.getRange(r.fila, COL_AREA[hoja] + 1).setValue(areaNueva);
        bitacoraCorreccion_(email, hoja, id, 'Editar', 'area_id', areaAntes, areaNueva, motivo);
        n++;
      }
    }
    if (String(antes) === String(despues)) return;
    sh.getRange(r.fila, col).setValue(despues);
    bitacoraCorreccion_(email, hoja, id, 'Editar', k, antes, despues, motivo);
    n++;
  });
  if (!n) throw new Error('No cambiaste ningun valor.');
  return { ok: true, cambios: n };
}

function aplicarAnulacion_(email, hoja, id, motivo, limiteHoras, soloPropios) {
  if (!motivo || motivo.length < 5) throw new Error('Escribe el motivo de la anulacion.');
  if (!ANULABLE.hasOwnProperty(hoja)) throw new Error('Esa hoja no admite anulaciones.');
  const r = buscarFila_(hoja, id);
  const m = META[hoja];

  if (soloPropios && String(r.datos[m.usuario]).toLowerCase() !== email) {
    throw new Error('Ese registro lo capturo otra persona. Pidele al administrador que lo anule.');
  }
  if (limiteHoras) {
    const h = (new Date() - r.datos[m.fecha]) / 3600000;
    if (h > limiteHoras) {
      throw new Error('Ese registro tiene mas de ' + limiteHoras + ' horas. ' +
        'Pidele al administrador que lo anule.');
    }
  }
  if (obraCerrada_(r.datos[m.obra])) {
    throw new Error('Esa obra ya esta cerrada. Su historico no se puede cambiar.');
  }
  if (String(r.datos[ANULABLE[hoja]]) === 'Anulado') return { ok: true, yaEstaba: true };

  hoja_(hoja).getRange(r.fila, ANULABLE[hoja] + 1).setValue('Anulado');
  bitacoraCorreccion_(email, hoja, id, 'Anular', '', 'Vigente', 'Anulado', motivo);

  // un pago anulado devuelve la orden a Aprobada
  if (hoja === 'Pagos_Sub') {
    try {
      const ot = buscarFila_('Ordenes_Trabajo', r.datos[2]);
      if (ot.datos[8] === 'Pagada') hoja_('Ordenes_Trabajo').getRange(ot.fila, 9).setValue('Aprobada');
    } catch (e) {}
  }
  return { ok: true };
}

/** Etiqueta del proyecto a partir de sus areas: "Baño + Closet". */
function etiquetaTipo_(obraId) {
  const t = areasDe_(obraId).filter(a => !a.generales).map(a => a.tipo)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  return t.length ? t.join(' + ') : 'Sin areas';
}

// ----------------------------------------------------------- datos en vivo
/*
 * Apps Script no puede empujarle datos al navegador: la app tiene que preguntar.
 * Para que preguntar sea barato, cada registro marca una sola celda de Config
 * (ULTIMO_CAMBIO). Cada app pregunta cada 30 s por esa celda y solo si cambio
 * descarga los datos completos. La celda vive en el libro porque las dos apps
 * son proyectos distintos y no comparten cache.
 *
 * Se marca DESPUES de escribir: si se marcara antes, la otra app podria ver el
 * aviso, descargar los datos todavia viejos y quedarse con ellos.
 */
function filaSello_() {
  const sh = hoja_(SH.CONFIG);
  const v = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 1).getValues();
  for (let i = 0; i < v.length; i++) if (v[i][0] === 'ULTIMO_CAMBIO') return i + 1;
  sh.appendRow(['ULTIMO_CAMBIO', '', 'Lo actualiza el sistema en cada registro. No se edita a mano.']);
  return sh.getLastRow();
}

function selloActual_() {
  return String(hoja_(SH.CONFIG).getRange(filaSello_(), 2).getValue() || '');
}

function marcarCambio_() {
  try {
    // con letras, para que Sheets nunca lo convierta en numero y pierda digitos
    hoja_(SH.CONFIG).getRange(filaSello_(), 2)
      .setValue(Date.now() + '-' + Utilities.getUuid().slice(0, 4));
  } catch (e) { /* nunca bloquea el registro que ya se guardo */ }
}

/** Sello de tiempo para nombrar fotos antes de tener el ID. */
function sello_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') +
         '-' + Utilities.getUuid().slice(0, 4);
}

/*
 * Rol del administrador. Se acepta "admin" o "administrador", y tambien "dueno"
 * para que las hojas creadas antes de este cambio sigan entrando sin tocar nada.
 */
function esAdmin_(rol) {
  return ['admin', 'administrador', 'dueno'].indexOf(sinAcentos_(rol)) >= 0;      // "dueño" con ñ tambien
}

// ------------------------------------------------------------------- idioma
/*
 * Cada persona guarda su idioma en la columna "idioma" de Usuarios, asi la sigue en
 * cualquier telefono (el almacenamiento del navegador a veces lo bloquea Safari).
 * Las pantallas se traducen en el navegador; aqui solo se traduce lo que genera el
 * servidor: el texto de la orden de cambio y los correos de aviso.
 */
function guardarIdioma_(usuario, lang) {
  const l = lang === 'en' ? 'en' : 'es';
  const sh = hoja_(SH.USUARIOS);
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim().toLowerCase() === usuario) {
      if (v[0].length < 9 || String(v[0][8] || '') === '') sh.getRange(1, 9).setValue('idioma');
      sh.getRange(i + 1, 9).setValue(l);
      return { ok: true, idioma: l };
    }
  }
  return { ok: false };
}

function idiomaAdmin_() {
  const d = datos_(SH.USUARIOS).find(r => esAdmin_(r[3]) && String(r[6]).toUpperCase() === 'SI');
  return d && String(d[8] || '').toLowerCase() === 'en' ? 'en' : 'es';
}

function usuarioActivo_(usuario) {
  return datos_(SH.USUARIOS).some(r => String(r[0]).trim().toLowerCase() === usuario && String(r[6]).toUpperCase() === 'SI');
}

function intentarAcceso_(usuario, pin, rolRequerido, prefijo, msgRol) {
  usuario = String(usuario || '').trim().toLowerCase();
  const cache = CacheService.getScriptCache();
  const clave = 'int_' + prefijo + usuario;
  const fallos = Number(cache.get(clave)) || 0;
  if (fallos >= MAX_INTENTOS) {
    return { ok: false, bloqueado: true,
      msg: 'Demasiados intentos. Esta cuenta queda bloqueada 15 minutos.' };
  }
  const u = datos_(SH.USUARIOS).find(r =>
    String(r[0]).trim().toLowerCase() === usuario &&
    String(r[1]).trim() === String(pin || '').trim() &&
    String(r[6]).toUpperCase() === 'SI');
  if (!u) {
    cache.put(clave, String(fallos + 1), BLOQUEO_SEG);
    const quedan = MAX_INTENTOS - fallos - 1;
    return { ok: false, msg: 'Usuario o PIN incorrectos.' +
      (quedan > 0 && quedan <= 2
        ? ' Te queda' + (quedan > 1 ? 'n ' : ' ') + quedan + ' intento' + (quedan > 1 ? 's' : '') + '.' : '') };
  }
  cache.remove(clave);
  const rolOk = rolRequerido === 'admin' ? esAdmin_(u[3]) : String(u[3]).trim().toLowerCase() === rolRequerido;
  if (!rolOk) return { ok: false, msg: msgRol };
  const token = crearPase_(prefijo, usuario);
  return { ok: true, token: token, nombre: u[2], idioma: String(u[8] || '').toLowerCase() };
}

/** Correo a donde llegan los avisos del dueno. Vacio si no hay uno valido. */
function correoDueno_() {
  const d = datos_(SH.USUARIOS).find(r => esAdmin_(r[3]) &&
                                        String(r[6]).toUpperCase() === 'SI');
  if (!d) return '';
  const avisos = String(d[7] || '').trim();
  if (avisos.indexOf('@') > 0) return avisos;
  const usuario = String(d[0] || '').trim();
  return usuario.indexOf('@') > 0 ? usuario : '';
}

function sinAcentos_(s) {
  return String(s == null ? '' : s).replace(/[áéíóúüñÁÉÍÓÚÜÑ]/g, c => SIN_ACENTOS_[c]).toLowerCase().trim();
}

function esBano_(tipo) { return sinAcentos_(tipo) === 'bano'; }

function enLista_(lista, valor) { const k = sinAcentos_(valor); return lista.some(x => sinAcentos_(x) === k); }

function porNombre_(mapa, clave) {
  if (!mapa) return undefined;
  if (Object.prototype.hasOwnProperty.call(mapa, clave)) return mapa[clave];
  const k = sinAcentos_(clave);
  for (const x in mapa) if (sinAcentos_(x) === k) return mapa[x];
  return undefined;
}

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

// pm/servidor.js
// Solo de la app del PM. Lo compartido está en comun/. Después de editar, corre construir.py.

function doGet() {
  return HtmlService.createHtmlOutputFromFile('PM')
    .setTitle('IJM - Bitacora de Campo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

/** Siguiente ID leyendo solo la ultima celda de la columna A. */
function siguienteId_(nombre, prefijo, largo) {
  // el numero mas alto se lee una vez por viaje; los siguientes se cuentan en memoria (siempre dentro del candado)
  const k = '__max|' + nombre;
  if (!(k in _memo)) _memo[k] = { n: maxNum_(hoja_(nombre)) };
  _memo[k].n++;
  return prefijo + '-' + String(_memo[k].n).padStart(largo || 4, '0');
}

function mismoDia_(a, b) { return fecha_(a) === fecha_(b); }

function guardarFotos_(fotos, etiqueta) {
  if (!fotos || !fotos.length) return '';
  const idCarpeta = config_()['ID_CARPETA_DRIVE'];
  if (!idCarpeta || idCarpeta === 'PEGAR_AQUI_EL_ID') {
    throw new Error('Falta configurar ID_CARPETA_DRIVE en la hoja Config.');
  }
  const carpeta = DriveApp.getFolderById(idCarpeta);
  const ligas = [];
  fotos.forEach((f, i) => {
    const blob = Utilities.newBlob(Utilities.base64Decode(f.data), f.mime, etiqueta + '_' + (i + 1) + '.jpg');
    const archivo = carpeta.createFile(blob);
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    // la fecha en que se TOMO (no la de subida): queda en la descripcion del archivo
    if (f.tomada) { try { archivo.setDescription('Foto tomada: ' + f.tomada); } catch (e) {} }
    ligas.push(archivo.getUrl());
  });
  return ligas.join(' | ');
}

// ------------------------------------------------------ candado de escritura
/*
 * Evita IDs duplicados. Sin esto, dos PMs cerrando el dia en el mismo segundo
 * leen el mismo ultimo ID y guardan dos registros con el mismo numero.
 *
 * Dos detalles que hacen que funcione:
 *  1. SpreadsheetApp.flush() ANTES de soltar el candado. Apps Script junta las
 *     escrituras y las manda despues; sin flush, la siguiente ejecucion puede
 *     leer la hoja antes de que llegue la fila y sacar el mismo ID.
 *  2. Las fotos se suben FUERA del candado. Subir seis fotos tarda 10 a 20 s;
 *     si se hace adentro, todos los demas se quedan esperando.
 */
function conCandado_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    throw new Error('El sistema esta ocupado con otra captura. Intenta de nuevo en unos segundos.');
  }
  try {
    const r = fn();
    SpreadsheetApp.flush();
    return r;
  } finally {
    lock.releaseLock();
  }
}

/** La semana del PM: que toca cada dia y que sub llega. No mantiene nada: sale del cronograma. */
function semanaPM_(obraId) {
  const cr = cronogramaObra_(obraId);
  if (!cr) return null;
  const hoy = hab0_(new Date()), ots = datos_(SH.OT).filter(o => o[1] === obraId && ['Cancelada', 'Pagada'].indexOf(o[8]) < 0);
  const subs = datos_(SH.SUBS), dias = [];
  for (let i = 0; i < 5; i++) {
    const d = masHab_(hoy, i);
    const items = cr.filas.filter(f => f.estado !== 'Terminada' && f.ini <= d && f.fin >= d)
      .map(f => ({ partida: f.partida, area: f.areaNombre, quien: f.quien }));
    const llegan = ots.filter(o => o[6] && fecha_(hab0_(new Date(o[6]))) === fecha_(d))
      .map(o => ((subs.find(s => s[0] === o[2]) || [])[1] || o[2]));
    dias.push({ fecha: fecha_(d), dow: d.getDay(), items: items, llegan: llegan });
  }
  return { dias: dias, prevFin: fecha_(cr.prevFin) };
}

// ------------------------------------------------------------ dias sin cierre
/*
 * Si al PM se le olvido cerrar un dia, la app se lo dice al abrir en la manana y lo deja cerrarlo
 * con la fecha de ESE dia: las horas y el avance quedan en su fecha, no corridos al dia siguiente.
 * Solo los ultimos 2 dias habiles (como la ventana de 48 h para corregir); mas atras, el
 * administrador. El dia cuenta como cerrado, pero la bitacora lo marca "tarde".
 */
function menosHab_(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  let k = 0;
  while (k < n) { x.setDate(x.getDate() - 1); if (x.getDay() !== 0 && x.getDay() !== 6) k++; }
  return x;
}

function isoDia_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

function diasSinCierre_(bits, estado) {
  if (estado !== 'En obra') return [];
  const trabajo = bits.filter(b => String(b[4] || '') !== '');
  if (!trabajo.length) return [];
  const primero = trabajo.reduce((m, b) => (b[1] < m ? b[1] : m), trabajo[0][1]);
  const d0 = new Date(primero.getFullYear(), primero.getMonth(), primero.getDate());
  const cerrados = {};
  bits.forEach(b => { cerrados[fecha_(b[1])] = true; });
  const out = [];
  for (let k = 2; k >= 1; k--) {
    const d = menosHab_(new Date(), k);
    if (d >= d0 && !cerrados[fecha_(d)]) out.push({ fecha: fecha_(d), iso: isoDia_(d), dow: d.getDay() });
  }
  return out;
}

// ------------------------------------------------------------------- sesion

function pmLogin(usuario, pin, lang) {
  return intentarAcceso_(usuario, pin, 'pm', 'pm_', 'Esta app es solo para Project Managers.');
}

/** Obras activas asignadas a este PM. */
function misObras_(email) {
  return datos_(SH.PROYECTOS).filter(r =>
    String(r[5]).trim().toLowerCase() === email &&
    ['En obra', 'Lista para arranque', 'Sin presupuesto', 'En cierre'].indexOf(String(r[9])) >= 0);
}

/**
 * Un PM solo escribe en SUS obras. Sin esto, cualquier PM podia registrar
 * gastos, cerrar el dia o aprobar el trabajo de un sub en la obra de otro.
 */
function exigirObra_(email, obraId) {
  if (!obraId || !misObras_(email).some(r => r[0] === obraId)) {
    throw new Error('Esa obra no esta asignada a ti.');
  }
}

/** Busca un registro por ID y exige que su obra sea del PM. */
function exigirRegistro_(email, hoja, id, colObra) {
  const fila = datos_(hoja).find(r => r[0] === id);
  if (!fila) throw new Error('No se encontro ' + id + '.');
  exigirObra_(email, fila[colObra]);
  return fila;
}

/*
 * Fecha de captura. Un cierre guardado sin senal el lunes y enviado el martes
 * es del LUNES. La columna timestamp guarda cuando llego al servidor, asi que
 * un envio tardio queda visible. Se acepta hasta 7 dias atras; nunca futuro.
 */
function fechaCaptura_(p) {
  const ahora = new Date();
  const f = p && p.capturado ? new Date(p.capturado) : null;
  if (!f || isNaN(f.getTime()) || f > ahora || ahora - f > 7 * 86400000) return ahora;
  return f;
}

function invalidar_(email) {
  CacheService.getScriptCache().remove('pmd_' + email);
  marcarCambio_();
}

// ------------------------------------------------------------ carga de datos

function pmDatos(token) {
  const email = auth_(token);
  // el sello se lee ANTES de armar los datos: si alguien escribe mientras tanto,
  // el siguiente sondeo vera un sello mas nuevo y volvera a descargar
  const sello = selloActual_();
  const cache = CacheService.getScriptCache().get('pmd_' + email);
  if (cache) {
    const c = JSON.parse(cache);
    if (c.sello === sello) return c;      // nadie ha escrito nada desde entonces
  }
  const d = construirDatos_(email);
  d.sello = sello;
  try { CacheService.getScriptCache().put('pmd_' + email, JSON.stringify(d), 45); } catch (e) {}
  return d;
}

/** El idioma elegido queda en su usuario. */
function pmIdioma(token, lang) {
  return guardarIdioma_(auth_(token), lang);
}

/** La pregunta barata: una celda. */
function pmSello(token) {
  auth_(token);
  return selloActual_();
}

function construirDatos_(email) {
  const cfg = config_();
  const hoy = new Date();
  const hace7 = new Date(Date.now() - 7 * 86400000);

  const obras = datos_(SH.PROYECTOS).filter(r =>
    String(r[5]).trim().toLowerCase() === email &&
    ['En obra', 'Lista para arranque', 'Sin presupuesto', 'En cierre'].indexOf(String(r[9])) >= 0);
  const ids = obras.map(r => r[0]);

  const partidasCat = datos_(SH.PARTIDAS);
  const avance = datos_(SH.AVANCE).filter(r => ids.indexOf(r[2]) >= 0);
  const bitacora = datos_(SH.BITACORA).filter(r => ids.indexOf(r[2]) >= 0);
  const manoObra = datos_(SH.MANO_OBRA).filter(r => ids.indexOf(r[2]) >= 0);
  const bloqueos = datos_(SH.BLOQUEOS).filter(r => String(r[6]).toLowerCase() === email);
  const nombreSub = {};
  datos_(SH.SUBS).forEach(s => { nombreSub[s[0]] = { nombre: s[1], oficio: s[2], tel: String(s[3] || '') }; });
  const ots = datos_(SH.OT).filter(r => ids.indexOf(r[1]) >= 0 &&
    ['Emitida', 'Confirmada', 'Aprobada'].indexOf(r[8]) >= 0);
  const calidad = datos_(SH.CALIDAD).filter(r => ids.indexOf(r[2]) >= 0);
  const aguas = datos_(SH.AGUA).filter(r => ids.indexOf(r[1]) >= 0);
  const punch = datos_(SH.PUNCH).filter(r => ids.indexOf(r[1]) >= 0);
  // ordenes de cambio que el cliente ya autorizo: el PM tiene que ejecutarlas.
  // Se mandan descripcion y dias; NUNCA costo, precio ni margen.
  const cambios = datos_(SH.OC).filter(r => ids.indexOf(r[1]) >= 0 &&
    ['Autorizada', 'Facturada'].indexOf(r[9]) >= 0);
  const entregas = datos_(SH.ENTREGA).filter(r => ids.indexOf(r[1]) >= 0);

  const lista = obras.map(r => {
    const id = r[0];
    const areas = areasDe_(id);
    const avObra = avance.filter(a => a[2] === id)
      .map(a => ({ fila: a, area: areaFila_('Avance', a, id, a[3]) }));
    const calObra = calidad.filter(c => c[2] === id)
      .map(c => ({ fila: c, area: areaFila_('Calidad', c, id, c[4]) }));
    const otObra = ots.filter(o => o[1] === id)
      .map(o => ({ fila: o, area: areaFila_('Ordenes_Trabajo', o, id, o[13]) }));

    const porArea = areas.map(ar => {
      const partidas = partidasDeArea_(ar, partidasCat)
        .map(c => {
          const regs = avObra.filter(x => x.area === ar.id && x.fila[3] === c[2]).map(x => x.fila);
          let estado = 'Sin iniciar';
          if (regs.some(a => a[4] === 'Terminada')) estado = 'Terminada';
          else if (regs.some(a => a[4] === 'En progreso')) estado = 'En progreso';
          const hito = c[3] || '';
          // manda la ULTIMA inspeccion de ese hito en esa area
          const insp = hito ? calObra.filter(x => x.area === ar.id && x.fila[3] === hito)
                                     .map(x => x.fila) : [];
          const ultima = insp.length ? insp[insp.length - 1] : null;
          return { key: ar.id + '|' + c[2], area: ar.id, areaNombre: ar.nombre,
                   partida: c[2], hito: hito, estado: estado, peso: pesoDe_(c),
                   inspeccion: !hito ? '' : (ultima ? ultima[5] : 'Pendiente'),
                   ultimaInsp: !ultima ? null : { fecha: fecha_(ultima[1]), ok: Number(ultima[6]) || 0,
                     total: Number(ultima[7]) || 0, defectos: String(ultima[8] || ''),
                     na: String(ultima[13] || '').split(' | ').filter(Boolean).length,   // ' | ': hay preguntas con ';'
                     veces: insp.length } };
        });
      const abiertas = partidas.filter(x => x.estado !== 'Terminada');
      const sug = abiertas.find(x => x.estado === 'En progreso') || null;

      const tiempos = partidas.filter(x => x.estado === 'Terminada').map(x => {
        const regs = avObra.filter(a => a.area === ar.id && a.fila[3] === x.partida).map(a => a.fila);
        const fin = regs.find(a => a[4] === 'Terminada');
        if (!fin) return null;
        const ini = regs.find(a => a[4] === 'En progreso');
        const d0 = ini ? ini[1] : fin[1];
        return { area: ar.nombre, partida: x.partida, inicio: fecha_(d0), fin: fecha_(fin[1]),
                 dias: Math.max(1, Math.round((fin[1] - d0) / 86400000) + 1) };
      }).filter(Boolean);

      const iSug = sug ? partidas.indexOf(sug) : -1;
      const sig = partidas.slice(iSug + 1).find(x => x.estado === 'Sin iniciar') || null;
      const subSig = sig ? otObra.find(o => o.area === ar.id && o.fila[13] === sig.partida) : null;

      const aguasArea = aguas.filter(x => x[1] === id &&
        (x[9] ? x[9] === ar.id : (!ar.generales && esBano_(ar.tipo))));
      const u = aguasArea.length ? aguasArea[aguasArea.length - 1] : null;

      const av = avanceDe_(partidas);
      return {
        id: ar.id, tipo: ar.tipo, nombre: ar.nombre, generales: ar.generales,
        pies2: ar.pies2, lineales: ar.lineales,
        avance: av.pct, enCurso: av.curso,
        partidas: partidas, sugerida: sug ? sug.key : '',
        controles: (function () {
          const m = {}, orden = [];
          partidas.filter(x => x.hito).forEach(x => {
            if (!m[x.hito]) { m[x.hito] = { hito: x.hito, partidas: [], iniciado: false,
                                            inspeccion: x.inspeccion, ultima: x.ultimaInsp };
                              orden.push(x.hito); }
            m[x.hito].partidas.push(x.partida);
            if (x.estado !== 'Sin iniciar') m[x.hito].iniciado = true;
          });
          return orden.map(h => m[h]);
        })(),
        terminadas: partidas.filter(x => x.estado === 'Terminada').length, total: partidas.length,
        tiempos: tiempos,
        siguiente: sig ? { area: ar.nombre, partida: sig.partida, hito: sig.hito,
          sub: subSig ? ((nombreSub[subSig.fila[2]] || {}).nombre || subSig.fila[2]) : '',
          subInicio: subSig ? fecha_(subSig.fila[6]) : '' } : null,
        prueba: !u ? null : { id: u[0], inicio: fecha_(u[2]), fin: u[4] ? fecha_(u[4]) : '',
          horas: Number(u[6]) || 0, resultado: u[7], enCurso: u[7] === 'En curso',
          horasTranscurridas: u[4] ? Number(u[6]) || 0
            : Math.round((new Date() - u[2]) / 3600000 * 10) / 10 }
      };
    });

    const todas = [].concat.apply([], porArea.map(a => a.partidas));
    const abiertas = todas.filter(x => x.estado !== 'Terminada');
    const bits = bitacora.filter(b => b[2] === id);
    // con fecha de captura, el ultimo renglon no es necesariamente el dia mas reciente
    const ultima = bits.reduce((m, b) => (!m || b[1] > m[1]) ? b : m, null);
    const deHoy = bits.find(b => mismoDia_(b[1], hoy)) || null;
    const mo7 = manoObra.filter(m => m[2] === id && m[1] >= hace7);
    const cambiosObra = cambios.filter(c => c[1] === id);
    const fotos = bits.reduce((a, b) => a + String(b[7] || '').split(' | ').filter(Boolean).length, 0);
    const espacios = porArea.filter(a => !a.generales);
    const avObraPct = avanceDe_(todas);

    return {
      avance: avObraPct.pct, enCurso: avObraPct.curso,
      id: id, cliente: r[1], telefono: String(r[2] || ''), direccion: r[3],
      tipo: etiquetaTipo_(id),
      estado: r[9], notas: String(r[11] || ''), finEst: fecha_(r[7]),
      pies2: espacios.reduce((a, x) => a + x.pies2, 0),
      areas: porArea,
      partidas: todas,
      abiertas: abiertas.map(x => ({ key: x.key, area: x.area, areaNombre: x.areaNombre,
                                     partida: x.partida, generales: porArea.some(a => a.id === x.area && a.generales) })),
      sugeridas: porArea.map(a => a.sugerida).filter(Boolean),
      terminadas: todas.filter(x => x.estado === 'Terminada').length, total: todas.length,
      cerradoHoy: !!deHoy,
      bitacoraHoy: deHoy ? deHoy[0] : '',
      semana: semanaPM_(id),
      diasSinCierre: diasSinCierre_(bits, String(r[9])),
      puedeArrancar: String(r[9]) !== 'Sin presupuesto',      // solo el estado: el PM nunca lee el presupuesto
      cambios: cambiosObra.map(c => ({ id: c[0], descripcion: c[4], dias: Number(c[8]) || 0,
        autorizada: fecha_(c[11]),
        nuevo: c[11] ? (hoy - c[11]) < 3 * 86400000 : false })),
      diasExtraOC: cambiosObra.reduce((a, c) => a + (Number(c[8]) || 0), 0),
      diasAEntrega: r[7] ? Math.ceil((r[7] - hoy) / 86400000) : null,
      restantes: abiertas.length,
      tiempos: [].concat.apply([], porArea.map(a => a.tiempos)),
      fotos: fotos,
      siguiente: (espacios.find(a => a.siguiente) || porArea.find(a => a.siguiente) || {}).siguiente || null,
      ultimoReporte: ultima ? fecha_(ultima[1]) : '',
      horasSemana: mo7.reduce((a, m) => a + (Number(m[5]) || 0), 0),
      subsHoy: otObra.filter(o => !o.fila[10] && o.fila[6] && o.fila[6] <= hoy)
        .map(o => ({ ot: o.fila[0], nombre: (nombreSub[o.fila[2]] || {}).nombre || o.fila[2],
                     oficio: o.fila[3], partida: o.fila[13] || '', inicio: fecha_(o.fila[6]) })),
      entregada: entregas.some(e => e[1] === id),
      fechaEntrega: (function () {
        const e = entregas.find(x => x[1] === id);
        return e ? fecha_(e[2]) : '';
      })(),
      punch: punch.filter(x => x[1] === id).map(x => ({
        id: x[0], fecha: fecha_(x[2]), item: x[3], origen: x[4], responsable: x[5],
        compromiso: fecha_(x[6]), estado: x[7],
        vencido: x[7] === 'Abierto' && x[6] && x[6] < hoy
      })),
      // inspecciones que bloquean el cierre de una partida, por area
      inspecciones: todas.filter(x => x.hito && x.estado !== 'Sin iniciar' && x.inspeccion !== 'Aprobado')
        .map(x => ({ hito: x.hito, partida: x.partida, area: x.area, areaNombre: x.areaNombre,
                     estado: x.inspeccion })),
      porConfirmar: otObra.filter(o => o.fila[8] === 'Emitida' && !o.fila[9] && o.fila[6])
        .map(o => ({ ot: o.fila[0], nombre: (nombreSub[o.fila[2]] || {}).nombre || o.fila[2],
                     oficio: o.fila[3], inicio: fecha_(o.fila[6]),
                     tel: (nombreSub[o.fila[2]] || {}).tel || '' })),
      subsActivos: otObra.filter(o => o.fila[10] && !o.fila[11])
        .map(o => ({ ot: o.fila[0], nombre: (nombreSub[o.fila[2]] || {}).nombre || o.fila[2],
                     oficio: o.fila[3], partida: o.fila[13] || '', alcance: o.fila[4],
                     tel: (nombreSub[o.fila[2]] || {}).tel || '' }))
    };
  });

  // racha: dias habiles seguidos en los que cerro al menos una obra
  const cerrados = {};
  bitacora.forEach(b => { cerrados[fecha_(b[1])] = true; });
  let racha = 0;
  const cur = new Date();
  if (!cerrados[fecha_(cur)]) cur.setDate(cur.getDate() - 1);
  for (let i = 0; i < 180; i++) {
    const dow = cur.getDay();
    if (dow === 0 || dow === 6) { cur.setDate(cur.getDate() - 1); continue; }
    if (!cerrados[fecha_(cur)]) break;
    racha++;
    cur.setDate(cur.getDate() - 1);
  }
  const resp = bloqueos.filter(b => Number(b[11]) > 0);

  return {
    nombre: (datos_(SH.USUARIOS).find(u => String(u[0]).toLowerCase() === email) || [])[2] || '',
    obras: lista,
    racha: racha,
    diasReportados: Object.keys(cerrados).length,
    fotosTotales: bitacora.reduce((a, b) => a + String(b[7] || '').split(' | ').filter(Boolean).length, 0),
    respuestaPromedio: resp.length
      ? Math.round(resp.reduce((a, b) => a + Number(b[11]), 0) / resp.length * 10) / 10 : null,
    respuestas: bloqueos.filter(b => String(b[9] || '') !== '').slice(-10).reverse()
      .map(b => ({ id: b[0], obra: b[2], tipo: b[3], descripcion: b[4],
                   respuesta: b[9], fecha: fecha_(b[10]) })),
    avisosAbiertos: bloqueos.filter(b => b[8] === 'Abierto')
      .map(b => ({ id: b[0], obra: b[2], tipo: b[3], descripcion: b[4], fecha: fecha_(b[1]) })),
    sinRecibo: datos_(SH.GASTOS)
      .filter(g => String(g[10]).toLowerCase() === email && String(g[9] || '') === '')
      .map(g => ({ id: g[0], fecha: fecha_(g[1]), obra: g[2], proveedor: g[4],
                   descripcion: g[5], monto: Number(g[6]) || 0 })),
    trabajadores: datos_(SH.TRABAJADORES).filter(t => String(t[6]).toUpperCase() === 'SI')
      .map(t => ({ id: t[0], nombre: t[1], puesto: t[2], porDia: String(t[3]) === 'Por dia' })),
    checklist: (function () {
      const g = {};
      datos_(SH.CHECKLIST).sort((a, b) => a[1] - b[1]).forEach(r => {
        (g[r[0]] = g[r[0]] || []).push({ n: Number(r[1]) || 0, punto: r[2],
          foto: String(r[3]).toUpperCase() === 'SI' });
      });
      return g;
    })(),
    limiteCompra: Number(cfg['LIMITE_COMPRA_PM']) || 0,
    slaBloqueo: Number(cfg['SLA_BLOQUEO_HORAS']) || 24
  };
}

// ---------------------------------------------------------- cierre del dia

/**
 * Un solo paso: partida del dia, quien estuvo, si el sub llego, fotos y
 * si la partida quedo terminada. Escribe en Bitacora, Mano_Obra, Avance
 * y Ordenes_Trabajo sin que el PM tenga que entrar a cuatro pantallas.
 */
function pmCerrarDia(token, p) {
  const email = auth_(token);
  exigirObra_(email, p.obra);
  // Cierre tardio: el dia que se le olvido, con su propia fecha
  let tardio = false;
  if (p.tardio) {
    const dia = new Date(p.tardio + 'T16:00:00');
    const validos = [menosHab_(new Date(), 1), menosHab_(new Date(), 2)].map(fecha_);
    if (validos.indexOf(fecha_(dia)) < 0) {
      throw new Error('Solo puedes cerrar los ultimos 2 dias habiles. Para dias mas viejos, pideselo al administrador.');
    }
    if (datos_(SH.BITACORA).some(x => x[2] === p.obra && fecha_(x[1]) === fecha_(dia))) {
      throw new Error('Ese dia ya tiene cierre en esta obra.');
    }
    p.capturado = dia.toISOString();
    tardio = true;
  }
  // Un dia sin trabajo tambien se reporta: esperando la fabricacion del countertop o a un sub
  // que no llego. Asi la tasa de cierre no castiga dias legitimos y tu sabes por que se paro.
  const sinTrabajo = !!p.sinTrabajo;
  const porSubir = sinTrabajo ? 0 : Math.max(0, Math.min(10, Number(p.fotosPorSubir) || 0));
  const estadoObra = String((misObras_(email).find(r => r[0] === p.obra) || [])[9]);
  if (!sinTrabajo && estadoObra === 'Sin presupuesto') {
    throw new Error('Esta obra todavia no puede arrancar: falta que el administrador capture el presupuesto por partida.');
  }
  if (sinTrabajo) {
    // con o sin acentos: un cierre que quedo en la cola antes de actualizar trae el motivo sin acentos
    const motivo = MOTIVOS_SIN_TRABAJO.find(m => sinAcentos_(m) === sinAcentos_(p.motivo));
    if (!motivo) throw new Error('Elige por que no hubo trabajo hoy.');
    p.motivo = motivo;
    p.partidas = []; p.terminadas = []; p.cuadrilla = []; p.fotos = [];
  } else {
    // las fotos pueden venir con el cierre (desde la cola sin senal) o despues, una por una: pero se comprometen aqui
    if ((!p.fotos || !p.fotos.length) && !porSubir) throw new Error('El cierre de dia requiere al menos una foto.');
    if (!p.partidas || !p.partidas.length) throw new Error('Marca en que partida se trabajo hoy.');
  }
  const otDeLaObra = datos_(SH.OT).filter(o => o[1] === p.obra).map(o => o[0]);
  (p.subs || []).forEach(s => {
    if (otDeLaObra.indexOf(s.ot) < 0) throw new Error('La orden ' + s.ot + ' no es de esta obra.');
  });

  // Ninguna partida con hito de calidad se cierra sin su inspeccion aprobada,
  // y se revisa AREA POR AREA: aprobar PC2 del bano no aprueba PC2 de la cocina.
  const areasObra = areasDe_(p.obra);
  if (p.terminadas && p.terminadas.length) {
    const cat = datos_(SH.PARTIDAS);
    const cal = datos_(SH.CALIDAD).filter(c => c[2] === p.obra)
      .map(c => ({ area: areaFila_('Calidad', c, p.obra, c[4]), hito: c[3], res: c[5] }));
    p.terminadas.forEach(t => {
      const k = partirClave_(t, p.obra);
      const ar = areasObra.find(a => a.id === k.area);
      const def = ar ? partidasDeArea_(ar, cat).find(c => c[2] === k.partida) : null;
      const hito = def ? def[3] : '';
      if (!hito) return;
      const insp = cal.filter(c => c.area === k.area && c.hito === hito);
      const ultima = insp.length ? insp[insp.length - 1] : null;
      if (!ultima || ultima.res !== 'Aprobado') {
        throw new Error('Antes de cerrar "' + k.partida + '" de ' + (ar ? ar.nombre : 'esta area') +
          ' hay que aprobar la inspeccion ' + hito + '. Hazla desde Obra > Calidad y luego ' +
          'cierra el dia, o registra el dia sin marcarla como terminada.');
      }
    });
  }
  const nombreArea = {};
  areasObra.forEach(a => { nombreArea[a.id] = a.nombre; });
  const etiqueta = t => { const k = partirClave_(t, p.obra);
    return (nombreArea[k.area] ? nombreArea[k.area] + ' · ' : '') + k.partida; };

  const ahora = fechaCaptura_(p);          // el dia del trabajo, no el del envio
  const recibido = new Date();             // cuando llego: queda como timestamp
  // las fotos primero, fuera del candado
  const ligas = sinTrabajo ? '' : guardarFotos_(p.fotos, 'BIT_' + p.obra + '_' + sello_());

  const res = conCandado_(function () {
  validarCuadrilla_(p.cuadrilla, ahora);          // primero se valida: un rechazo no deja un cierre a medias
  const idBit = siguienteId_(SH.BITACORA, 'BIT', 4);

  // 1. asistencia de subs programados (alimenta la tasa de presentacion)
  const nombresSubs = [];
  if (p.subs && p.subs.length) {
    const sh = hoja_(SH.OT);
    const v = sh.getDataRange().getValues();
    p.subs.forEach(s => {
      for (let i = 1; i < v.length; i++) {
        if (v[i][0] === s.ot) {
          sh.getRange(i + 1, 11).setValue(s.llego ? 'SI' : 'NO');
          if (s.llego) {
            nombresSubs.push(s.nombre);
            if (v[i][8] === 'Emitida') sh.getRange(i + 1, 9).setValue('Confirmada');
          }
          break;
        }
      }
    });
  }

  // 2. bitacora
  hoja_(SH.BITACORA).appendRow([
    idBit, ahora, p.obra, email, p.partidas.map(etiqueta).join('; '), nombresSubs.join('; '),
    sinTrabajo ? 'Sin trabajo: ' + p.motivo + (p.incidencia ? '. ' + p.incidencia : '') : (p.incidencia || ''),
    ligas, recibido, 'Vigente', tardio ? 'SI' : '',
    porSubir ? Array.from({ length: porSubir }, (x, i) => i + 1).join(',') : ''     // fotos que faltan por llegar
  ]);

  // 3. cuadrilla propia, una fila por trabajador
  const horas = registrarCuadrilla_(email, p.obra, p.cuadrilla, p.partidas[0], ahora);

  // 4. avance: en progreso por default, terminada si el PM lo marco
  registrarAvance_(email, p.obra, p.partidas, p.terminadas || [], ahora);

  // 5. la obra arranca con su primer dia de trabajo: pasa de "Lista para arranque" a "En obra"
  if (!sinTrabajo) arrancarObra_(p.obra);
  return { id: idBit, horas: horas };
  });

  invalidar_(email);
  return { ok: true, id: res.id, horas: res.horas };
}

function tiempoTexto_(trabajadorId, h) {
  const t = datos_(SH.TRABAJADORES).find(x => x[0] === trabajadorId);
  if (!t || String(t[3]) !== 'Por dia') return h + ' h';
  return h === 0.5 ? 'medio día' : (h === 1 ? '1 día' : h + ' días');
}

function arrancarObra_(obraId) {
  const ya = datos_(SH.PROYECTOS).find(r => r[0] === obraId);
  if (!ya || ya[9] !== 'Lista para arranque') return;        // casi siempre ya esta en obra: no se relee la hoja
  const sh = hoja_(SH.PROYECTOS), v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === obraId) { if (v[i][9] === 'Lista para arranque') sh.getRange(i + 1, 10).setValue('En obra'); return; }
  }
}

function registrarCuadrilla_(email, obra, lista, partidaDefault, ahora) {
  if (!lista || !lista.length) return 0;
  const sh = hoja_(SH.MANO_OBRA);
  const ultima = sh.getLastRow();                   // una sola consulta: para numerar y para escribir
  let n = maxNum_(sh, ultima);
  const filas = [];
  let total = 0;
  lista.forEach(t => {
    const h = Number(t.horas) || 0;
    if (!t.trabajador || h <= 0) return;
    n++; total += h;
    const k = partirClave_(t.partida || partidaDefault || '', obra);
    filas.push(['MO-' + String(n).padStart(4, '0'), ahora, obra, t.trabajador,
                k.partida, h, email, new Date(), 'Vigente', k.area]);
  });
  if (filas.length) sh.getRange(ultima + 1, 1, filas.length, 10).setValues(filas);
  return total;
}

function registrarAvance_(email, obra, partidas, terminadas, ahora) {
  const previos = datos_(SH.AVANCE).filter(r => r[2] === obra);
  const sh = hoja_(SH.AVANCE);
  const ultima = sh.getLastRow();                   // una sola consulta: para numerar y para escribir
  let n = maxNum_(sh, ultima);
  const filas = [];
  partidas.forEach(clave => {
    const k = partirClave_(clave, obra);
    const fin = terminadas.indexOf(clave) >= 0;
    const estado = fin ? 'Terminada' : 'En progreso';
    const yaTiene = previos.some(r => r[3] === k.partida && r[4] === estado &&
      areaFila_('Avance', r, obra, r[3]) === k.area);
    if (yaTiene) return;             // no duplica el mismo estado en la misma area
    n++;
    filas.push(['AV-' + String(n).padStart(4, '0'), ahora, obra, k.partida, estado, email, new Date(),
                'Vigente', k.area]);
  });
  if (filas.length) sh.getRange(ultima + 1, 1, filas.length, 9).setValues(filas);
}

// ----------------------------------------------------------- otras acciones

function pmGasto(token, p) {
  const email = auth_(token);
  exigir_([[p.proveedor, 'proveedor']]);
  const monto = Number(p.monto) || 0;
  if (monto <= 0) throw new Error('Captura un monto valido.');
  if (!p.obra) throw new Error('Todo gasto debe asignarse a una obra.');
  exigirObra_(email, p.obra);
  const fechaGasto = fechaCaptura_(p);
  const cfg = config_();
  const u = datos_(SH.USUARIOS).find(r => String(r[0]).toLowerCase() === email) || [];
  const liga = p.recibo ? guardarFotos_([p.recibo], 'REC_' + p.obra + '_' + sello_()) : '';
  const limite = Number(cfg['LIMITE_COMPRA_PM']) || 0;
  const id = conCandado_(function () {
    const nuevo = siguienteId_(SH.GASTOS, 'GTO', 4);
    const k = partirClave_(p.partida, p.obra);
    // un gasto sin partida va a Generales de obra: es costo del proyecto, no de un espacio
    const area = k.area || ((areasDe_(p.obra).find(a => a.generales) || {}).id || '');
    hoja_(SH.GASTOS).appendRow([
      nuevo, fechaGasto, p.obra, p.categoria || 'Material', p.proveedor || '',
      p.descripcion || '', monto, 'Tarjeta de la empresa', String(u[4] || ''),
      liga, email, new Date(), k.partida || '', 'Vigente', area,
      (limite && monto > limite) ? 'Pendiente' : ''          // llega a la pantalla de inicio del administrador
    ]);
    return nuevo;
  });
  invalidar_(email);
  return { ok: true, id: id, sinRecibo: !liga,
    aviso: (limite && monto > limite)
      ? 'Este cargo supera el limite de $' + limite + '. Ya le aparece al administrador para revisarlo.' : '' };
}

function pmSubirRecibo(token, gastoId, recibo) {
  const email = auth_(token);
  exigirRegistro_(email, SH.GASTOS, gastoId, 2);
  const sh = hoja_(SH.GASTOS);
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === gastoId) {
      sh.getRange(i + 1, 10).setValue(guardarFotos_([recibo], 'REC_' + gastoId));
      invalidar_(email);
      return { ok: true };
    }
  }
  throw new Error('No se encontro el gasto ' + gastoId);
}

function pmBloqueo(token, p) {
  const email = auth_(token);
  exigirObra_(email, p.obra);
  if (!p.descripcion || p.descripcion.length < 10) {
    throw new Error('Describe el bloqueo con detalle para que el administrador pueda resolverlo.');
  }
  const ligas = p.fotos && p.fotos.length ? guardarFotos_(p.fotos, 'BLQ_' + p.obra + '_' + sello_()) : '';
  const id = conCandado_(function () {
    const nuevo = siguienteId_(SH.BLOQUEOS, 'BLQ', 4);
    hoja_(SH.BLOQUEOS).appendRow([
      nuevo, new Date(), p.obra, p.tipo, p.descripcion, ligas, email,
      p.detiene ? 'SI' : 'NO', 'Abierto', '', '', '', ''
    ]);
    return nuevo;
  });
  invalidar_(email);
  avisarDueno_({
    es: ['[AVISO ' + id + '] ' + p.obra + ' - ' + p.tipo,
         'Obra: ' + p.obra + '\nDetiene avance: ' + (p.detiene ? 'SI' : 'NO') +
         '\n\n' + p.descripcion + '\n\nResponde desde la app. SLA: 24 horas.'],
    en: ['[ALERT ' + id + '] ' + p.obra + ' - ' + p.tipo,
         'Job: ' + p.obra + '\nWork stopped: ' + (p.detiene ? 'YES' : 'NO') +
         '\n\n' + p.descripcion + '\n\nAnswer from the app. SLA: 24 hours.'] });
  return { ok: true, id: id };
}

/** Recepcion de trabajo: el sub no cobra sin esto. */
function pmAprobarOT(token, otId) {
  const email = auth_(token);
  exigirRegistro_(email, SH.OT, otId, 1);
  const sh = hoja_(SH.OT);
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === otId) {
      sh.getRange(i + 1, 9).setValue('Aprobada');
      sh.getRange(i + 1, 12).setValue(new Date());
      sh.getRange(i + 1, 13).setValue(email);
      invalidar_(email);
      return { ok: true };
    }
  }
  throw new Error('No se encontro la orden ' + otId);
}

/**
 * Album de la obra: todas las fotos que el PM ha subido, por dia.
 * Se carga aparte para no engordar la pantalla de inicio.
 */
function pmAlbum(token, obraId) {
  const email = auth_(token);
  const suya = datos_(SH.PROYECTOS).some(r =>
    r[0] === obraId && String(r[5]).trim().toLowerCase() === email);
  if (!suya) throw new Error('Esa obra no esta asignada a ti.');

  const dias = [];
  datos_(SH.BITACORA).filter(r => r[2] === obraId && String(r[7] || '') !== '')
    .forEach(r => dias.push({
      tipo: 'dia', fecha: fecha_(r[1]), orden: r[1].getTime(),
      titulo: String(r[4] || 'Avance'), nota: String(r[6] || ''),
      fotos: String(r[7]).split(' | ').filter(Boolean)
    }));
  datos_(SH.BLOQUEOS).filter(r => r[2] === obraId && String(r[5] || '') !== '')
    .forEach(r => dias.push({
      tipo: 'aviso', fecha: fecha_(r[1]), orden: r[1].getTime(),
      titulo: 'Aviso · ' + r[3], nota: String(r[4] || ''),
      fotos: String(r[5]).split(' | ').filter(Boolean)
    }));

  dias.sort((a, b) => b.orden - a.orden);
  dias.forEach(d => { delete d.orden; });
  return dias;
}

// ------------------------------------------------------------------ calidad

/**
 * Inspeccion de un punto de control. Sin fotos no se aprueba:
 * lo que se cubre hoy no se vuelve a ver nunca.
 */
function pmInspeccion(token, p) {
  const email = auth_(token);
  const obras = misObras_(email).map(r => r[0]);
  if (obras.indexOf(p.obra) < 0) throw new Error('Esa obra no esta asignada a ti.');
  if (!p.fotos || !p.fotos.length) {
    throw new Error('La inspeccion necesita fotos. Es la unica evidencia que va a quedar.');
  }

  // El servidor cuenta contra la lista REAL del punto de control; no le cree al telefono.
  // "No aplica" saca la pregunta del total, pero queda registrada con su texto.
  let ok, total, defectos, noAplica = [];
  if (Array.isArray(p.cumple)) {
    const puntos = datos_(SH.CHECKLIST).filter(r => r[0] === p.hito).map(r => String(r[2]));
    if (!puntos.length) {
      throw new Error('Este punto de control no tiene preguntas. Pidele al administrador que las agregue.');
    }
    noAplica = puntos.filter(x => (p.noAplica || []).indexOf(x) >= 0);
    const aplican = puntos.filter(x => noAplica.indexOf(x) < 0);
    if (!aplican.length) throw new Error('Una inspeccion necesita al menos un punto que aplique.');
    defectos = aplican.filter(x => p.cumple.indexOf(x) < 0);
    total = aplican.length;
    ok = total - defectos.length;
  } else {                                        // formato anterior del telefono
    total = Number(p.total) || 0; ok = Number(p.ok) || 0; defectos = p.defectos || [];
  }
  const aprobado = ok === total && total > 0 && !defectos.length;

  // PC3 no se aprueba sin la prueba de inundacion de ESA area
  if (aprobado && /^PC3\b/i.test(String(p.hito).trim())) {
    const a = datos_(SH.AGUA).filter(x => x[1] === p.obra && x[7] === 'Sin fugas' &&
      (x[9] ? x[9] === p.area : true));
    if (!a.length) {
      throw new Error('La impermeabilizacion no se aprueba sin la prueba de inundacion terminada ' +
        'y sin fugas. Inicia la prueba desde la pantalla de calidad.');
    }
  }

  const ligas = guardarFotos_(p.fotos, 'CAL_' + p.obra + '_' + sello_());
  const id = conCandado_(function () {
    const nuevo = siguienteId_(SH.CALIDAD, 'CAL', 4);
    hoja_(SH.CALIDAD).appendRow([
      nuevo, new Date(), p.obra, p.hito, p.partida || '',
      aprobado ? 'Aprobado' : 'Con defectos', ok, total,
      defectos.join('; '), ligas, email, new Date(),
      p.area || areaPorPartida_(p.obra, p.partida), noAplica.join(' | ')
    ]);
    return nuevo;
  });
  invalidar_(email);

  if (!aprobado) avisarDueno_({
    es: ['[CALIDAD ' + id + '] ' + p.obra + ' - ' + p.hito,
         'Punto de control con defectos.\n\nObra: ' + p.obra + '\nHito: ' + p.hito +
         '\nPuntos OK: ' + ok + ' de ' + total + '\n\nFallaron:\n- ' + defectos.join('\n- ') +
         (noAplica.length ? '\n\nMarcados como no aplica:\n- ' + noAplica.join('\n- ') : '')],
    en: ['[QUALITY ' + id + '] ' + p.obra + ' - ' + p.hito,
         'Checkpoint with defects.\n\nJob: ' + p.obra + '\nCheckpoint: ' + p.hito +
         '\nItems passed: ' + ok + ' of ' + total + '\n\nFailed:\n- ' + defectos.join('\n- ') +
         (noAplica.length ? '\n\nMarked as N/A:\n- ' + noAplica.join('\n- ') : '')] });

  return { ok: true, id: id, aprobado: aprobado, defectos: defectos.length, noAplica: noAplica.length };
}

/** Arranca la prueba de inundacion. Foto del nivel al inicio. */
function pmPruebaInicio(token, obraId, foto, areaId) {
  const email = auth_(token);
  exigirObra_(email, obraId);
  if (!foto) throw new Error('La prueba arranca con la foto del nivel de agua.');
  const liga = guardarFotos_([foto], 'AGUA_INI_' + obraId + '_' + sello_());
  const id = conCandado_(function () {
    if (datos_(SH.AGUA).find(x => x[1] === obraId && x[7] === 'En curso' &&
        (x[9] || '') === (areaId || ''))) {
      throw new Error('Ya hay una prueba en curso en esta area.');
    }
    const nuevo = siguienteId_(SH.AGUA, 'AGU', 4);
    hoja_(SH.AGUA).appendRow([nuevo, obraId, new Date(), liga, '', '', '', 'En curso', email,
                              areaId || '']);
    return nuevo;
  });
  invalidar_(email);
  return { ok: true, id: id };
}

/** Cierra la prueba. Menos de 23 horas no cuenta. */
function pmPruebaFin(token, pruebaId, foto, hayFuga) {
  const email = auth_(token);
  exigirRegistro_(email, SH.AGUA, pruebaId, 1);
  if (!foto) throw new Error('La prueba se cierra con la foto del nivel de agua.');
  const sh = hoja_(SH.AGUA);
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] !== pruebaId) continue;
    const horas = Math.round((new Date() - v[i][2]) / 3600000 * 10) / 10;
    if (horas < 23) {
      throw new Error('Llevan ' + horas + ' horas. La prueba es de 24. ' +
        'Cerrarla antes no prueba nada; dejala correr y vuelve.');
    }
    const liga = guardarFotos_([foto], 'AGUA_FIN_' + pruebaId);
    sh.getRange(i + 1, 5).setValue(new Date());
    sh.getRange(i + 1, 6).setValue(liga);
    sh.getRange(i + 1, 7).setValue(horas);
    sh.getRange(i + 1, 8).setValue(hayFuga ? 'Con fuga' : 'Sin fugas');
    invalidar_(email);
    if (hayFuga) avisarDueno_({
      es: ['[FUGA] Prueba de inundacion ' + pruebaId,
           'La prueba de inundacion de ' + v[i][1] + ' marco fuga despues de ' + horas + ' horas.'],
      en: ['[LEAK] Flood test ' + pruebaId,
           'The flood test on ' + v[i][1] + ' found a leak after ' + horas + ' hours.'] });
    return { ok: true, horas: horas, fuga: !!hayFuga };
  }
  throw new Error('Prueba no encontrada.');
}

function avisarDueno_(textos) {
  const correo = correoDueno_();
  if (!correo) return;          // la app del administrador muestra que falta el correo de avisos
  const t = textos[idiomaAdmin_()] || textos.es;
  try { MailApp.sendEmail(correo, t[0], t[1]); } catch (e) { /* el registro ya quedo */ }
}

// ---------------------------------------------------- entrega y punch list

/**
 * Recorrido de entrega: se anota TODO lo que senala el cliente, sin discutir
 * nada en el momento. La clasificacion se hace despues, no enfrente de el.
 */
function pmPunch(token, p) {
  const email = auth_(token);
  const obras = misObras_(email).map(r => r[0]);
  if (obras.indexOf(p.obra) < 0) throw new Error('Esa obra no esta asignada a ti.');
  if (!p.item || p.item.length < 4) throw new Error('Describe el detalle que senalo el cliente.');

  const liga = p.foto ? guardarFotos_([p.foto], 'PUN_' + p.obra + '_' + sello_()) : '';
  const id = conCandado_(function () {
    const nuevo = siguienteId_(SH.PUNCH, 'PUN', 4);
    hoja_(SH.PUNCH).appendRow([
      nuevo, p.obra, new Date(), p.item, p.origen || 'Defecto', p.responsable || '',
      masDiasHabiles_(7), 'Abierto', '', liga, email
    ]);
    return nuevo;
  });
  invalidar_(email);
  return { ok: true, id: id };
}

/** 7 dias habiles: la regla de cierre del punch list. */
function masDiasHabiles_(n) {
  const f = new Date();
  let c = 0;
  while (c < n) {
    f.setDate(f.getDate() + 1);
    const d = f.getDay();
    if (d !== 0 && d !== 6) c++;
  }
  return f;
}

function pmCerrarPunch(token, punchId, foto) {
  const email = auth_(token);
  exigirRegistro_(email, SH.PUNCH, punchId, 1);
  const sh = hoja_(SH.PUNCH);
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] !== punchId) continue;
    sh.getRange(i + 1, 8).setValue('Cerrado');
    sh.getRange(i + 1, 9).setValue(new Date());
    if (foto) {
      const previo = String(v[i][9] || '');
      const nueva = guardarFotos_([foto], 'PUN_FIN_' + punchId);
      sh.getRange(i + 1, 10).setValue(previo ? previo + ' | ' + nueva : nueva);
    }
    invalidar_(email);
    return { ok: true };
  }
  throw new Error('Detalle no encontrado.');
}

/**
 * Medida verificada en sitio. Es el numero real, no el del plano, y es
 * el que convierte todos tus costos en costo por pie cuadrado.
 */
function pmMedida(token, areaId, pies2, lineales) {
  const email = auth_(token);
  const sh = hoja_(SH.AREAS);
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] !== areaId) continue;
    const obras = misObras_(email).map(r => r[0]);
    if (obras.indexOf(v[i][1]) < 0) throw new Error('Esa obra no esta asignada a ti.');
    const p2 = Number(pies2) || 0;
    if (p2 <= 0) throw new Error('Captura los pies cuadrados del area.');
    const antes = v[i][4];
    sh.getRange(i + 1, 5).setValue(p2);
    if (lineales !== undefined && lineales !== '') sh.getRange(i + 1, 6).setValue(Number(lineales) || 0);
    if (antes && Number(antes) !== p2) {
      bitacoraCorreccion_(email, SH.AREAS, areaId, 'Editar', 'pies2', antes, p2,
        'Medida verificada en sitio');
    }
    // el total del proyecto no se guarda: es la suma de sus espacios
    delete _memo[SH.AREAS];
    const total = areasDe_(v[i][1]).filter(a => !a.generales).reduce((a, x) => a + x.pies2, 0);
    invalidar_(email);
    return { ok: true, total: total };
  }
  throw new Error('Area no encontrada.');
}

// --------------------------------------------- correcciones del PM (48 horas)

/** Lo que el PM capturo en las ultimas 48 horas y todavia puede corregir. */
function pmCorregibles(token) {
  const email = auth_(token);
  const corte = new Date(Date.now() - 48 * 3600000);
  const obras = misObras_(email).map(r => r[0]);
  const nombres = {};
  datos_(SH.TRABAJADORES).forEach(t => { nombres[t[0]] = t[1]; });

  const out = [];
  datosTodos_(SH.GASTOS).filter(g => String(g[10]).toLowerCase() === email && g[1] >= corte)
    .forEach(g => out.push({ hoja: 'Gastos', id: g[0], fecha: fecha_(g[1]), obra: g[2],
      titulo: '$' + (Number(g[6]) || 0).toLocaleString('en-US') + ' · ' + (g[4] || ''),
      detalle: (g[5] || '') + (g[12] ? ' · ' + g[12] : ''),
      anulado: String(g[13]) === 'Anulado',
      campos: { monto: Number(g[6]) || 0, proveedor: g[4] || '', descripcion: g[5] || '',
                partida: g[12] || '' } }));
  datosTodos_(SH.MANO_OBRA).filter(x => String(x[6]).toLowerCase() === email && x[1] >= corte)
    .forEach(x => out.push({ hoja: 'Mano_Obra', id: x[0], fecha: fecha_(x[1]), obra: x[2],
      titulo: (nombres[x[3]] || x[3]) + ' · ' + tiempoTexto_(x[3], Number(x[5]) || 0),
      detalle: x[4] || 'sin partida', anulado: String(x[8]) === 'Anulado',
      campos: { horas: Number(x[5]) || 0, partida: x[4] || '' } }));
  datosTodos_(SH.AVANCE).filter(x => String(x[5]).toLowerCase() === email && x[1] >= corte)
    .forEach(x => out.push({ hoja: 'Avance', id: x[0], fecha: fecha_(x[1]), obra: x[2],
      titulo: x[3], detalle: 'marcada como ' + x[4], anulado: String(x[7]) === 'Anulado',
      campos: {} }));

  return out.filter(x => obras.indexOf(x.obra) >= 0)
            .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

function pmCorregir(token, hoja, id, cambios, motivo) {
  const email = auth_(token);
  if (hoja === 'Mano_Obra' && cambios && 'horas' in cambios) {
    const m = datos_(SH.MANO_OBRA).find(r => r[0] === id);
    if (m) validarHoras_(m[3], m[1], cambios.horas, id);
  }
  const r = aplicarCorreccion_(email, hoja, id, cambios, motivo, 48, true);
  invalidar_(email);
  return r;
}

function pmAnular(token, hoja, id, motivo) {
  const email = auth_(token);
  const r = aplicarAnulacion_(email, hoja, id, motivo, 48, true);
  invalidar_(email);
  return r;
}

/** Anula el cierre completo de un dia: bitacora, horas y avance de ese dia. */
function pmAnularCierre(token, bitacoraId, motivo) {
  const email = auth_(token);
  const b = buscarFila_(SH.BITACORA, bitacoraId);
  const dia = fecha_(b.datos[1]);
  const obra = b.datos[2];
  aplicarAnulacion_(email, SH.BITACORA, bitacoraId, motivo, 48, true);

  let n = 1;
  datosTodos_(SH.MANO_OBRA).filter(x => x[2] === obra && fecha_(x[1]) === dia &&
      String(x[6]).toLowerCase() === email && String(x[8]) !== 'Anulado')
    .forEach(x => { try { aplicarAnulacion_(email, SH.MANO_OBRA, x[0], motivo, 48, true); n++; } catch (e) {} });
  datosTodos_(SH.AVANCE).filter(x => x[2] === obra && fecha_(x[1]) === dia &&
      String(x[5]).toLowerCase() === email && String(x[7]) !== 'Anulado')
    .forEach(x => { try { aplicarAnulacion_(email, SH.AVANCE, x[0], motivo, 48, true); n++; } catch (e) {} });

  invalidar_(email);
  return { ok: true, registros: n };
}

/** Confirmacion T-48h: el sub confirmo por escrito antes de la fecha de arranque. */
function pmConfirmarOT(token, otId) {
  const email = auth_(token);
  exigirRegistro_(email, SH.OT, otId, 1);
  const sh = hoja_(SH.OT);
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === otId) {
      sh.getRange(i + 1, 9).setValue('Confirmada');
      sh.getRange(i + 1, 10).setValue(new Date());
      invalidar_(email);
      return { ok: true };
    }
  }
  throw new Error('No se encontro la orden ' + otId);
}

/** Registro de cuadrilla fuera del cierre de dia. */
function pmManoObra(token, p) {
  const email = auth_(token);
  exigirObra_(email, p.obra);
  const horas = conCandado_(function () {
    validarCuadrilla_(p.cuadrilla, new Date());
    return registrarCuadrilla_(email, p.obra, p.cuadrilla, p.partida, new Date());
  });
  if (!horas) throw new Error('Selecciona al menos un trabajador con horas.');
  invalidar_(email);
  return { ok: true, horas: horas };
}

// ------------------------------------------------------ velocidad: guardar y ver en un solo viaje
/*
 * Ejecuta la accion (con sus validaciones y su registro de errores, igual que si se llamara directo) y en el
 * mismo viaje regresa la app del PM ya actualizada. Solo acepta las acciones de la lista.
 */
function pmHacer(token, fn, args) {
  auth_(token);
  if (HACER_PM_.indexOf(fn) < 0) throw new Error('Esa acción no se puede hacer así.');
  const g = (function () { return this; })() || globalThis;
  const r = g[fn].apply(null, [token].concat(args || []));
  for (const k in _memo) delete _memo[k];                  // lo recien escrito se vuelve a leer
  return { r: r, datos: pmDatos(token) };
}

/*
 * Las fotos del cierre llegan despues del cierre, una por una: el PM ve su dia cerrado sin esperar a que
 * suban. Cada foto trae su numero: si la senal falla y se reintenta, la que ya llego no se guarda dos veces.
 */
function pmSubirFotoCierre(token, bitId, foto, indice) {
  const email = auth_(token);
  const n = String(Number(indice));
  const b = datos_(SH.BITACORA).find(r => r[0] === bitId);
  if (!b) throw new Error('No encontré ese cierre.');
  exigirObra_(email, b[2]);
  if (!foto || !foto.data) throw new Error('Falta la foto.');
  if (String(b[11] || '').split(',').indexOf(n) < 0) return { ok: true, repetida: true };   // ya habia llegado
  const liga = guardarFotos_([foto], 'BIT_' + b[2] + '_' + bitId + '_' + n);
  const r = conCandado_(function () {
    const sh = hoja_(SH.BITACORA), ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
    let fila = 0;
    for (let i = 1; i < ids.length; i++) if (ids[i][0] === bitId) { fila = i + 1; break; }
    if (!fila) throw new Error('No encontré ese cierre.');
    const v = sh.getRange(fila, 8, 1, 5).getValues()[0];                 // fotos ... fotos_pendientes
    const faltan = String(v[4] || '').split(',').filter(Boolean);
    if (faltan.indexOf(n) < 0) return { repetida: true };                  // otra copia llego primero
    const quedan = faltan.filter(x => x !== n);
    sh.getRange(fila, 8).setValue([String(v[0] || '')].filter(Boolean).concat([liga]).join(' | '));
    sh.getRange(fila, 12).setValue(quedan.join(','));
    return { quedan: quedan.length };
  });
  invalidar_(email);
  return { ok: true, quedan: r.quedan || 0, repetida: !!r.repetida };
}

// pm/final.js
// Solo de la app del PM. Lo compartido está en comun/. Después de editar, corre construir.py.

// al final de todo: cada funcion publica registra sus errores inesperados
envolverPublicas_('pm');
