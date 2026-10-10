'use server';
// El dueño contesta un aviso del PM (fase 2, paso 6c). Levantar un aviso va por la cola (acciones/cola.ts).
import { responderAviso } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirDueno, type Resultado } from '@/lib/acceso';

export async function contestarAviso(
  avisoId: string,
  _previo: Resultado | null,
  formulario: FormData,
): Promise<Resultado> {
  const r = await comoMiembro(
    (tx) => responderAviso(tx, { avisoId, respuesta: String(formulario.get('respuesta') ?? '') }),
    await exigirDueno(),
  );
  if (!r.ok) return r;
  revalidatePath('/avisos');
  revalidatePath('/');
  return { ok: true, datos: undefined };
}
