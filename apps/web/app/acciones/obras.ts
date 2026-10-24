'use server';
// El dueño da de alta una obra y captura su presupuesto por etapa (D-039), con los flujos de la fase 1.
import {
  agregarEspacio,
  crearObra,
  editarDatosObra,
  guardarPresupuesto,
  type EntradaObra,
  type ResultadoPresupuesto,
} from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { comoMiembro, exigirDueno, exigirDuenoCon, type Resultado } from '@/lib/acceso';

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
  entrada: {
    obraId: string;
    /** De cada etapa, su costo y, si es otro que el de la obra, su margen (D-084). */
    lineas: { espacioId: string; etapaId: string | null; costo: number; margen?: number | null }[];
    margenObjetivo: number;
    contrato: number | null;
    /** Los pies lineales cotizados de los espacios con etapas por pie lineal (D-086). */
    medidas: { espacioId: string; piesLineales: number }[];
  },
): Promise<Resultado<ResultadoPresupuesto>> {
  const r = await comoMiembro((tx) => guardarPresupuesto(tx, entrada), await exigirDuenoCon('dinero'));
  if (r.ok) revalidatePath('/obras');
  return r;
}

/** Corrige los datos del alta de una obra o le cambia el PM (D-064), y regresa a su seguimiento. */
export async function corregirDatosObra(
  obraId: string,
  _previo: Resultado | null,
  f: FormData,
): Promise<Resultado> {
  const texto = (campo: string) => String(f.get(campo) ?? '');
  const r = await comoMiembro(
    (tx) =>
      editarDatosObra(tx, {
        obraId,
        cliente: texto('cliente'),
        telefono: texto('telefono'),
        direccion: texto('direccion'),
        pmId: texto('pmId') || null,
        notas: texto('notas'),
      }),
    await exigirDueno(),
  );
  if (!r.ok) return r;
  revalidatePath('/obras');
  redirect(`/obras/${obraId}/seguimiento`);
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
