// Validación de la forma de lo que llega del teléfono o del navegador (Zod). Las REGLAS del negocio las decide
// @ijm/core; esto solo asegura que los datos tengan la forma esperada. Un dato mal formado es
// { codigo: 'datos_invalidos', datos: { problemas: [{ campo, problema }] } }.
import { ErrorDeNegocio } from '@ijm/core';
import { z } from 'zod';

export const uuid = z.string().uuid();
export const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dia_invalido');
/** Un texto corto, como un nombre o un proveedor; y uno largo, como una descripción o unas notas. */
export const textoCorto = z.string().max(200);
export const textoLargo = z.string().max(2000);
export const motivo = textoLargo;
/** La hora en que el teléfono capturó algo (ISO). */
export const instante = z.string().max(40);

/** Valida `datos` contra `esquema`, o lanza datos_invalidos con cada problema. */
export function validarEntrada<T>(esquema: z.ZodType<T>, datos: unknown): T {
  const r = esquema.safeParse(datos);
  if (r.success) return r.data;
  throw new ErrorDeNegocio('datos_invalidos', {
    problemas: r.error.issues.map((i) => ({ campo: i.path.join('.'), problema: i.code })),
  });
}
