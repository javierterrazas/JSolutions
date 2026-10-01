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
