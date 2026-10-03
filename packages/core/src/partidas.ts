// Partidas de cada espacio (legacy: admin/servidor.js copiarPartidasAArea_, duAgregarPartidaObra,
// duQuitarPartidaObra). Al crearse, el espacio copia las partidas de su plantilla: editar la plantilla solo afecta
// obras nuevas, y a una obra se le puede quitar o agregar una partida (un baño sin puerta de vidrio).
import type { Responsable } from './cronograma';
import { ErrorDeNegocio } from './errores';
import { pesoValido } from './avance';

/** Una partida de plantilla, o una que se agrega solo a esta obra. */
export interface DatosPartida {
  readonly nombre: string;
  readonly hitoId?: string | null;
  readonly peso?: number | null;
  readonly dias?: number | null;
  readonly responsable?: Responsable | null;
  readonly oficioId?: string | null;
  readonly paralelo?: boolean | null;
  readonly espera?: number | null;
  readonly etapaId?: string | null;
}

export interface PartidaNueva {
  readonly orden: number;
  readonly nombre: string;
  readonly hitoId: string | null;
  readonly peso: number;
  readonly dias: number;
  readonly responsable: Responsable;
  readonly oficioId: string | null;
  readonly paralelo: boolean;
  readonly espera: number;
  readonly etapaId: string | null;
}

/** Los valores de una partida, con los de omisión del legacy: peso 1, 1 día, la cuadrilla, sin espera. */
function normalizar(p: DatosPartida, orden: number): PartidaNueva {
  return {
    orden,
    nombre: p.nombre.trim(),
    hitoId: p.hitoId ?? null,
    peso: pesoValido(p.peso),
    dias: p.dias && p.dias > 0 ? Math.floor(p.dias) : 1,
    responsable: p.responsable ?? 'cuadrilla',
    oficioId: p.oficioId ?? null,
    paralelo: !!p.paralelo,
    espera: p.espera && p.espera > 0 ? Math.floor(p.espera) : 0,
    etapaId: p.etapaId ?? null,
  };
}

/** Las partidas que un espacio nuevo copia de su plantilla, en su orden. */
export function copiarPlantilla(
  plantilla: readonly (DatosPartida & { readonly orden: number })[],
): PartidaNueva[] {
  return [...plantilla].sort((a, b) => a.orden - b.orden).map((p) => normalizar(p, p.orden));
}

const mismoNombre = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Una obra cerrada ya es histórico: sus partidas, registros y espacios no se cambian. Error: `obra_cerrada`. */
export function exigirObraAbierta(obraCerrada: boolean): void {
  if (obraCerrada) throw new ErrorDeNegocio('obra_cerrada');
}

/**
 * Una partida solo para esta obra (el nicho que pidió este cliente). Va al final del espacio. Errores:
 * `obra_cerrada`, `partida_sin_nombre`, `hito_inexistente`, `partida_repetida`.
 */
export function agregarPartida(
  existentes: readonly { readonly nombre: string; readonly orden: number; readonly activa: boolean }[],
  nueva: DatosPartida,
  hitosValidos: ReadonlySet<string>,
  obraCerrada = false,
): PartidaNueva {
  exigirObraAbierta(obraCerrada);
  if (!nueva.nombre.trim()) throw new ErrorDeNegocio('partida_sin_nombre');
  if (nueva.hitoId && !hitosValidos.has(nueva.hitoId)) {
    throw new ErrorDeNegocio('hito_inexistente', { hito: nueva.hitoId });
  }
  if (existentes.some((p) => p.activa && mismoNombre(p.nombre, nueva.nombre))) {
    throw new ErrorDeNegocio('partida_repetida', { partida: nueva.nombre.trim() });
  }
  const orden = existentes.reduce((m, p) => Math.max(m, p.orden), 0) + 1;
  return normalizar(nueva, orden);
}

/**
 * "No se hizo en esta obra": una partida se puede quitar, con su motivo, mientras no tenga avance, horas ni
 * órdenes de trabajo vigentes. Si ya tiene, se termina en lugar de quitarse. Errores: `obra_cerrada`,
 * `falta_motivo`, `partida_en_uso`.
 */
export function validarQuitarPartida(
  uso: { readonly avance: number; readonly manoDeObra: number; readonly ordenesVigentes: number },
  motivo: string,
  obraCerrada = false,
): void {
  exigirObraAbierta(obraCerrada);
  if (!motivo.trim()) throw new ErrorDeNegocio('falta_motivo');
  if (uso.avance || uso.manoDeObra || uso.ordenesVigentes)
    throw new ErrorDeNegocio('partida_en_uso', { ...uso });
}
