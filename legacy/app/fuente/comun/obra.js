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
