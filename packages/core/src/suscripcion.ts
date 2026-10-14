// La suscripción de una empresa a la plataforma (D-080). El estado lo calcula la base (estado_suscripcion), que es
// quien lo hace cumplir; aquí, lo que se muestra y se propone.
import { type Dia, sumarDias } from './fechas';

/** Días antes de vencer en que el dueño ve el aviso, y días de gracia después de vencer. */
export const DIAS_AVISO = 7;
export const DIAS_GRACIA = 7;
/** Lo que dura la prueba de una empresa nueva, si no se dice otra cosa. */
export const DIAS_PRUEBA = 14;

export type EstadoSuscripcion = 'prueba' | 'activa' | 'por_vencer' | 'gracia' | 'solo_lectura' | 'suspendida';
export type Ciclo = 'mensual' | 'anual';

/** El último día de gracia: después, la empresa queda en solo lectura. */
export const finDeGracia = (venceEl: Dia): Dia => sumarDias(venceEl, DIAS_GRACIA);

/** El mismo día, `n` meses después; si ese mes no tiene ese día, su último día (31 de enero + 1 = 28 de febrero). */
export function sumarMeses(dia: Dia, n: number): Dia {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  const total = a * 12 + (m - 1) + n;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}` as Dia;
}

/**
 * Hasta cuándo cubre un pago de un ciclo: desde el vencimiento si todavía no pasa (pagar antes no pierde días), o
 * desde hoy si ya venció o no tenía fecha.
 */
export function siguienteVencimiento(venceEl: Dia | null, hoy: Dia, ciclo: Ciclo): Dia {
  const desde = venceEl && venceEl >= hoy ? venceEl : hoy;
  return sumarMeses(desde, ciclo === 'anual' ? 12 : 1);
}
