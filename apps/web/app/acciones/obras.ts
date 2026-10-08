'use server';
// El dueño da de alta una obra y captura su presupuesto por etapa (D-039), con los flujos de la fase 1.
import { crearObra, guardarPresupuesto, type EntradaObra, type ResultadoPresupuesto } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { comoMiembro, exigirDueno, type Resultado } from '@/lib/acceso';

/**
 * Crea la obra y manda a capturar su presupuesto. Si el mismo cliente ya tiene una obra activa en esa dirección,
 * regresa `obra_duplicada` para que el dueño confirme.
 */
export async function crearObraNueva(_previo: Resultado | null, entrada: EntradaObra): Promise<Resultado> {
  const r = await comoMiembro((tx) => crearObra(tx, entrada), await exigirDueno());
  if (!r.ok) return r;
  if (!r.datos.ok) return { ok: false, codigo: 'obra_duplicada' };
  revalidatePath('/obras');
  redirect(`/obras/${r.datos.obraId}/presupuesto`);
}

export async function guardarPresupuestoObra(
  _previo: Resultado<ResultadoPresupuesto> | null,
  entrada: { obraId: string; lineas: { espacioId: string; etapaId: string | null; monto: number }[] },
): Promise<Resultado<ResultadoPresupuesto>> {
  const r = await comoMiembro((tx) => guardarPresupuesto(tx, entrada), await exigirDueno());
  if (r.ok) revalidatePath('/obras');
  return r;
}
