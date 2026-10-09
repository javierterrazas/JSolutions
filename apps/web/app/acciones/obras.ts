'use server';
// El dueño da de alta una obra y captura su presupuesto por etapa (D-039), con los flujos de la fase 1.
import {
  agregarEspacio,
  crearObra,
  guardarPresupuesto,
  type EntradaObra,
  type ResultadoPresupuesto,
} from '@ijm/servidor';
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

/** Agrega un espacio a una obra que ya existe, con las partidas de su tipo; su presupuesto se captura enseguida. */
export async function agregarEspacioAObra(
  obraId: string,
  _previo: Resultado<{ espacioId: string }> | null,
  formulario: FormData,
): Promise<Resultado<{ espacioId: string }>> {
  const pies2 = Number(String(formulario.get('pies2') ?? '').replace(/[,\s]/g, ''));
  const r = await comoMiembro(
    (tx) =>
      agregarEspacio(tx, {
        obraId,
        tipoEspacioId: String(formulario.get('tipo') ?? ''),
        nombre: String(formulario.get('nombre') ?? ''),
        pies2: Number.isFinite(pies2) ? pies2 : null,
      }),
    await exigirDueno(),
  );
  if (r.ok) revalidatePath(`/obras/${obraId}/presupuesto`);
  return r;
}
