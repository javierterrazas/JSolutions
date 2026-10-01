const B = require('./base.js');
const { OBRAS, METRICAS, DIAS, CORREOS, SESION_VENCIDA } = require('./sim.js');
const S = B.H.SHEETS, fs = require('fs');
fs.writeFileSync('/tmp/sim/diario.txt', B.DIARIO.join('\n'));
B.reloj.fija(DIAS[DIAS.length - 1], '22:00');
const ta = B.llama(B.ADMIN, 'duLogin', 'javier', '482915').token;
const serie = n => METRICAS.kpis.map(k => { const x = k.todos.find(y => y.n.indexOf(n) === 0); return x ? x : null; }).filter(Boolean);
const tasa = serie('Tasa de cierre').filter(x => !/Sin datos/.test(x.revela || '') && x.v > 0);
const cerradas = S['Obras_Cerradas'].slice(1).map(r => Object.fromEntries(S['Obras_Cerradas'][0].map((h, i) => [h, r[i]])));
const r = {
  sesiones: SESION_VENCIDA.length,
  estados: S['Proyectos'].slice(1).map(p => p[0] + ':' + p[9]).join(' '),
  tasa: tasa.map(x => Math.round(x.v * 100)),
  cierresSinTrabajo: METRICAS.cierresSinTrabajo || 0,
  catalogoMovio: METRICAS.catalogoMovio,
  comprasRevisadas: METRICAS.comprasRevisadas || 0,
  atrasos: METRICAS.atrasos || {},
  reprogramada: METRICAS.reprogramada,
  presentacion: serie('Tasa de presentacion').slice(-1)[0],
  recibo: serie('Cargos de tarjeta sin recibo').slice(2, 7).map(x => x.v + (x.s === 'ROJO' ? 'R' : '')),
  cerradas: cerradas.map(c => ({ obra: c.proyecto_id || c[Object.keys(c)[1]], margen: c.margen_real || c.margen, dias: c.dias })),
  avanceFinal: OBRAS.map(o => { const d = B.llama(B.ADMIN, 'duDetalleObra', ta, o.id); return o.id + ' ' + (d.avance.pct * 100).toFixed(0) + '%'; }),
  hallazgos: B.HALLAZGOS,
  idle: METRICAS.idle.map(x => x.por), primerAviso: METRICAS.primerAviso, ppc: serie('Cumplimiento semanal').map(x => x.sinDatos ? null : Math.round(x.v * 100)),
  ots: METRICAS.ots, cierreTardio: METRICAS.cierreTardio || null
};
fs.writeFileSync('/tmp/sim/despues.json', JSON.stringify(r, null, 1));
console.log('listo · diario de', B.DIARIO.length, 'líneas');
