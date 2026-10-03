// Convierte las hojas del legacy a las entradas de packages/core, para darle a las dos versiones los mismos
// datos. Sigue las reglas de lectura del legacy (comun/obra.js, comun/datos.js): renglones anulados fuera,
// partidas propias del espacio o, si no tiene copia, las del catálogo, y el espacio deducido cuando un registro
// es anterior a las áreas. Es, en pequeño, lo que hará el importador de la fase 3.
import type {
  AvanceDia,
  CierreDia,
  Dia,
  EspacioCrono,
  EstadoOrden,
  OrdenSemana,
  PartidaCrono,
  SubSemana,
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
