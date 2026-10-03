// Convierte las hojas del legacy a las entradas de packages/core, para darle a las dos versiones los mismos
// datos. Sigue las reglas de lectura del legacy (comun/obra.js, comun/datos.js): renglones anulados fuera,
// partidas propias del espacio o, si no tiene copia, las del catálogo, y el espacio deducido cuando un registro
// es anterior a las áreas. Es, en pequeño, lo que hará el importador de la fase 3.
import {
  type AvanceDia,
  type Cargo,
  type CierreDia,
  claveEtapa,
  type Dia,
  type EspacioAvance,
  type EspacioCrono,
  type EspacioEtapas,
  type EstadoOrden,
  type LineaPresupuesto,
  type ObraParaHistorico,
  type OrdenSemana,
  type PartidaCrono,
  presupuestoDesdePartidas,
  type SubSemana,
  type Tarifa,
  tarifaDelDia,
} from '../../src/index';
import { diaLocal, type Libro } from './legacy';

type Fila = unknown[];

const texto = (v: unknown) => String(v ?? '').trim();
const sinAcentos = (s: unknown) => texto(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const dia = (v: unknown): Dia | null => (v instanceof Date ? diaLocal(v) : null);

/** Los renglones con datos de una hoja (sin encabezado), quitando los anulados como datos_() del legacy. */
const COLUMNA_ESTADO: Record<string, number> = {
  Gastos: 13,
  Avance: 7,
  Bitacora: 9,
  Mano_Obra: 8,
  Cobros: 9,
  Pagos_Sub: 11,
};
export function filas(libro: Libro, hoja: string): Fila[] {
  const col = COLUMNA_ESTADO[hoja];
  return (libro[hoja] ?? [])
    .slice(1)
    .filter((r) => texto(r[0]) !== '')
    .filter((r) => col === undefined || texto(r[col]) !== 'Anulado');
}

interface Area {
  id: string;
  tipo: string;
  generales: boolean;
}

export function areasDe(libro: Libro, obraId: string): Area[] {
  return filas(libro, 'Areas')
    .filter((a) => a[1] === obraId)
    .sort((a, b) => (Number(a[6]) || 0) - (Number(b[6]) || 0))
    .map((a) => ({ id: texto(a[0]), tipo: texto(a[2]), generales: a[2] === 'Generales' }));
}

/** Las partidas del área en el formato del catálogo: [tipo, orden, partida, hito, peso, dias, quien, paralelo, espera, etapa]. */
function partidasDeArea(libro: Libro, area: Area): Fila[] {
  const propias = filas(libro, 'Partidas_Obra').filter((r) => r[0] === area.id);
  if (propias.length) {
    return propias
      .filter((r) => texto(r[6]) !== 'Quitada')
      .map((r) => [
        area.tipo,
        Number(r[2]) || 0,
        r[3],
        r[4] || '',
        Number(r[5]) || 1,
        r[7],
        r[8],
        r[9],
        r[10],
        r[11],
      ])
      .sort((a, b) => (a[1] as number) - (b[1] as number));
  }
  return filas(libro, 'Partidas_Catalogo')
    .filter((c) => c[0] === area.tipo)
    .sort((a, b) => (Number(a[1]) || 0) - (Number(b[1]) || 0));
}

/** El área deducida para un registro sin área (areaPorPartida_). */
function areaPorPartida(libro: Libro, obraId: string, partida: unknown): string {
  const areas = areasDe(libro, obraId);
  if (!areas.length) return '';
  const cat = filas(libro, 'Partidas_Catalogo');
  const gen = areas.find((a) => a.generales);
  if (gen && cat.some((c) => c[0] === 'Generales' && c[2] === partida)) return gen.id;
  const esp = areas.find((a) => !a.generales && cat.some((c) => c[0] === a.tipo && c[2] === partida));
  if (esp) return esp.id;
  return (areas.find((a) => !a.generales) ?? gen)!.id;
}

export const clavePartida = (areaId: string, partida: unknown) => `${areaId}|${texto(partida)}`;

/**
 * El oficio de una partida o de un sub. En el modelo nuevo es una tabla (D-021) y la partida apunta a él por su
 * id; aquí, el texto sin acentos. Para que una partida y un sub compartan oficio como en el legacy, que los
 * empataba por texto contenido en el otro ("Plomería" ↔ "Plomería y gas"), cada `quien` se liga al primer oficio
 * de sub que empata así, igual que lo haría el importador.
 */
function oficioDe(libro: Libro, quien: unknown): string {
  const q = sinAcentos(quien);
  const oficios = filas(libro, 'Subcontratistas').map((s) => sinAcentos(s[2]));
  return oficios.find((o) => o.includes(q) || q.includes(o)) ?? q;
}

function partidaCrono(libro: Libro, area: Area, c: Fila): PartidaCrono {
  const quien = texto(c[6]) || 'Cuadrilla';
  const esSub = !['cuadrilla', 'pm', ''].includes(quien.toLowerCase());
  return {
    id: clavePartida(area.id, c[2]),
    dias: Math.max(1, Number(c[5]) || 1),
    paralelo: texto(c[7]).toUpperCase() === 'SI',
    espera: Math.max(0, Number(c[8]) || 0),
    responsable: esSub ? 'subcontratista' : quien.toLowerCase() === 'pm' ? 'pm' : 'cuadrilla',
    oficioId: esSub ? oficioDe(libro, quien) : null,
  };
}

export function espaciosCrono(libro: Libro, obraId: string): EspacioCrono[] {
  return areasDe(libro, obraId).map((a) => ({
    id: a.id,
    generales: a.generales,
    partidas: partidasDeArea(libro, a).map((c) => partidaCrono(libro, a, c)),
  }));
}

/** Las partidas de una plantilla del catálogo (para proponer la entrega al dar de alta). */
export function plantilla(libro: Libro, tipo: string): PartidaCrono[] {
  const area: Area = { id: tipo, tipo, generales: tipo === 'Generales' };
  return filas(libro, 'Partidas_Catalogo')
    .filter((c) => c[0] === tipo)
    .sort((a, b) => (Number(a[1]) || 0) - (Number(b[1]) || 0))
    .map((c) => partidaCrono(libro, area, c));
}

export function avanceDe(libro: Libro, obraId: string): AvanceDia[] {
  return filas(libro, 'Avance')
    .filter((r) => r[2] === obraId && dia(r[1]))
    .map((r) => ({
      partidaId: clavePartida(texto(r[8]) || areaPorPartida(libro, obraId, r[3]), r[3]),
      estado: r[4] === 'Terminada' ? ('terminada' as const) : ('en_progreso' as const),
      dia: dia(r[1])!,
    }));
}

const ESTADOS_ORDEN: Record<string, EstadoOrden> = {
  Emitida: 'emitida',
  Confirmada: 'confirmada',
  Aprobada: 'aprobada',
  Pagada: 'pagada',
  Cancelada: 'cancelada',
};

export function ordenesDe(libro: Libro): OrdenSemana[] {
  return filas(libro, 'Ordenes_Trabajo').map((o) => ({
    id: texto(o[0]),
    obraId: texto(o[1]),
    subId: texto(o[2]),
    partidaId: clavePartida(texto(o[14]) || areaPorPartida(libro, texto(o[1]), o[13]), o[13]),
    estado: ESTADOS_ORDEN[texto(o[8])] ?? 'emitida',
    inicio: dia(o[6]),
    fin: dia(o[7]),
  }));
}

export function subsDe(libro: Libro): SubSemana[] {
  return filas(libro, 'Subcontratistas').map((s) => ({
    id: texto(s[0]),
    oficioId: sinAcentos(s[2]),
    activo: texto(s[5]).toUpperCase() === 'SI',
  }));
}

export function cierresDe(libro: Libro, obraId: string): CierreDia[] {
  return filas(libro, 'Bitacora')
    .filter((b) => b[2] === obraId && dia(b[1]))
    .map((b) => ({ dia: dia(b[1])!, conTrabajo: texto(b[4]) !== '' }));
}

export const obrasDe = (libro: Libro) =>
  filas(libro, 'Proyectos').map((p) => ({
    id: texto(p[0]),
    inicio: dia(p[6]),
    finEstimada: dia(p[7]),
    estado: texto(p[9]),
    fila: p,
  }));

// ------------------------------------------------------------------ 5b: avance, etapas y costos
const SIN_ETAPA = 'Otras partidas';
/** La etapa de una partida del legacy: su texto, o nula ("Otras partidas"). */
const etapaDe = (v: unknown): string | null => {
  const e = texto(v);
  return e && e !== SIN_ETAPA ? e : null;
};

/** Los espacios con sus partidas y sus pesos, para el avance ponderado. */
export function espaciosAvance(libro: Libro, obraId: string): EspacioAvance[] {
  return areasDe(libro, obraId).map((a) => ({
    id: a.id,
    generales: a.generales,
    partidas: partidasDeArea(libro, a).map((c) => ({ id: clavePartida(a.id, c[2]), peso: Number(c[4]) })),
  }));
}

/** Los espacios con sus etapas, sus pies² y su tipo (el tipo del legacy es texto: aquí hace de id). */
export function espaciosEtapas(libro: Libro, obraId: string): EspacioEtapas[] {
  const pies = new Map(filas(libro, 'Areas').map((a) => [texto(a[0]), Number(a[4]) || 0]));
  return areasDe(libro, obraId).map((a) => ({
    id: a.id,
    generales: a.generales,
    tipoEspacioId: a.tipo,
    pies2: pies.get(a.id) ?? 0,
    partidas: partidasDeArea(libro, a).map((c) => ({ id: clavePartida(a.id, c[2]), etapaId: etapaDe(c[9]) })),
  }));
}

/**
 * El presupuesto de una obra en el modelo nuevo: los renglones por etapa tal cual, y los antiguos (por partida)
 * convertidos a su etapa con presupuestoDesdePartidas, como lo hará el importador.
 */
export function presupuestoDe(libro: Libro, obraId: string): LineaPresupuesto[] {
  const renglones = filas(libro, 'Presupuesto').filter((x) => x[1] === obraId);
  const area = (x: Fila) => texto(x[7]) || areaPorPartida(libro, obraId, x[2]);
  const porEtapa = renglones
    .filter((x) => texto(x[8]) === 'Etapa')
    .map((x) => ({ espacioId: area(x), etapaId: etapaDe(x[2]), monto: Number(x[3]) || 0 }));
  const antiguos = presupuestoDesdePartidas(
    espaciosEtapas(libro, obraId),
    renglones
      .filter((x) => texto(x[8]) !== 'Etapa')
      .map((x) => ({ espacioId: area(x), partidaId: clavePartida(area(x), x[2]), monto: Number(x[3]) || 0 })),
  );
  const suma = new Map<string, LineaPresupuesto>();
  for (const l of [...porEtapa, ...antiguos]) {
    const k = claveEtapa(l.espacioId, l.etapaId);
    suma.set(k, { ...l, monto: (suma.get(k)?.monto ?? 0) + l.monto });
  }
  return [...suma.values()];
}

/** Una tarifa por trabajador, vigente desde siempre: la del legacy, que no guardaba historia. */
export const tarifasDe = (libro: Libro): Tarifa[] =>
  filas(libro, 'Trabajadores').map((t) => ({
    trabajadorId: texto(t[0]),
    tarifa: Number(t[4]) || 0,
    vigenteDesde: '1900-01-01',
  }));

/** Los costos de una obra: gastos, horas de cuadrilla valuadas con su tarifa, y órdenes de trabajo vigentes. */
export function cargosDe(libro: Libro, obraId: string): Cargo[] {
  const tarifas = tarifasDe(libro);
  const cargo = (area: string, partida: unknown, cubo: Cargo['cubo'], monto: number): Cargo => ({
    espacioId: area,
    partidaId: texto(partida) ? clavePartida(area, partida) : null,
    cubo,
    monto,
  });
  return [
    ...filas(libro, 'Gastos')
      .filter((g) => g[2] === obraId)
      .map((g) =>
        cargo(texto(g[14]) || areaPorPartida(libro, obraId, g[12]), g[12], 'material', Number(g[6]) || 0),
      ),
    ...filas(libro, 'Mano_Obra')
      .filter((m) => m[2] === obraId)
      .map((m) =>
        cargo(
          texto(m[9]) || areaPorPartida(libro, obraId, m[4]),
          m[4],
          'cuadrilla',
          (Number(m[5]) || 0) * tarifaDelDia(tarifas, texto(m[3]), dia(m[1]) ?? '2100-01-01'),
        ),
      ),
    ...filas(libro, 'Ordenes_Trabajo')
      .filter((o) => o[1] === obraId && o[8] !== 'Cancelada')
      .map((o) =>
        cargo(texto(o[14]) || areaPorPartida(libro, obraId, o[13]), o[13], 'sub', Number(o[5]) || 0),
      ),
  ];
}

/** Lo que necesita el histórico de costos unitarios, de todas las obras con presupuesto. */
export function obrasParaHistorico(libro: Libro): ObraParaHistorico[] {
  const cerradas = new Set(filas(libro, 'Obras_Cerradas').map((c) => texto(c[1])));
  const terminadas = new Set(
    filas(libro, 'Avance')
      .filter((a) => a[4] === 'Terminada')
      .map((a) => clavePartida(texto(a[8]) || areaPorPartida(libro, texto(a[2]), a[3]), a[3])),
  );
  const conPresupuesto = [...new Set(filas(libro, 'Presupuesto').map((x) => texto(x[1])))];
  return conPresupuesto.map((id) => ({
    id,
    cerrada: cerradas.has(id),
    espacios: espaciosEtapas(libro, id),
    presupuesto: presupuestoDe(libro, id),
    cargos: cargosDe(libro, id),
    terminadas,
  }));
}
