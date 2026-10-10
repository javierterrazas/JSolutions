'use server';
// El recorrido de entrega y la medida verificada (fase 2, paso 6e). Necesitan señal, como en el legacy. El detalle y
// su foto van en una sola transacción.
import { agregarPunch, cerrarPunch, registrarFoto, rutaParaFoto, verificarMedida } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirAcceso, type Resultado } from '@/lib/acceso';
import { clienteSupabase } from '@/lib/supabase';

/** Las fotos llegan comprimidas por el teléfono; esto es un tope por si no. */
const MAXIMO = 4 * 1024 * 1024;

const numero = (f: FormData, k: string) => {
  const s = String(f.get(k) ?? '').replace(/[,\s]/g, '');
  return s === '' ? null : Number(s);
};

export async function anotarPunch(
  obraId: string,
  _previo: Resultado | null,
  formulario: FormData,
): Promise<Resultado> {
  const foto = formulario.get('foto');
  const conFoto = foto instanceof File && foto.size > 0;
  if (conFoto && (!foto.type.startsWith('image/') || foto.size > MAXIMO))
    return { ok: false, codigo: 'foto_invalida' };
  const r = await comoMiembro(
    async (tx) => {
      const p = await agregarPunch(tx, {
        obraId,
        item: String(formulario.get('item') ?? ''),
        origen: String(formulario.get('origen') ?? 'defecto') as 'defecto',
        responsable: String(formulario.get('responsable') ?? ''),
      });
      if (conFoto) {
        const { ruta } = await rutaParaFoto(tx, { refTipo: 'punch', refId: p.punchId });
        const subida = await (
          await clienteSupabase()
        ).storage
          .from('fotos')
          .upload(ruta, foto, { contentType: 'image/jpeg', upsert: false });
        if (subida.error) throw new Error(`Storage: ${subida.error.message}`);
        await registrarFoto(tx, { refTipo: 'punch', refId: p.punchId, indice: 1, ruta });
      }
    },
    await exigirAcceso(),
  );
  if (!r.ok) return r;
  revalidatePath(`/obras/${obraId}/entrega`);
  return { ok: true, datos: undefined };
}

export async function marcarCorregido(
  ids: { obraId: string; punchId: string },
  _previo: Resultado | null,
): Promise<Resultado> {
  const r = await comoMiembro((tx) => cerrarPunch(tx, { punchId: ids.punchId }), await exigirAcceso());
  if (!r.ok) return r;
  revalidatePath(`/obras/${ids.obraId}/entrega`);
  return { ok: true, datos: undefined };
}

export async function guardarMedida(
  ids: { obraId: string; espacioId: string },
  _previo: Resultado | null,
  formulario: FormData,
): Promise<Resultado> {
  const r = await comoMiembro(
    (tx) =>
      verificarMedida(tx, {
        espacioId: ids.espacioId,
        pies2: numero(formulario, 'pies2'),
        piesLineales: numero(formulario, 'lineales'),
      }),
    await exigirAcceso(),
  );
  if (!r.ok) return r;
  revalidatePath(`/obras/${ids.obraId}/entrega`);
  return { ok: true, datos: undefined };
}
