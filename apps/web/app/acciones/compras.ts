'use server';
// Las compras de la oficina (D-063): el dueño registra en una obra lo que compró, con la foto del recibo si la tiene.
// A diferencia del PM, la oficina tiene señal: va directo, sin la cola del teléfono.
import { type MetodoPago, registrarCompraOficina, registrarFoto, rutaParaFoto } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirDueno, type Resultado } from '@/lib/acceso';
import { clienteSupabase } from '@/lib/supabase';

/** Las fotos llegan comprimidas por el teléfono; esto es un tope por si no. */
const MAXIMO = 4 * 1024 * 1024;

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim() || null;

export async function registrarCompra(
  obraId: string,
  _previo: Resultado<{ folio: string }> | null,
  f: FormData,
): Promise<Resultado<{ folio: string }>> {
  const limpio = String(f.get('monto') ?? '').replace(/[$,\s]/g, '');
  const foto = f.get('foto');
  if (foto instanceof File && foto.size && (!foto.type.startsWith('image/') || foto.size > MAXIMO))
    return { ok: false, codigo: 'foto_invalida' };
  const entrada = {
    obraId,
    monto: limpio === '' ? null : Number(limpio),
    dia: texto(f, 'dia'),
    partidaId: texto(f, 'partidaId'),
    categoria: (texto(f, 'categoria') ?? 'material') as never,
    proveedor: texto(f, 'proveedor'),
    descripcion: texto(f, 'descripcion'),
    metodoPago: (texto(f, 'metodoPago') ?? 'transferencia') as MetodoPago,
  };
  // la compra y su recibo en una transacción: si el recibo no sube, la compra no queda a medias
  const r = await comoMiembro(
    async (tx) => {
      const g = await registrarCompraOficina(tx, entrada);
      if (foto instanceof File && foto.size) {
        const { ruta } = await rutaParaFoto(tx, { refTipo: 'gasto', refId: g.gastoId });
        const subida = await (
          await clienteSupabase()
        ).storage
          .from('fotos')
          .upload(ruta, foto, { contentType: 'image/jpeg', upsert: false });
        if (subida.error) throw new Error(`Storage: ${subida.error.message}`);
        await registrarFoto(tx, { refTipo: 'gasto', refId: g.gastoId, indice: 1, ruta });
      }
      return { folio: g.folio };
    },
    await exigirDueno(),
  );
  if (r.ok) revalidatePath(`/obras/${obraId}/seguimiento`);
  return r;
}
