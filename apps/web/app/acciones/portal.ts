'use server';
// El portal del cliente (D-066): el dueño crea o desactiva el enlace de una obra; el PM o el dueño marcan qué fotos
// ve el cliente.
import { anularEnlaceCliente, crearEnlaceCliente, marcarFotoCliente } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirAcceso, exigirDueno, type Resultado } from '@/lib/acceso';

/** Crea el enlace (y anula el anterior). El token vuelve una sola vez: la base guarda su hash. */
export async function crearEnlace(
  obraId: string,
  _previo: Resultado<{ token: string }> | null,
): Promise<Resultado<{ token: string }>> {
  const r = await comoMiembro((tx) => crearEnlaceCliente(tx, { obraId }), await exigirDueno());
  if (r.ok) revalidatePath(`/obras/${obraId}/seguimiento`);
  return r;
}

export async function desactivarEnlace(
  obraId: string,
  _previo: Resultado<void> | null,
): Promise<Resultado<void>> {
  const r = await comoMiembro((tx) => anularEnlaceCliente(tx, { obraId }), await exigirDueno());
  if (r.ok) revalidatePath(`/obras/${obraId}/seguimiento`);
  return r;
}

/** Marca o desmarca una foto para el cliente, desde el álbum de la obra. */
export async function marcarFoto(obraId: string, fotoId: string, visible: boolean): Promise<void> {
  await comoMiembro((tx) => marcarFotoCliente(tx, { fotoId, visible }), await exigirAcceso());
  revalidatePath(`/obras/${obraId}/album`);
}
