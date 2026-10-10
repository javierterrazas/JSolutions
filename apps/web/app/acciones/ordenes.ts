'use server';
// Las órdenes de trabajo para el PM (fase 2, paso 6d): confirmar que el sub llega, y aprobar su trabajo. Necesitan
// señal, como en el legacy.
import { aprobarOrden, confirmarOrden } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirAcceso, type Resultado } from '@/lib/acceso';

export async function accionOrden(
  ids: { obraId: string; ordenId: string; que: 'confirmar' | 'aprobar' },
  _previo: Resultado | null,
): Promise<Resultado> {
  const r = await comoMiembro(
    (tx) =>
      ids.que === 'confirmar'
        ? confirmarOrden(tx, { ordenId: ids.ordenId })
        : aprobarOrden(tx, { ordenId: ids.ordenId }),
    await exigirAcceso(),
  );
  if (!r.ok) return r;
  revalidatePath(`/obras/${ids.obraId}/ordenes`);
  revalidatePath('/');
  return { ok: true, datos: undefined };
}
