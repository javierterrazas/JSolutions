// comun/utilidades.js — Funciones compartidas de uso general.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

let _ss = null;

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

/*
 * Nombres sin importar acentos ni ñ: "Rough de plomeria" y "Rough de plomería" son la misma partida, y
 * "Bano" y "Baño" el mismo tipo. Los libros anteriores tienen los nombres sin acentos: siguen funcionando.
 * (Sin normalize(): una tabla explicita, igual en cualquier motor.)
 */
const SIN_ACENTOS_ = { 'á':'a','é':'e','í':'i','ó':'o','ú':'u','ü':'u','ñ':'n','Á':'a','É':'e','Í':'i','Ó':'o','Ú':'u','Ü':'u','Ñ':'n' };
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
