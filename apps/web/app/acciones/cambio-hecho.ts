'use server';
// Marcar hecha una orden de cambio que el cliente aprobó (D-081): el PM, desde su inicio, con una nota y fotos si
// quiere. Necesita señal, como la inspección: la orden y sus fotos van en una sola transacción. Las fotos se ven en
// el portal del cliente.
import { marcarCambioHecho, registrarFoto, rutaParaFoto } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirAcceso, type Resultado } from '@/lib/acceso';
import { clienteSupabase } from '@/lib/supabase';

/** Las fotos llegan comprimidas por el teléfono; esto es un tope por si no. */
const MAXIMO = 4 * 1024 * 1024;

export async function marcarHecho(
  ordenId: string,
  _previo: Resultado | null,
  f: FormData,
): Promise<Resultado> {
  const fotos = f.getAll('foto').filter((x): x is File => x instanceof File && x.size > 0);
  if (!fotos.every((x) => x.type.startsWith('image/') && x.size <= MAXIMO))
    return { ok: false, codigo: 'foto_invalida' };
  const r = await comoMiembro(
    async (tx) => {
      const h = await marcarCambioHecho(tx, { ordenId, nota: String(f.get('nota') ?? '') });
      const supabase = await clienteSupabase();
      for (const [i, foto] of fotos.entries()) {
        const { ruta } = await rutaParaFoto(tx, { refTipo: 'cambio_hecho', refId: h.cambioHechoId });
        const subida = await supabase.storage
          .from('fotos')
          .upload(ruta, foto, { contentType: 'image/jpeg', upsert: false });
        if (subida.error) throw new Error(`Storage: ${subida.error.message}`);
        await registrarFoto(tx, { refTipo: 'cambio_hecho', refId: h.cambioHechoId, indice: i + 1, ruta });
      }
    },
    await exigirAcceso(),
  );
  if (!r.ok) return r;
  revalidatePath('/');
  return { ok: true, datos: undefined };
}
