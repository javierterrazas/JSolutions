// El margen del presupuesto (D-084): sobre el precio, como en las órdenes de cambio (validarOrdenCambio). Con un costo
// de $10,000 y 35% de margen, el precio es $15,385: de cada dólar que se cobra, 35 centavos quedan.
import { ErrorDeNegocio } from './errores';

const centavos = (n: number) => Math.round(n * 100) / 100;

/** El precio que deja `margen` (de 0 a menos de 1) sobre un costo, redondeado a centavos. */
export function precioConMargen(costo: number, margen: number): number {
  if (!(margen >= 0 && margen < 1)) throw new ErrorDeNegocio('margen_invalido');
  return centavos(costo / (1 - margen));
}

/** El margen de un precio sobre su costo; null sin precio. Negativo si se cobra menos de lo que cuesta. */
export const margenDe = (costo: number, precio: number): number | null =>
  precio > 0 ? 1 - costo / precio : null;

/**
 * El margen que quedaría al terminar la obra si lo que falta se gasta como se presupuestó: lo de cada etapa es lo
 * gastado o su costo, lo que sea mayor. Null sin contrato.
 */
export function margenProyectado(
  etapas: readonly { readonly costo: number; readonly gastado: number }[],
  contrato: number,
): number | null {
  if (!(contrato > 0)) return null;
  return 1 - etapas.reduce((a, e) => a + Math.max(e.costo, e.gastado), 0) / contrato;
}
