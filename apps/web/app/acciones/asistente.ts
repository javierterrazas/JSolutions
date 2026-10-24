'use server';
// Las llaves del asistente del dueño (D-114): crear una (su enlace se ve una sola vez) y quitarla.
import { crearLlaveAsistente, quitarLlaveAsistente } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirDuenoCon, type Resultado } from '@/lib/acceso';
import { enlaceDeLaApp } from '@/lib/enlace';

export interface LlaveNueva {
  readonly nombre: string;
  /** La dirección de la conexión, con la llave adentro: la que se pega en el asistente. */
  readonly enlace: string;
}

export async function crearLlave(
  _previo: Resultado<LlaveNueva> | null,
  formulario: FormData,
): Promise<Resultado<LlaveNueva>> {
  const nombre = String(formulario.get('nombre') ?? '').trim();
  const r = await comoMiembro((tx) => crearLlaveAsistente(tx, { nombre }), await exigirDuenoCon('asistente'));
  if (!r.ok) return r;
  revalidatePath('/empresa/asistente');
  return { ok: true, datos: { nombre, enlace: await enlaceDeLaApp(`/mcp/${r.datos.llave}`) } };
}

export async function quitarLlave(llaveId: string): Promise<void> {
  await comoMiembro((tx) => quitarLlaveAsistente(tx, { llaveId }), await exigirDuenoCon('asistente'));
  revalidatePath('/empresa/asistente');
}
