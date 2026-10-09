'use server';
// Corregir un cierre (D-044): se anula con su motivo y se vuelve a cerrar el mismo día. Necesita señal: a diferencia
// del cierre, no va a la cola, porque el PM tiene que ver en el momento si la corrección se aceptó.
import { corregirCierre, type EntradaCorreccionCierre } from '@ijm/servidor';
import { comoMiembro, estadoDeAcceso } from '@/lib/acceso';
import type { Respuesta } from '@/lib/cola';

export async function corregirElCierre(
  entrada: EntradaCorreccionCierre,
): Promise<Respuesta & { readonly bitacoraId?: string }> {
  const a = await estadoDeAcceso();
  if (a.estado !== 'abierto') return { ok: false, codigo: 'sesion' };
  const r = await comoMiembro((tx) => corregirCierre(tx, entrada), a.acceso);
  return r.ok
    ? { ok: true, bitacoraId: r.datos.bitacoraId }
    : { ok: false, codigo: r.codigo, ...(r.datos ? { datos: r.datos } : {}) };
}
