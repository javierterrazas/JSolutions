'use server';
// Cerrar una obra al entregarla (D-085): con algo grave pendiente, primero se confirma.
import { cerrarObra, type ResultadoCierreObra } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirDueno, type Resultado } from '@/lib/acceso';

export async function cerrarLaObra(
  obraId: string,
  _previo: Resultado<ResultadoCierreObra> | null,
  f: FormData,
): Promise<Resultado<ResultadoCierreObra>> {
  const r = await comoMiembro(
    (tx) =>
      cerrarObra(tx, {
        obraId,
        fechaEntrega: String(f.get('fechaEntrega') ?? ''),
        garantiaMeses: Number(f.get('garantiaMeses') ?? 12),
        forzar: f.get('forzar') === 'si',
      }),
    await exigirDueno(),
  );
  if (r.ok && r.datos.ok) {
    revalidatePath('/obras');
    revalidatePath(`/obras/${obraId}`, 'layout');
  }
  return r;
}
