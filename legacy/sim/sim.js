// Un mes de obra con el codigo real: 2 PMs, 4 obras de ~3 semanas, problemas y respuestas del administrador.
const B = require('./base.js');
const { reloj, H, ADMIN, PMSRV, CORREOS, diario, hallazgo, llama, haz, foto, iso } = B;
const S = H.SHEETS;

// ================================================================= calendario: 5 semanas habiles
const DIAS = [];
for (let d = new B.RealDate('2026-10-05T12:00:00'); DIAS.length < 30; d = new B.RealDate(d.getTime() + 86400000))
  if (d.getDay() !== 0 && d.getDay() !== 6) DIAS.push(iso(d));
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// ================================================================= planes por tipo de espacio
// d: dias de trabajo · q: crew | pm | SUB-xx | VIDRIO · ot: precio del sub · g: [monto, categoria, descripcion]
// dep: partidas que deben estar terminadas (por defecto, la anterior) · espera: dias habiles de fabricacion
const PLANTILLAS = {
  Baño: [
    { p: 'Demolición y retiro de escombro', d: 2, q: 'crew', g: [85, 'Disposicion', 'Bolsas de escombro'] },
    { p: 'Rough de plomería', d: 2, q: 'SUB-01', ot: 1800, g: [260, 'Material', 'PEX y conexiones'] },
    { p: 'Rough eléctrico y extractor', d: 1, q: 'SUB-02', ot: 950, dep: ['Demolición y retiro de escombro'] },
    { p: 'Blocking y framing', d: 1, q: 'crew', g: [120, 'Material', 'Madera y tornilleria'], dep: ['Rough de plomería', 'Rough eléctrico y extractor'] },
    { p: 'Inspección rough-in', d: 1, q: 'pm' },
    { p: 'Cementboard y drywall', d: 1, q: 'crew', g: [310, 'Material', 'Cementboard y tornillos'] },
    { p: 'Impermeabilización + prueba de inundación', d: 1, q: 'crew', g: [240, 'Material', 'Membrana impermeable'], agua: true },
    { p: 'Tile de piso y muro', d: 3, q: 'SUB-03', ot: 3600, anticipo: 0.3, g: [1150, 'Material', 'Tile porcelanico y thinset'] },
    { p: 'Instalación de vanity', d: 1, q: 'crew', dep: ['Tile de piso y muro'] },
    { p: 'Plantilla de countertop', d: 1, q: 'pm', dep: ['Instalación de vanity'] },
    { p: 'Plantilla de puerta de vidrio', d: 1, q: 'pm', dep: ['Tile de piso y muro'] },
    { p: 'Lechada y sellado', d: 1, q: 'crew', g: [90, 'Material', 'Lechada epoxica'], dep: ['Tile de piso y muro'] },
    { p: 'Pintura primera mano', d: 1, q: 'crew', g: [70, 'Material', 'Pintura y rodillos'], dep: ['Lechada y sellado'] },
    { p: 'Instalación de countertop', d: 1, q: 'SUB-05', ot: 1200, espera: 3, dep: ['Plantilla de countertop'] },
    { p: 'Plomería final y luminarias', d: 1, q: 'SUB-01', ot: 450, dep: ['Instalación de countertop'] },
    { p: 'Instalación de vidrio y accesorios', d: 1, q: 'VIDRIO', ot: 1100, espera: 3, dep: ['Plantilla de puerta de vidrio', 'Lechada y sellado'] },
  ],
  Cocina: [
    { p: 'Demolición y retiro de escombro', d: 2, q: 'crew', g: [140, 'Disposicion', 'Bolsas y rampa'] },
    { p: 'Rough de plomería', d: 1, q: 'SUB-01', ot: 900 },
    { p: 'Rough eléctrico', d: 2, q: 'SUB-02', ot: 1600, dep: ['Demolición y retiro de escombro'] },
    { p: 'Framing y blocking', d: 1, q: 'crew', g: [180, 'Material', 'Madera'], dep: ['Rough de plomería', 'Rough eléctrico'] },
    { p: 'Inspección rough-in', d: 1, q: 'pm' },
    { p: 'Drywall y acabado', d: 2, q: 'SUB-06', ot: 1400 },
    { p: 'Pintura primera mano', d: 1, q: 'crew', g: [110, 'Material', 'Pintura'] },
    { p: 'Piso', d: 2, q: 'crew', g: [1800, 'Material', 'Piso LVP 200 pies2'] },
    { p: 'Instalación de gabinetes', d: 2, q: 'crew', g: [260, 'Material', 'Tornilleria y calzas de gabinete'] },
    { p: 'Plantilla de countertop', d: 1, q: 'pm' },
    { p: 'Instalación de countertop', d: 1, q: 'SUB-05', ot: 4200, espera: 3 },
    { p: 'Backsplash', d: 2, q: 'SUB-03', ot: 1300, g: [420, 'Material', 'Tile de backsplash'] },
    { p: 'Plomería final', d: 1, q: 'SUB-01', ot: 400, dep: ['Instalación de countertop'] },
    { p: 'Eléctrico final y luminarias', d: 1, q: 'SUB-02', ot: 500, dep: ['Backsplash'] },
    { p: 'Instalación de appliances', d: 1, q: 'crew', dep: ['Instalación de gabinetes'] },
  ],
  Closet: [
    { p: 'Demolición', d: 1, q: 'crew', g: [40, 'Disposicion', 'Bolsas'] },
    { p: 'Reparación de muros', d: 1, q: 'crew', g: [60, 'Material', 'Compuesto y cinta'] },
    { p: 'Pintura', d: 1, q: 'crew', g: [55, 'Material', 'Pintura'] },
    { p: 'Instalación de estructura', d: 2, q: 'crew', g: [890, 'Material', 'Sistema de closet modular'] },
    { p: 'Instalación de puertas y herrajes', d: 1, q: 'crew', g: [230, 'Material', 'Puertas corredizas y herrajes'] },
    { p: 'Iluminación', d: 1, q: 'SUB-02', ot: 350 },
  ],
};
const GENERALES = [
  { p: 'Protección y movilización', d: 1, q: 'pm', g: [95, 'Material', 'Plastico y cinta de proteccion'], dia1: true },
  { p: 'Permisos e inspecciones', d: 1, q: 'pm', dia1: true },
  { p: 'Contenedor y disposición', d: 1, q: 'pm', g: [450, 'Disposicion', 'Contenedor 20 yardas'], dia1: true },
  { p: 'Limpieza final y punch list', d: 1, q: 'crew', final: true },
];
// preguntas que no aplican segun el tipo de espacio (la opcion "No aplica")
const NO_APLICA = { Cocina: /regadera|vanity|nicho|banco|barras|toallero|extractor/i,
                    Closet: /tile|lechada|sellador|regadera|plomeria|desague|countertop|gabinetes|extractor|piezas huecas|drenaje|presion/i };

// ================================================================= las cuatro obras
const OBRAS = [
  { k: 'A', pm: 'carlos', cliente: 'Familia Garza', dir: '4410 Duval St', contrato: 24000, arranque: 0, trab: 'TRB-01', porDia: false,
    areas: [{ tipo: 'Baño', nombre: 'Baño principal', pies2: 45 }] },
  { k: 'B', pm: 'carlos', cliente: 'Familia Nguyen', dir: '1802 E 12th St', contrato: 44000, arranque: 0, trab: 'TRB-02', porDia: false,
    areas: [{ tipo: 'Cocina', nombre: 'Cocina', pies2: 180, lineales: 22 }] },
  { k: 'C', pm: 'luis', cliente: 'Familia Okafor', dir: '905 W Mary St', contrato: 27500, arranque: 1, trab: 'TRB-03', porDia: false,
    areas: [{ tipo: 'Baño', nombre: 'Baño de visitas', pies2: 38 }, { tipo: 'Closet', nombre: 'Closet principal', pies2: 30 }] },
  { k: 'D', pm: 'luis', cliente: 'Familia Brennan', dir: '3317 Harris Park Ave', contrato: 26000, arranque: 1, trab: 'TRB-04', porDia: true,
    areas: [{ tipo: 'Baño', nombre: 'Baño principal', pies2: 60 }] },
];
const PIN = { carlos: '2468', luis: '1357' };
const TARIFA = { 'TRB-01': 32, 'TRB-02': 20, 'TRB-03': 35, 'TRB-04': 220 };

// ================================================================= estado de la simulacion
let TA = null;                      // sesion del administrador
const TP = {};                      // sesiones de los PMs
let VIDRIO_ID = null;
const LICENCIA_CAPTURADA = {};               // el sub de vidrio se da de alta a media simulacion
const pendienteOffline = [];        // cierres guardados sin senal
const METRICAS = { dias: {}, kpis: [], idle: [], avisosLimite: 0, cierres: 0, ots: 0 };
const avanceAyer = {};

function clave(t) { return t.area + '|' + t.p; }
function obraPorId(id) { return OBRAS.find(o => o.id === id); }
function dx(i) { return DIAS[i]; }

// ================================================================= alta de obras (viernes antes / lunes)
function altaObras() {
  reloj.fija('2026-10-02', '10:00'); B.setDia('vie 02-oct');
  TA = llama(ADMIN, 'duLogin', 'javier', '482915').token;
  OBRAS.forEach(o => {
    const r = haz('admin', ADMIN, 'duNuevaObra', [TA, { cliente: o.cliente, telefono: '512-555-01' + o.k.charCodeAt(0),
      direccion: o.dir + ', Austin TX', pm: o.pm, inicio: dx(o.arranque), finEst: dx(o.arranque + 14), contrato: o.contrato,
      areas: o.areas.map(a => ({ tipo: a.tipo, nombre: a.nombre, pies2: a.pies2, lineales: a.lineales || '' })) }]);
    o.id = r.id;
    diario(`Alta de ${o.id} · ${o.cliente} · ${o.areas.map(a => a.nombre).join(' + ')} · PM ${o.pm} · contrato $${o.contrato.toLocaleString()}`);
  });
}

// ================================================================= planes con las areas reales
function armarPlanes() {
  const tokenPM = { carlos: llama(PMSRV, 'pmLogin', 'carlos', PIN.carlos).token, luis: llama(PMSRV, 'pmLogin', 'luis', PIN.luis).token };
  OBRAS.forEach(o => {
    const d = llama(PMSRV, 'pmDatos', tokenPM[o.pm]);
    const od = d.obras.find(x => x.id === o.id);
    o.tareas = [];
    const gen = od.areas.find(a => a.generales);
    od.areas.filter(a => !a.generales).forEach(a => {
      const lista = PLANTILLAS[a.tipo].map(t => Object.assign({}, t, { area: a.id, areaNombre: a.nombre, tipo: a.tipo }));
      lista.forEach((t, i) => { t.depT = (t.dep ? t.dep.map(n => lista.find(x => x.p === n)) : (i ? [lista[i - 1]] : [])); });
      o.tareas.push(...lista);
    });
    GENERALES.forEach(g => o.tareas.push(Object.assign({}, g, { area: gen.id, areaNombre: gen.nombre, tipo: 'Generales', depT: [] })));
    const fin = o.tareas.find(t => t.final);
    fin.depT = o.tareas.filter(t => !t.final && t.tipo !== 'Generales');
    o.tareas.forEach(t => {
      const p = od.areas.find(a => a.id === t.area).partidas.find(x => x.partida === t.p);
      if (!p) hallazgo('ALTA', 'Partida del plan que no existe en el catálogo', t.p);
      t.hito = p ? p.hito : ''; t.hechos = 0; t.fin = null; t.inicio = null;
    });
    o.estado = 'obra'; o.fotosCerradas = 0;
  });
}

// ================================================================= disponibilidad de una tarea hoy
function disponible(o, t, i) {
  if (t.fin !== null || t.bloqueo || t.enPrueba) return false;
  if (t.dia1) return i === o.arranque;
  if (i < o.arranque) return false;
  for (const dep of t.depT) { if (dep.fin === null || dep.fin >= i) return false; }
  if (t.espera && t.depT.length && i - Math.max(...t.depT.map(x => x.fin)) <= t.espera) return false;
  if (t.q.startsWith('SUB') || t.q === 'VIDRIO') {
    if (!t.otId || t.otInicio > i) return false;
    if (t.noShow === i) return false;
  }
  return true;
}

// ================================================================= rutina del administrador (8:00)
function entraAdmin() { TA = llama(ADMIN, 'duLogin', 'javier', '482915').token; }
const FORZAR_EN_OBRA = process.env.EN_OBRA === '1';
function adminManana(i) {
  if (FORZAR_EN_OBRA) OBRAS.forEach(o => { if (o.arranque === i) { const f = S['Proyectos'].find(r => r[0] === o.id); if (f) f[9] = 'En obra'; } });
  reloj.fija(dx(i), '08:00');
  entraAdmin();                                  // la sesion dura 6 horas: se entra cada manana
  const d = haz('admin', ADMIN, 'duDatos', [TA]);
  if (!d) return;
  METRICAS.kpis.push({ dia: dx(i), top: d.kpis.filter(k => k.top).map(k => ({ n: k.nombre, v: k.real, s: k.sem })),
                       todos: d.kpis.map(k => ({ n: k.nombre, v: k.real, s: k.sem })) });
  // avisos: se responden en la manana, salvo el que se deja pasar a proposito
  d.bloqueos.forEach(b => {
    if (b.id === DEJAR_PASAR && i < DEJAR_PASAR_HASTA) return;
    const resp = RESPUESTAS[b.id] || 'Enterado. Avanza con lo que no dependa de esto; te confirmo hoy antes de las 2 pm.';
    const r = haz('admin', ADMIN, 'duResponderBloqueo', [TA, b.id, resp]);
    if (r) diario(`Admin responde ${b.id} (${b.obra}) en ${r.horas} h`);
    if (b.id === OC_DE_AVISO.id) crearOCDeAviso(i, b);
  });
  // ordenes de trabajo: el admin las emite desde "Esta semana" del sistema (el cronograma)
  const manana = dx(Math.min(i + 1, DIAS.length - 1));
  (d.semana && d.semana.porProgramar || []).forEach(x => {
    const o = OBRAS.find(y => y.id === x.obra); if (!o || o.estado !== 'obra') return;
    const t = o.tareas.find(y => y.area === x.areaId && y.p === x.partida); if (!t || t.otId) return;
    const sub = x.sub || (t.q === 'VIDRIO' ? VIDRIO_ID : t.q); if (!sub) return;
    const iniISO = x.iniISO > manana ? x.iniISO : manana, finISO = x.finISO > iniISO ? x.finISO : iniISO;
    const pedido = { obra: o.id, sub, oficio: '', partida: clave(t), alcance: t.p + ' segun plano; incluye mano de obra', precio: t.ot, inicio: iniISO, fin: finISO };
    let r = haz('admin', ADMIN, 'duCrearOT', [TA, pedido]);
    if (r && r.confirmar && /licencia/.test(r.msg) && !LICENCIA_CAPTURADA[sub]) {
      const fila = S['Subcontratistas'].slice(1).find(z => z[0] === sub);
      haz('admin', ADMIN, 'duGuardarSub', [TA, { id: sub, nombre: fila[1], oficio: fila[2], telefono: fila[3], contacto: fila[6] || '',
        correo: fila[7] || '', seguroVence: '2027-03-31', licencia: 'TECL-20417', licenciaVence: '2027-09-30', w9: true, activo: true }]);
      LICENCIA_CAPTURADA[sub] = true; diario('Admin captura la licencia del electricista y vuelve a emitir');
      r = haz('admin', ADMIN, 'duCrearOT', [TA, pedido]);
    }
    if (r && r.id) { t.otId = r.id; t.otInicio = Math.max(i + 1, DIAS.indexOf(iniISO) >= 0 ? DIAS.indexOf(iniISO) : i + 1); METRICAS.ots++;
      diario(`Admin emite ${r.id} desde "Esta semana" · ${o.id} ${t.p} · arranca ${iniISO}`); }
  });
  d.tablero.forEach(t => { METRICAS.primerAviso = METRICAS.primerAviso || {};
    const m = METRICAS.primerAviso[t.id] || (METRICAS.primerAviso[t.id] = {});
    if (t.atrasoPrevisto > 0 && m.previsto === undefined) m.previsto = i;
    if (t.atraso > 0 && m.vencido === undefined) m.vencido = i; });
  METRICAS.ppc = (d.kpis.find(k => /PPC/.test(k.nombre)) || {});
  // pagos a subs: anticipos confirmados y liquidaciones de trabajo aprobado
  const ots = S['Ordenes_Trabajo'].slice(1);
  const pagado = id => S['Pagos_Sub'].slice(1).filter(p => p[2] === id && String(p[11]) !== 'Anulado').reduce((a, p) => a + (Number(p[6]) || 0), 0);
  OBRAS.forEach(o => o.tareas.forEach(t => {
    if (!t.otId) return;
    const ot = ots.find(r => r[0] === t.otId); if (!ot) return;
    if (t.anticipo && ot[9] && !t.anticipoPagado) {
      const r = haz('admin', ADMIN, 'duPagoSub', [TA, { otId: t.otId, monto: Math.round(t.ot * t.anticipo), concepto: 'Anticipo', metodo: 'Zelle', referencia: 'ANT-' + t.otId }]);
      if (r && r.ok) { t.anticipoPagado = true; diario(`Admin paga anticipo de ${t.otId}: $${Math.round(t.ot * t.anticipo)}`); }
      else if (r && r.confirmar) diario(`Admin: el sistema frena el anticipo de ${t.otId} → ${r.msg.slice(0, 80)}…`);
    }
    if ((ot[8] === 'Aprobada') && !t.liquidado) {
      const saldo = (Number(ot[5]) || 0) - pagado(t.otId);
      if (saldo > 0) {
        const r = haz('admin', ADMIN, 'duPagoSub', [TA, { otId: t.otId, monto: saldo, concepto: 'Liquidacion', metodo: 'Cheque', referencia: 'CK-' + (3300 + METRICAS.ots) }]);
        if (r && r.ok) { t.liquidado = true; diario(`Admin liquida ${t.otId}: $${saldo}`); }
        else if (r && r.confirmar) { hallazgo('MEDIA', 'El sistema frena una liquidación de trabajo ya aprobado', r.msg); }
      } else t.liquidado = true;
    }
  }));
  (d.comprasLimite || []).forEach(g => { if (haz('admin', ADMIN, 'duRevisarGasto', [TA, g.id])) METRICAS.comprasRevisadas = (METRICAS.comprasRevisadas || 0) + 1; });
  d.tablero.filter(t => t.atraso > 0).forEach(t => { METRICAS.atrasos = METRICAS.atrasos || {}; METRICAS.atrasos[t.id] = t.atraso; });
  d.tablero.filter(t => t.estado === 'Sin presupuesto').forEach(t => {
    const o = OBRAS.find(x => x.id === t.id); if (!o || o.presupuesto) return;
    diario(`Admin ve en su Inicio que ${o.id} no puede arrancar: falta el presupuesto → lo captura`);
    capturarPresupuesto(o);
  });
  EVENTOS_ADMIN.filter(e => e.dia === i).forEach(e => e.hacer(i));
  if (FUGA.dia === i - 1 && !FUGA.nc) {
    const o = OBRAS.find(x => x.k === 'D');
    const r = haz('admin', ADMIN, 'duNoCalidad', [TA, { obra: o.id, tipo: 'Retrabajo', causa: 'Error de instalacion', sub: '', costo: 380, dias: 1,
      descripcion: 'Fuga en la prueba de inundación: traslape de membrana mal sellado en la esquina del plato. Se retira y se rehace.' }]);
    FUGA.nc = true; diario(`Admin registra el retrabajo de la fuga en ${o.id}: $380, 1 día${r ? ' (' + r.id + ')' : ' — FALLÓ'}`);
  }
  if (LLEGA_PISO.dia === i) { const tp = OBRAS.find(x => x.k === 'B').tareas.find(t => t.p === 'Piso'); tp.bloqueo = null; diario('Llega el piso LVP de OB-002'); }
}

// ================================================================= una OC desde el aviso del PM
const OC_DE_AVISO = { id: null };
function crearOCDeAviso(i, b) {
  const o = obraPorId(b.obra);
  const r = haz('admin', ADMIN, 'duCrearOC', [TA, { obra: o.id, motivo: 'Condición oculta', hallazgo: dx(i - 1),
    descripcion: 'Reemplazo de linea de agua galvanizada corroida por PEX, desde el muro hasta el calentador',
    costo: 820, precio: 1450, dias: 2, condicion: 'Al autorizar', bloqueoId: b.id }]);
  if (r && r.id) { o.ocGalv = r.id; diario(`Admin emite ${r.id} desde el aviso: $1,450 (margen ${(r.margen * 100).toFixed(0)}%)`); }
}

// ================================================================= llamadas del PM con sesion real
const ENTRO = {};
const SESION_VENCIDA = [];
function hazPM(pm, fn, resto, esperado) {
  let r = haz(pm, PMSRV, fn, [TP[pm]].concat(resto), esperado);
  if (r && r.sesionVencida) {
    const horas = ((reloj.ahora().getTime() - ENTRO[pm]) / 3600000).toFixed(1);
    SESION_VENCIDA.push({ pm, dia: dx(DIA_I), fn, horas, hora: reloj.ahora().toTimeString().slice(0, 5) });
    const lg = llama(PMSRV, 'pmLogin', pm, PIN[pm], 'es');
    TP[pm] = lg.token; ENTRO[pm] = reloj.ahora().getTime();
    r = haz(pm, PMSRV, fn, [TP[pm]].concat(resto), esperado);
  }
  return r;
}
let DIA_I = 0;

// ================================================================= jornada del PM
function jornadaPM(i, pm) {
  reloj.fija(dx(i), '06:55');
  if (PIN_EQUIVOCADO[pm] === i) {
    for (let n = 0; n < 5; n++) haz(pm, PMSRV, 'pmLogin', [pm, '0000', 'es']);
    const r = llama(PMSRV, 'pmLogin', pm, PIN[pm], 'es');
    diario(`${pm} teclea mal su PIN 5 veces → ${r.ok ? 'ENTRA (el bloqueo no funcionó)' : 'bloqueado: "' + r.msg + '"'}`);
    if (r.ok) hallazgo('ALTA', 'El bloqueo por intentos fallidos no se aplicó', pm);
    reloj.fija(dx(i), '07:12');
  }
  const lg = haz(pm, PMSRV, 'pmLogin', [pm, PIN[pm], 'es']);
  if (!lg || !lg.ok) { hallazgo('ALTA', 'Un PM no pudo entrar', pm + ': ' + (lg && lg.msg)); return; }
  TP[pm] = lg.token; ENTRO[pm] = reloj.ahora().getTime();
  // lo que quedo guardado sin senal se envia al abrir la app
  pendienteOffline.filter(x => x.pm === pm).forEach(x => {
    const r = hazPM(pm, 'pmCerrarDia', [x.payload]);
    if (r) diario(`${pm} recupera señal: se envía el cierre de ${x.obra} capturado ayer`);
    pendienteOffline.splice(pendienteOffline.indexOf(x), 1);
  });
  const d = haz(pm, PMSRV, 'pmDatos', [TP[pm]]);
  if (!d) return;
  const ajenas = d.obras.filter(x => !OBRAS.find(o => o.id === x.id && o.pm === pm));
  if (ajenas.length) hallazgo('CRÍTICA', 'Un PM ve obras que no son suyas', pm + ': ' + ajenas.map(x => x.id).join(', '));
  OBRAS.filter(o => o.pm === pm && o.olvidado).forEach(o => {
    const od = d.obras.find(x => x.id === o.id), f = od && (od.diasSinCierre || []).find(x => x.iso === dx(o.olvidado.dia));
    if (!f) return;
    const p = Object.assign({}, o.olvidado.payload, { tardio: f.iso, cuadrilla: o.olvidado.cuadrilla });
    const r = hazPM(pm, 'pmCerrarDia', [p]);
    diario(`${pm} abre la app: "te faltó cerrar el ${f.fecha}" → lo cierra tarde${r && r.ok ? ', con fecha de ese día' : ' — FALLÓ'}`);
    if (r && r.ok) METRICAS.cierreTardio = f.iso;
    o.olvidado = null;
  });
  d.respuestas.forEach(r => { if (!VISTAS[r.id]) { VISTAS[r.id] = true; diario(`${pm} lee la respuesta a ${r.id}: "${String(r.respuesta).slice(0, 60)}…"`); } });
  OBRAS.filter(o => o.pm === pm && o.estado === 'obra').forEach(o => jornadaObra(i, pm, o, d));
}
const VISTAS = {};

function jornadaObra(i, pm, o, d) {
  if (i < o.arranque) return;
  const od = d.obras.find(x => x.id === o.id);
  if (!od) { hallazgo('ALTA', 'La obra desapareció de la app del PM', o.id); return; }
  const hoy = o.tareas.filter(t => disponible(o, t, i));
  let crew = hoy.filter(t => t.q === 'crew');
  crew = crew.length ? [crew[0]] : [];
  const trabajadas = hoy.filter(t => t.q !== 'crew').concat(crew);
  const terminadas = [], subs = [], incid = [];
  EVENTOS_PM.filter(e => e.dia === i && e.obra === o.k && e.antes).forEach(e => e.hacer(i, pm, o, trabajadas, incid));
  // compras al arrancar una partida
  reloj.fija(dx(i), '10:15');
  trabajadas.forEach(t => {
    if (t.inicio === null) {
      t.inicio = i;
      if (t.g) {
        const sinRecibo = SIN_RECIBO.obra === o.k && SIN_RECIBO.dia === i && !SIN_RECIBO.hecho;
        const r = hazPM(pm, 'pmGasto', [{ obra: o.id, monto: t.g[0], categoria: t.g[1], proveedor: t.g[1] === 'Disposicion' ? 'WM Dumpsters' : 'Home Depot',
          descripcion: t.g[2], partida: clave(t), capturado: reloj.ahora().toISOString(), recibo: sinRecibo ? null : { mime: 'image/jpeg', data: 'x' } }]);
        if (r && r.aviso) { METRICAS.avisosLimite++; }
        if (sinRecibo && r) { SIN_RECIBO.hecho = true; SIN_RECIBO.id = r.id; diario(`${pm} compra en ${o.id} sin tomar foto del recibo (${r.id})`); }
      }
      if (t.q.startsWith('SUB') || t.q === 'VIDRIO') {
        const ot = S['Ordenes_Trabajo'].find(r => r[0] === t.otId);
        subs.push({ ot: t.otId, nombre: ot ? ot[2] : '', llego: true });
      }
    }
  });
  // sub que no llega
  o.tareas.forEach(t => { if (t.noShow === i && t.otId) { subs.push({ ot: t.otId, nombre: '', llego: false }); incid.push('El plomero no llegó; no contestó el teléfono'); } });
  // trabajo del dia
  trabajadas.forEach(t => {
    t.hechos++;
    if (t.hechos < t.d) return;
    if (t.agua) { iniciarPrueba(i, pm, o, t); return; }
    if (t.hito && !inspeccionar(i, pm, o, t, od)) return;
    t.fin = i; terminadas.push(t);
  });
  // la prueba de agua de ayer se revisa hoy a las 4
  o.tareas.filter(t => t.enPrueba && t.enPrueba.desde < i).forEach(t => cerrarPrueba(i, pm, o, t, od, trabajadas, terminadas));
  EVENTOS_PM.filter(e => e.dia === i && e.obra === o.k && !e.antes).forEach(e => e.hacer(i, pm, o, trabajadas, incid));
  // cierre de dia a las 4 pm
  reloj.fija(dx(i), '16:00');
  if (!trabajadas.length) {
    const por = esperaDe(o, i);
    METRICAS.idle.push({ dia: dx(i), obra: o.id, por });
    const motivo = /fabricación/.test(por) ? 'Esperando fabricación' : /sub|orden/.test(por) ? 'Esperando a un sub' :
                   /bloqueada/.test(por) ? 'Esperando material' : 'Otro';
    const r = hazPM(pm, 'pmCerrarDia', [{ obra: o.id, capturado: reloj.ahora().toISOString(), sinTrabajo: true, motivo, incidencia: por, subs }]);
    if (r && r.ok) { METRICAS.cierresSinTrabajo = (METRICAS.cierresSinTrabajo || 0) + 1; diario(`${pm} reporta ${o.id} sin trabajo: ${motivo} (${por})`); }
    return;
  }
  if (OLVIDA.obra === o.k && OLVIDA.dia === i) { diario(`${pm} se olvida de cerrar el día en ${o.id}`);
    o.olvidado = { dia: i, payload: { obra: o.id, partidas: trabajadas.map(clave), terminadas: terminadas.map(clave), cuadrilla: [], subs, fotos: foto(1) },
                   cuadrilla: crew.length ? [{ trabajador: o.trab, horas: o.porDia ? 1 : 8, partida: clave(crew[0]) }] : [] };
    return; }
  const cuad = crew.length ? [{ trabajador: o.trab, horas: o.porDia ? (HORAS_MAL.obra === o.k && HORAS_MAL.dia === i ? 2 : 1) : 8, partida: clave(crew[0]) }] : [];
  const payload = { obra: o.id, capturado: reloj.ahora().toISOString(), partidas: trabajadas.map(clave), terminadas: terminadas.map(clave),
    cuadrilla: cuad, subs, incidencia: incid.join('. '), fotos: foto(2) };
  if (SIN_SENAL.obra === o.k && SIN_SENAL.dia === null && i >= SIN_SENAL.desde) SIN_SENAL.dia = i;
  if (SIN_SENAL.obra === o.k && SIN_SENAL.dia === i) { pendienteOffline.push({ pm, obra: o.id, payload }); diario(`${pm} cierra ${o.id} en un sótano sin señal: queda en la cola`); return; }
  const r = hazPM(pm, 'pmCerrarDia', [payload]);
  if (r) {
    METRICAS.cierres++;
    o.ultimoCierre = r.id;
    const txt = trabajadas.map(t => t.p.split(' ')[0] + (terminadas.includes(t) ? '✓' : '')).join(', ');
    diario(`${pm} cierra ${o.id}: ${txt}${subs.length ? ' · subs: ' + subs.map(s => s.ot + (s.llego ? ' llegó' : ' NO llegó')).join(', ') : ''}`);
  } else terminadas.forEach(t => { t.fin = null; });
  // el PM aprueba lo que camino con el sub
  reloj.fija(dx(i), '16:30');
  terminadas.filter(t => t.otId).forEach(t => {
    const r = hazPM(pm, 'pmAprobarOT', [t.otId]);
    if (r) diario(`${pm} aprueba el trabajo de ${t.otId}`);
  });
  // confirmaciones por escrito de los subs que vienen manana
  o.tareas.filter(t => t.otId && t.otInicio === i + 1 && !t.confirmada).forEach(t => {
    const r = hazPM(pm, 'pmConfirmarOT', [t.otId]);
    if (r) t.confirmada = true;
  });
}
function esperaDe(o, i) {
  const t = o.tareas.find(x => x.fin === null && !x.final && !disponible(o, x, i));
  if (!t) return 'todo listo';
  if (t.bloqueo) return 'bloqueada: ' + t.p;
  if (t.enPrueba) return 'prueba de agua en curso';
  if (t.espera && t.depT.every(x => x.fin !== null)) return 'fabricación de ' + t.p.replace('Instalacion de ', '');
  if ((t.q.startsWith('SUB') || t.q === 'VIDRIO') && !t.otId) return 'sin orden de trabajo para ' + t.p;
  if ((t.q.startsWith('SUB') || t.q === 'VIDRIO') && t.otInicio > i) return 'esperando al sub de ' + t.p;
  return 'esperando ' + t.p;
}

// ================================================================= inspecciones y pruebas de agua
function inspeccionar(i, pm, o, t, od) {
  reloj.fija(dx(i), '15:30');
  const puntos = ((hazPM(pm, 'pmDatos', []) || {}).checklist || {})[t.hito] || []; const _p = puntos.map(x => x.punto);
  const na = NO_APLICA[t.tipo] ? _p.filter(x => NO_APLICA[t.tipo].test(x)) : [];
  const falla = (DEFECTO.obra === o.k && DEFECTO.hito === t.hito && !DEFECTO.hecho) ? _p.filter(x => /Blocking para barras/.test(x)) : [];
  const cumple = _p.filter(x => na.indexOf(x) < 0 && falla.indexOf(x) < 0);
  const r = hazPM(pm, 'pmInspeccion', [{ obra: o.id, hito: t.hito, partida: t.p, area: t.area, cumple, noAplica: na, fotos: foto(3) }]);
  if (!r) return false;
  if (falla.length) { DEFECTO.hecho = true; t.hechos--; diario(`${pm} inspecciona ${t.hito} en ${o.id}: DEFECTO — falta blocking para la barra de apoyo`); return false; }
  diario(`${pm} inspecciona ${t.hito} en ${o.id}: aprobada${na.length ? ' (' + na.length + ' no aplican)' : ''}`);
  return r.aprobado;
}
function iniciarPrueba(i, pm, o, t) {
  reloj.fija(dx(i), '15:00');
  const r = hazPM(pm, 'pmPruebaInicio', [o.id, foto(1)[0], t.area]);
  if (r) { t.enPrueba = { id: r.id, desde: i }; diario(`${pm} arranca la prueba de inundación en ${o.id} (${r.id})`); }
}
function cerrarPrueba(i, pm, o, t, od, trabajadas, terminadas) {
  reloj.fija(dx(i), '16:00');
  const fuga = FUGA.obra === o.k && !FUGA.hecho;
  const r = hazPM(pm, 'pmPruebaFin', [t.enPrueba.id, foto(1)[0], fuga]);
  if (!r) return;
  t.enPrueba = null;
  if (fuga) {
    FUGA.hecho = true; t.hechos = 0; t.inicio = null; FUGA.dia = i;
    diario(`${pm} cierra la prueba en ${o.id}: FUGA tras ${r.horas} h → se rehace la impermeabilización`);
    trabajadas.push(t); return;
  }
  diario(`${pm} cierra la prueba en ${o.id}: ${r.horas} h sin fugas`);
  if (!trabajadas.includes(t)) trabajadas.push(t);
  if (inspeccionar(i, pm, o, t, od)) { t.fin = i; terminadas.push(t); }
}

// ================================================================= problemas del mes (escenario)
let DEJAR_PASAR = null, DEJAR_PASAR_HASTA = 0;
const RESPUESTAS = {};
const PIN_EQUIVOCADO = { luis: 4 };
const OLVIDA = { obra: 'A', dia: 5 };
const SIN_SENAL = { obra: 'B', desde: 6, dia: null };
const SIN_RECIBO = { obra: 'C', dia: 3 };
const HORAS_MAL = { obra: 'D', dia: 3 };
const DEFECTO = { obra: 'C', hito: 'PC2 Pre-cierre de muros' };
const FUGA = { obra: 'D' };

const EVENTOS_PM = [
  // A · detras del muro hay tuberia galvanizada podrida: aviso que detiene la obra
  { dia: 2, obra: 'A', antes: false, hacer(i, pm, o) {
      reloj.fija(dx(i), '11:40');
      const r = hazPM(pm, 'pmBloqueo', [{ obra: o.id, tipo: 'Condición oculta', detiene: true, fotos: foto(2),
        descripcion: 'Detrás del muro húmedo la línea de agua es galvanizada y está corroída. Hay que cambiar a PEX hasta el calentador antes del rough. ¿Se cotiza?' }]);
      if (r) { OC_DE_AVISO.id = r.id; RESPUESTAS[r.id] = 'Cotizo la OC hoy. Mientras, que el electricista avance con su rough.';
               o.tareas.find(t => t.p === 'Rough de plomería').bloqueo = 'OC'; diario(`${pm} levanta aviso ${r.id} en ${o.id}: tubería galvanizada corroída (detiene)`); }
  } },
  // B · el piso llega tarde; el aviso se contesta tarde a proposito (SLA)
  { dia: 7, obra: 'B', antes: false, hacer(i, pm, o) {
      reloj.fija(dx(i), '09:30');
      const r = hazPM(pm, 'pmBloqueo', [{ obra: o.id, tipo: 'Material', detiene: false, fotos: [],
        descripcion: 'El proveedor dice que el piso LVP llega hasta el lunes. ¿Esperamos o cambiamos de proveedor?' }]);
      if (r) { DEJAR_PASAR = r.id; DEJAR_PASAR_HASTA = 9; RESPUESTAS[r.id] = 'Esperamos, el cliente ya lo aprobó. Adelanta lo que puedas.';
               const tp = o.tareas.find(t => t.p === 'Piso');
               if (tp.fin === null) { tp.bloqueo = 'material'; LLEGA_PISO.dia = 10; }
               diario(`${pm} levanta aviso ${r.id} en ${o.id}: el piso llega tarde`); }
  } },
  // C · el plomero no llega el dia de su orden
  { dia: 0, obra: 'C', antes: true, hacer() {} },
  // B · el cliente pide cambiar el backsplash por marmol
  { dia: 9, obra: 'B', antes: false, hacer(i, pm, o) { CAMBIO_MARMOL.pedido = i; diario(`La clienta de ${o.id} pide backsplash de mármol`); } },
  // A · Carlos cierra por error la obra equivocada y lo deshace
  { dia: 8, obra: 'A', antes: false, hacer(i, pm, o, trabajadas) {
      reloj.fija(dx(i), '15:50');
      const ob = obraPorId(OBRAS.find(x => x.k === 'B').id);
      const tb = ob.tareas.filter(t => t.inicio !== null && t.fin === null).slice(0, 1);
      if (!tb.length) { diario('(el evento de la obra equivocada no aplicó: no había partida abierta en ' + ob.id + ')'); return; }
      // Carlos tiene seleccionada la obra B pero cree que es la A: manda el dia de B cuando queria mandar A
      const r = hazPM(pm, 'pmCerrarDia', [{ obra: ob.id, capturado: reloj.ahora().toISOString(),
        partidas: tb.map(clave), terminadas: [], cuadrilla: [], subs: [], incidencia: 'Día de la obra A capturado aquí por error', fotos: foto(1) }]);
      if (r && r.id) {
        const u = hazPM(pm, 'pmAnularCierre', [r.id, 'Cerré la obra equivocada']);
        diario(`${pm} manda el cierre de ${o.id} a ${ob.id} por error → ${u ? 'lo deshace' : 'NO lo puede deshacer'}`);
      } else if (r && r.rechazado) diario(`${pm} intenta cerrar ${ob.id} con partidas de ${o.id}: el sistema lo rechaza (${r.msg.slice(0, 60)})`);
      else if (r === null) {}
  } },
];
const CAMBIO_MARMOL = { pedido: null, oc: null };
EVENTOS_PM.push(
  // D · Luis capturo 2 dias al trabajador por dia; lo corrige a la manana siguiente (dentro de 48 h)
  { dia: 4, obra: 'D', antes: true, hacer(i, pm, o) {
      reloj.fija(dx(i), '07:20');
      const m = S['Mano_Obra'].slice(1).find(r => r[2] === o.id && Number(r[5]) === 2);
      if (!m) { diario('(no encontré la captura de 2 días para corregir)'); return; }
      const r = hazPM(pm, 'pmCorregir', ['Mano_Obra', m[0], { horas: 1 }, 'Eran 1 día, no 2']);
      diario(`${pm} corrige ${m[0]}: 2 días → 1 día ${r && r.ok !== false ? '(queda el rastro en Correcciones)' : 'FALLÓ'}`);
  } },
  // C · adjunta el recibo que no fotografio
  { dia: 7, obra: 'C', antes: true, hacer(i, pm, o) {
      if (!SIN_RECIBO.id) return;
      reloj.fija(dx(i), '07:30');
      const r = hazPM(pm, 'pmSubirRecibo', [SIN_RECIBO.id, { mime: 'image/jpeg', data: 'x' }]);
      diario(`${pm} adjunta el recibo de ${SIN_RECIBO.id}, 4 días hábiles después`);
  } }
);
const LLEGA_PISO = { dia: null };

const EVENTOS_ADMIN = [
  // la oficina compra los gabinetes de la cocina (antes no habia donde registrarlos)
  { dia: 9, hacer(i) {
      const o = OBRAS.find(x => x.k === 'B'), t = o.tareas.find(x => x.p === 'Instalación de gabinetes');
      const r = haz('admin', ADMIN, 'duGasto', [TA, { obra: o.id, monto: 9200, categoria: 'Material', proveedor: 'Cabinet Depot Austin',
        metodo: 'Transferencia', descripcion: 'Gabinetes shaker blancos, 14 piezas', factura: 'CD-88213', partida: clave(t) }]);
      diario(`Admin registra la compra de gabinetes de ${o.id} desde la oficina: $9,200${r ? ' (' + r.id + ')' : ' — FALLÓ'}`);
  } },
  // dia 0: presupuestos (se le olvida el de D), depositos
  { dia: 0, hacer(i) {
      OBRAS.forEach(o => {
        if (o.k !== 'D') capturarPresupuesto(o);
        const r = haz('admin', ADMIN, 'duCobro', [TA, { obra: o.id, monto: Math.round(o.contrato * 0.3), concepto: 'Deposito', metodo: 'Transferencia', referencia: 'DEP-' + o.id }]);
        if (r) diario(`Admin registra depósito de ${o.id}: $${Math.round(o.contrato * 0.3).toLocaleString()}`);
      });
  } },
  // el cliente de A firma la OC de la tuberia dos dias despues
  { dia: 4, hacer(i) {
      const o = OBRAS.find(x => x.k === 'A');
      if (!o.ocGalv) { hallazgo('ALTA', 'La OC del aviso no se creó', ''); return; }
      reloj.fija(dx(i), '09:00');
      haz('admin', ADMIN, 'duEstadoOC', [TA, o.ocGalv, 'Autorizada']);
      const c = haz('admin', ADMIN, 'duCobro', [TA, { obra: o.id, monto: 1450, concepto: 'Orden de cambio', metodo: 'Zelle', referencia: o.ocGalv }]);
      haz('admin', ADMIN, 'duEstadoOC', [TA, o.ocGalv, 'Facturada']);
      o.tareas.find(t => t.p === 'Rough de plomería').bloqueo = null;
      // el trabajo extra del plomero va en una orden aparte: el precio de una orden no se edita
      const t = o.tareas.find(t => t.p === 'Rough de plomería');
      const r = haz('admin', ADMIN, 'duCrearOT', [TA, { obra: o.id, sub: 'SUB-01', oficio: '', partida: clave(t), alcance: 'Extra: cambio de galvanizado a PEX (OC)', precio: 600, inicio: dx(i + 1), fin: dx(i + 1) }]);
      diario(`Cliente de ${o.id} firma ${o.ocGalv} → autorizada, cobrada y facturada; ${r ? r.id + ' extra al plomero $600' : ''}`);
      t.otExtra = r && r.id;
  } },
  // el dia de la orden del plomero de C, no llega; el admin reprograma
  { dia: 3, hacer(i) {} },
  // el vidriero se da de alta a media obra
  { dia: 7, hacer(i) {
      const r = haz('admin', ADMIN, 'duGuardarSub', [TA, { nombre: 'Austin Shower Glass', oficio: 'Vidrio', telefono: '512-555-0177', contacto: 'Mark',
        correo: 'mark@asg.com', seguroVence: '2027-06-30', w9: true, activo: true }]);
      if (r) { VIDRIO_ID = r.id; diario(`Admin da de alta al vidriero: ${r.id}${r.avisos && r.avisos.length ? ' (avisos: ' + r.avisos.join('; ') + ')' : ''}`); }
  } },
  // el admin agrega una partida al catalogo de baño con obras en curso
  { dia: 10, hacer(i) {
      const antes = avancesAhora();
      const r = haz('admin', ADMIN, 'duGuardarPartida', [TA, { tipo: 'Baño', orden: 17, partida: 'Nicho de regadera a medida', hito: '', peso: 4 }]);
      const despues = avancesAhora();
      const bajaron = Object.keys(antes).filter(k => despues[k] < antes[k] - 0.0001);
      diario(`Admin agrega "Nicho de regadera a medida" al catálogo de baño → avance de ${bajaron.join(', ') || 'ninguna'} baja solo por eso`);
      METRICAS.catalogoMovio = bajaron.length;
      if (bajaron.length) hallazgo('ALTA', 'Editar el catálogo cambia el avance y la secuencia de obras ya en curso',
        'Al agregar una partida al tipo Baño, ' + bajaron.map(k => k + ' bajó de ' + (antes[k] * 100).toFixed(0) + '% a ' + (despues[k] * 100).toFixed(0) + '%').join('; ') +
        '. Las obras activas heredan una partida que nadie contrató, y no se puede cerrar la obra sin terminarla.');
      NICHO_AGREGADO = true;
  } },
  // la clienta de B pide marmol: OC que se queda en propuesta y al final se rechaza
  { dia: 10, hacer(i) {
      const o = OBRAS.find(x => x.k === 'B');
      const r = haz('admin', ADMIN, 'duCrearOC', [TA, { obra: o.id, motivo: 'Cambio de selección', hallazgo: dx(i - 1),
        descripcion: 'Cambio de backsplash cerámico por mármol Carrara 3x6', costo: 610, precio: 980, dias: 1, condicion: 'Al autorizar' }]);
      if (r && r.id) { CAMBIO_MARMOL.oc = r.id; diario(`Admin emite ${r.id} por el mármol: $980 (margen ${(r.margen * 100).toFixed(0)}%)`); }
      else if (r && r.confirmar) diario('El sistema frena la OC por margen bajo');
  } },
  { dia: 14, hacer(i) {
      if (!CAMBIO_MARMOL.oc) return;
      haz('admin', ADMIN, 'duEstadoOC', [TA, CAMBIO_MARMOL.oc, 'Rechazada']);
      diario(`La clienta rechaza ${CAMBIO_MARMOL.oc} tras 4 días hábiles pensándolo`);
  } },
  // correccion que el PM ya no puede hacer (mas de 48 h): la hace el admin
  { dia: 12, hacer(i) {
      const g = S['Gastos'].slice(1).find(r => r[2] === OBRAS.find(x => x.k === 'D').id && Number(r[6]) === 85);
      if (!g) return;
      reloj.fija(dx(i), '08:20');
      TP.luis = llama(PMSRV, 'pmLogin', 'luis', PIN.luis).token; ENTRO.luis = reloj.ahora().getTime();
      const p = haz('luis', PMSRV, 'pmCorregir', [TP.luis, 'Gastos', g[0], { monto: 65 }, 'El recibo decía 65, no 85'], /48 horas/);
      if (p && p.rechazado) {
        const a = haz('admin', ADMIN, 'duCorregir', [TA, 'Gastos', g[0], { monto: 65 }, 'Luis capturó 85; el recibo dice 65']);
        diario(`Luis intenta corregir ${g[0]} (de hace 11 días hábiles) → el sistema lo manda con el admin → admin lo corrige${a ? '' : ' (FALLÓ)'}`);
      }
  } },
];
let NICHO_AGREGADO = false;

function capturarPresupuesto(o) {
  const lineas = o.tareas.map(t => {
    const dia = (TARIFA[o.trab] || 30) * (o.porDia ? 1 : 8);
    const monto = t.ot ? t.ot : (t.q === 'crew' ? t.d * dia : 0) + (t.g ? t.g[0] : 0);
    const esTile = /Tile|Backsplash|Piso/.test(t.p), area = o.areas.find(a => a.nombre === t.areaNombre);
    return { area: t.area, partida: t.p, monto, cantidad: esTile && area ? area.pies2 : 1, unidad: esTile ? 'pie2' : 'lote' };
  }).filter(l => l.monto > 0);
  const r = haz('admin', ADMIN, 'duGuardarPresupuesto', [TA, o.id, lineas]);
  if (r) { o.presupuesto = lineas.reduce((a, l) => a + l.monto, 0); diario(`Admin captura el presupuesto de ${o.id}: ${lineas.length} partidas, $${o.presupuesto.toLocaleString()}`); }
}
function avancesAhora() {
  const d = llama(ADMIN, 'duDatos', TA), m = {};
  d.tablero.forEach(t => { m[t.id] = t.avance.pct; });
  return m;
}

// ================================================================= el plomero de C no llega
function programarNoShow() {
  const o = OBRAS.find(x => x.k === 'C'), t = o.tareas.find(x => x.p === 'Rough de plomería');
  t.noShowPendiente = true;
}
function revisarNoShow(i) {
  const o = OBRAS.find(x => x.k === 'C'), t = o.tareas.find(x => x.p === 'Rough de plomería');
  if (t.noShowPendiente && t.otId && t.otInicio === i && t.noShow === undefined) { t.noShow = i; t.noShowPendiente = false; }
}
function reprogramarNoShow(i) {
  const o = OBRAS.find(x => x.k === 'C'), t = o.tareas.find(x => x.p === 'Rough de plomería');
  if (t.noShow !== i - 1 || t.reprogramada) return;
  reloj.fija(dx(i), '08:30');
  const d = llama(ADMIN, 'duDatos', TA);
  const aviso = (d.subsNoLlegaron || []).find(x => x.ot === t.otId);
  if (!aviso) { hallazgo('ALTA', 'La falta del sub no le llegó al administrador', t.otId); return; }
  const r = haz('admin', ADMIN, 'duReprogramarOT', [TA, t.otId, { inicio: dx(i + 1), fin: dx(i + 2), motivo: 'No llegó; confirmó para mañana' }]);
  if (r && r.ok) { t.otInicio = i + 1; t.reprogramada = true; t.noShow = -1; t.inicio = null; t.hechos = 0; t.confirmada = false;
    METRICAS.reprogramada = r.faltas;
    diario(`Admin ve en su inicio que el plomero de ${o.id} no llegó → reprograma ${t.otId} para mañana (${r.faltas} falta registrada)`); }
}

// ================================================================= entrega, punch list y cierre
function entregaYCierre(i) {
  reloj.fija(dx(i), '10:00'); entraAdmin();
  OBRAS.forEach(o => {
    const fin = o.tareas.find(t => t.final);
    if (o.estado === 'obra' && fin.fin !== null && fin.fin < i) {
      // recorrido con el cliente
      reloj.fija(dx(i), '10:00');
      const pm = o.pm;
      const items = [['Silicón disparejo en la unión del vanity con el muro', 'Defecto', 'Cuadrilla'],
                     ['El cliente quiere un gancho extra para toallas', 'Cambio de alcance', ''],
                     ['La lechada se ve más oscura que la muestra', 'Expectativa', '']];
      o.punch = items.map(([item, origen, resp]) => {
        const r = hazPM(pm, 'pmPunch', [{ obra: o.id, item, origen, responsable: resp, foto: null }]);
        return r && r.id ? { id: r.id, origen, item } : null;
      }).filter(Boolean);
      const e = haz('admin', ADMIN, 'duEntrega', [TA, { obra: o.id, fecha: dx(i), meses: 12, fotos: 'SI', notas: 'Recorrido con el cliente; 3 detalles anotados' }]);
      diario(`Recorrido de entrega de ${o.id}: 3 detalles (defecto, cambio de alcance, expectativa) · acta ${e ? 'registrada, garantía vence ' + e.vence : 'NO registrada'}`);
      // el cambio de alcance se cobra con una OC
      const cam = o.punch.find(x => x.origen === 'Cambio de alcance');
      if (cam) {
        const r = haz('admin', ADMIN, 'duCrearOC', [TA, { obra: o.id, motivo: 'Solicitud del cliente', hallazgo: dx(i), descripcion: cam.item, costo: 25, precio: 85, dias: 0, condicion: 'Al autorizar' }]);
        if (r && r.id) { haz('admin', ADMIN, 'duEstadoOC', [TA, r.id, 'Autorizada']); o.ocPunch = r.id; o.ocPunchMonto = 85; }
      }
      o.estado = 'entregada'; o.entrega = i;
    }
    // el PM cierra el defecto dos dias despues
    if (o.estado === 'entregada' && i === o.entrega + 2) {
      reloj.fija(dx(i), '11:00');
      (o.punch || []).filter(x => x.origen !== 'Expectativa').forEach(x => {
        const r = hazPM(o.pm, 'pmCerrarPunch', [x.id, foto(1)[0]]);
        if (r) diario(`${o.pm} cierra el detalle ${x.id} (${x.origen}) en ${o.id}`);
      });
      (o.punch || []).filter(x => x.origen === 'Expectativa').forEach(x => hazPM(o.pm, 'pmCerrarPunch', [x.id, foto(1)[0]]));
    }
    if (o.estado !== 'obra' && o.entrega !== undefined && i === o.entrega + 3) {
      haz('admin', ADMIN, 'duCosecha', [TA, o.id, 'resenaPedida', true]);
      diario(`Admin pide la reseña a ${o.cliente} (día 3 después de entregar)`);
    }
    if (o.k === 'A' && o.entrega !== undefined && i === o.entrega + 5 && !o.garantia) {
      const r = haz('admin', ADMIN, 'duGarantia', [TA, { obra: o.id, causa: 'Error de instalacion', sub: 'SUB-03', costo: 120,
        descripcion: 'La clienta reporta una grieta fina en la lechada junto al desagüe' }]);
      o.garantia = r && r.id; diario(`Reclamo de garantía en ${o.id}: grieta en la lechada${r ? ' (' + r.id + ')' : ' — FALLÓ'}`);
    }
    // cierre financiero: cobra el resto, factura, y cierra
    if (o.estado === 'entregada' && i === o.entrega + 3) {
      reloj.fija(dx(i), '14:00');
      if (!o.presupuesto) {
        const pc = haz('admin', ADMIN, 'duPreCierre', [TA, o.id]);
        diario(`Admin intenta cerrar ${o.id}: el pre-cierre avisa → ${(pc && pc.avisos || []).map(a => a.t || a).join(' | ').slice(0, 140)}`);
        capturarPresupuesto(o);
      }
      const dd = llama(ADMIN, 'duDatos', TA).tablero.find(t => t.id === o.id);
      if (dd && dd.porCobrar > 0) {
        haz('admin', ADMIN, 'duCobro', [TA, { obra: o.id, monto: dd.porCobrar, concepto: 'Liquidacion', metodo: 'Cheque', referencia: 'FIN-' + o.id }]);
        diario(`Admin cobra la liquidación de ${o.id}: $${dd.porCobrar.toLocaleString()}`);
      }
      if (o.ocPunch) haz('admin', ADMIN, 'duEstadoOC', [TA, o.ocPunch, 'Facturada']);
      let pc = haz('admin', ADMIN, 'duPreCierre', [TA, o.id]);
      (pc && pc.sinTerminar || []).forEach(x => {
        const t = o.tareas.find(y => y.area === x.area && y.p === x.partida);
        if (t && t.fin !== null) {
          const r = hazPM(o.pm, 'pmCerrarDia', [{ obra: o.id, capturado: reloj.ahora().toISOString(), partidas: [x.area + '|' + x.partida],
            terminadas: [x.area + '|' + x.partida], cuadrilla: [], subs: [], incidencia: 'Se había quedado sin marcar', fotos: foto(1) }]);
          diario(`El pre-cierre de ${o.id} marca "${x.partida}" sin terminar → ${o.pm} la marca terminada${r ? '' : ' — FALLÓ'}`);
        } else {
          const r = haz('admin', ADMIN, 'duQuitarPartidaObra', [TA, o.id, x.area, x.partida, 'No se contrató en esta obra']);
          diario(`El pre-cierre de ${o.id} marca "${x.partida}" sin terminar → no se contrató: admin la quita de esta obra${r ? '' : ' — FALLÓ'}`);
        }
      });
      S['Ordenes_Trabajo'].slice(1).filter(r => r[1] === o.id && r[8] !== 'Cancelada' && r[8] !== 'Pagada').forEach(ot => {
        const pagadoOT = S['Pagos_Sub'].slice(1).filter(p => p[2] === ot[0] && String(p[11]) !== 'Anulado').reduce((a, p) => a + (Number(p[6]) || 0), 0);
        const saldo = (Number(ot[5]) || 0) - pagadoOT;
        if (saldo <= 0) return;
        let conf = [], r = null;
        for (let k = 0; k < 4; k++) {
          r = haz('admin', ADMIN, 'duPagoSub', [TA, { otId: ot[0], monto: saldo, concepto: 'Liquidacion', metodo: 'Cheque', referencia: 'CK-FIN', confirmado: conf }]);
          if (!r || !r.confirmar) break;
          conf = conf.concat([r.codigo]);
        }
        diario(`Admin liquida ${ot[0]} antes de cerrar ($${saldo})${conf.length ? ' confirmando: ' + conf.join(', ') : ''} → ${r && r.ok ? 'pagado' : 'NO se pudo pagar'}`);
        if (!(r && r.ok)) hallazgo('ALTA', 'No se pudo pagar a un sub con confirmación', ot[0]);
      });
      pc = haz('admin', ADMIN, 'duPreCierre', [TA, o.id]);
      const pend = (pc && pc.avisos) || [];
      if (pend.length) diario(`Pre-cierre de ${o.id} todavía avisa: ${pend.map(a => a.t || a).join(' | ').slice(0, 160)}`);
      const r = haz('admin', ADMIN, 'duCerrarObra', [TA, o.id, dx(i)]);
      if (r && r.ok) { o.estado = 'cerrada'; o.cierre = r; diario(`Admin cierra ${o.id}: margen ${(r.margen * 100).toFixed(1)}% · desvío ${r.desviacion === null || r.desviacion === undefined ? '—' : (r.desviacion * 100).toFixed(1) + '%'} · ${r.dias} días`); }
      else diario(`Admin NO pudo cerrar ${o.id}: ${r && (r.msg || JSON.stringify(r)).slice(0, 160)}`);
    }
  });
}

// ================================================================= revision de cada noche
function revisionNocturna(i) {
  reloj.fija(dx(i), '21:00');
  entraAdmin();
  const d = llama(ADMIN, 'duDatos', TA);
  const g = S['Gastos'].slice(1), mo = S['Mano_Obra'].slice(1), ot = S['Ordenes_Trabajo'].slice(1);
  const vig = r => String(r[r.length - 2]) !== 'Anulado' && String(r[r.length - 1]) !== 'Anulado';
  OBRAS.filter(o => o.estado !== 'cerrada').forEach(o => {
    const t = d.tablero.find(x => x.id === o.id);
    if (!t) return;
    const mat = g.filter(r => r[2] === o.id && String(r[13]) !== 'Anulado').reduce((a, r) => a + (Number(r[6]) || 0), 0);
    const cua = mo.filter(r => r[2] === o.id && String(r[8]) !== 'Anulado').reduce((a, r) => a + (Number(r[5]) || 0) * (TARIFA[r[3]] || 0), 0);
    const sub = ot.filter(r => r[1] === o.id && r[8] !== 'Cancelada').reduce((a, r) => a + (Number(r[5]) || 0), 0);
    const mio = mat + cua + sub;
    if (Math.abs(mio - t.gastado) > 1) hallazgo('ALTA', 'El costo del tablero no cuadra con los registros',
      `${o.id} el ${dx(i)}: tablero $${t.gastado} vs recalculado $${mio} (materiales ${mat}, cuadrilla ${cua}, subs ${sub})`);
    const av = t.avance.pct;
    if (avanceAyer[o.id] !== undefined && av < avanceAyer[o.id] - 0.0001 && !(NICHO_AGREGADO && i === 10))
      hallazgo('MEDIA', 'El avance de una obra retrocedió', `${o.id}: ${(avanceAyer[o.id] * 100).toFixed(1)}% → ${(av * 100).toFixed(1)}% el ${dx(i)}`);
    avanceAyer[o.id] = av;
    METRICAS.dias[dx(i)] = METRICAS.dias[dx(i)] || {};
    METRICAS.dias[dx(i)][o.id] = { av, costo: t.gastado };
  });
  // ningun ID repetido
  ['Gastos', 'Mano_Obra', 'Bitacora', 'Avance', 'Ordenes_Trabajo', 'Pagos_Sub', 'Cobros', 'Calidad', 'Bloqueos', 'Ordenes_Cambio'].forEach(h => {
    const ids = S[h].slice(1).map(r => r[0]).filter(Boolean);
    if (new Set(ids).size !== ids.length) hallazgo('ALTA', 'IDs repetidos', h);
  });
}

// ================================================================= la simulacion
altaObras();
armarPlanes();
programarNoShow();
for (let i = 0; i < DIAS.length; i++) {
  const f = new B.RealDate(DIAS[i] + 'T12:00:00');
  B.setDia(DOW[f.getDay()] + ' ' + DIAS[i].slice(8) + '-' + ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][f.getMonth() + 1]);
  DIA_I = i;
  revisarNoShow(i);
  adminManana(i);
  reprogramarNoShow(i);
  ['carlos', 'luis'].forEach(pm => jornadaPM(i, pm));
  entregaYCierre(i);
  revisionNocturna(i);
}
module.exports = { OBRAS, METRICAS, DIAS, CORREOS, SESION_VENCIDA };
require('./reporte.js');
