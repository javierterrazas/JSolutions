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
