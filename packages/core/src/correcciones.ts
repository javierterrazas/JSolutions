// Correcciones y anulaciones (legacy: comun/utilidades.js aplicarCorreccion_, aplicarAnulacion_; pm/servidor.js
// pmCorregir, pmAnular). Nada se borra: un registro equivocado se ANULA (queda, pero sale de todos los cálculos)
// o se EDITA campo por campo. Las dos cosas dejan rastro en correcciones, con motivo.
import { ErrorDeNegocio } from './errores';

export type TablaCorregible = 'gastos' | 'mano_obra' | 'bitacora' | 'avance' | 'cobros' | 'pagos_sub';

/** Los campos que se pueden editar en cada tabla. El resto, si está mal, se anula y se vuelve a registrar. */
export const CAMPOS_EDITABLES: Readonly<Record<TablaCorregible, readonly string[]>> = {
  gastos: ['monto', 'partida_obra_id', 'categoria', 'proveedor', 'descripcion'],
  mano_obra: ['cantidad', 'partida_obra_id'],
  bitacora: ['incidencia'],
  avance: [],
  cobros: ['monto', 'concepto', 'referencia'],
  pagos_sub: ['monto', 'concepto', 'referencia'],
};

/** Lo que el PM puede corregir: lo que él captura en obra. Cobros y pagos son del dueño. */
export const TABLAS_DEL_PM: readonly TablaCorregible[] = ['gastos', 'mano_obra', 'bitacora', 'avance'];

/** El PM corrige lo suyo dentro de 48 horas; después, se lo pide al dueño. */
export const HORAS_PARA_CORREGIR_PM = 48;

export const esTablaCorregible = (t: string): t is TablaCorregible => t in CAMPOS_EDITABLES;

/**
 * Si una corrección o anulación procede. Errores, en el orden del legacy: `falta_motivo` (menos de 5 letras),
 * `tabla_no_corregible`, `registro_de_otro` (el PM solo lo suyo), `fuera_de_48_horas`, `obra_cerrada`,
 * `ya_anulado` (solo al editar: anular algo ya anulado no hace nada).
 */
export function validarCorreccion(c: {
  readonly tabla: string;
  readonly esPM: boolean;
  readonly esPropio: boolean;
  readonly creadoEn: Date;
  readonly ahora: Date;
  readonly obraCerrada: boolean;
  readonly anulado: boolean;
  readonly motivo: string | null | undefined;
  readonly accion: 'editar' | 'anular';
}): void {
  if (String(c.motivo ?? '').trim().length < 5) throw new ErrorDeNegocio('falta_motivo');
  if (!esTablaCorregible(c.tabla) || (c.esPM && !TABLAS_DEL_PM.includes(c.tabla))) {
    throw new ErrorDeNegocio('tabla_no_corregible', { tabla: c.tabla });
  }
  if (c.esPM && !c.esPropio) throw new ErrorDeNegocio('registro_de_otro');
  if (c.esPM && (c.ahora.getTime() - c.creadoEn.getTime()) / 3_600_000 > HORAS_PARA_CORREGIR_PM) {
    throw new ErrorDeNegocio('fuera_de_48_horas', { horas: HORAS_PARA_CORREGIR_PM });
  }
  if (c.obraCerrada) throw new ErrorDeNegocio('obra_cerrada');
  if (c.anulado && c.accion === 'editar') throw new ErrorDeNegocio('ya_anulado');
}

export interface Cambio {
  readonly campo: string;
  readonly antes: unknown;
  readonly despues: unknown;
}

/**
 * Los cambios que de verdad se aplican: solo campos editables y que cambian. Sin ninguno, `sin_cambios`.
 * Los montos y cantidades se comparan como números.
 */
export function cambiosAplicables(
  tabla: TablaCorregible,
  actual: Readonly<Record<string, unknown>>,
  cambios: Readonly<Record<string, unknown>>,
): Cambio[] {
  const numerico = new Set(['monto', 'cantidad']);
  const out: Cambio[] = [];
  for (const campo of CAMPOS_EDITABLES[tabla]) {
    if (!(campo in cambios)) continue;
    const despues = numerico.has(campo) ? Number(cambios[campo]) || 0 : (cambios[campo] ?? null);
    const antes = actual[campo] ?? null;
    if (numerico.has(campo) ? Number(antes) === despues : String(antes ?? '') === String(despues ?? ''))
      continue;
    out.push({ campo, antes, despues });
  }
  if (!out.length) throw new ErrorDeNegocio('sin_cambios');
  return out;
}
