'use server';
// Gastos (fase 2, paso 6b): adjuntar el recibo después, corregir o anular un gasto en 48 h (D-044), y la revisión
// del dueño de las compras arriba del límite. Registrar un gasto va por la cola (acciones/cola.ts: enviarGasto).
import { anular, corregir, marcarGastoRevisado, registrarFoto, rutaParaFoto } from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirAcceso, exigirDueno, type Resultado } from '@/lib/acceso';
import { clienteSupabase } from '@/lib/supabase';

/** Las fotos llegan comprimidas por el teléfono; esto es un tope por si no. */
const MAXIMO = 4 * 1024 * 1024;

const sinDatos = (r: Resultado<unknown>): Resultado => (r.ok ? { ok: true, datos: undefined } : r);

/** El recibo de un gasto que se registró sin él (legacy: pmSubirRecibo). Necesita señal. */
export async function subirRecibo(
  ids: { obraId: string; gastoId: string },
  _previo: Resultado | null,
  formulario: FormData,
): Promise<Resultado> {
  const foto = formulario.get('foto');
  if (!(foto instanceof File) || !foto.type.startsWith('image/') || foto.size > MAXIMO)
    return { ok: false, codigo: 'foto_invalida' };
  const r = await comoMiembro(
    async (tx) => {
      const [ultima] = await tx<{ n: number }[]>`
      select coalesce(max(indice), 0)::int as n from fotos where ref_tipo = 'gasto' and ref_id = ${ids.gastoId}`;
      const { ruta } = await rutaParaFoto(tx, { refTipo: 'gasto', refId: ids.gastoId });
      const subida = await (
        await clienteSupabase()
      ).storage
        .from('fotos')
        .upload(ruta, foto, { contentType: 'image/jpeg', upsert: false });
      if (subida.error) throw new Error(`Storage: ${subida.error.message}`);
      await registrarFoto(tx, { refTipo: 'gasto', refId: ids.gastoId, indice: ultima!.n + 1, ruta });
    },
    await exigirAcceso(),
  );
  if (r.ok) revalidatePath(`/obras/${ids.obraId}/gasto`);
  return sinDatos(r);
}

/** Corrige un gasto propio dentro de 48 h: monto, partida, categoría, proveedor o descripción, con su motivo. */
export async function corregirGasto(
  ids: { obraId: string; gastoId: string },
  _previo: Resultado | null,
  formulario: FormData,
): Promise<Resultado> {
  const monto = Number(String(formulario.get('monto') ?? '').replace(/[$,\s]/g, ''));
  if (!(monto > 0)) return { ok: false, codigo: 'monto_invalido' };
  const partida = String(formulario.get('partida') ?? '');
  const r = await comoMiembro(
    (tx) =>
      corregir(tx, {
        tabla: 'gastos',
        registroId: ids.gastoId,
        cambios: {
          monto,
          categoria: String(formulario.get('categoria') ?? ''),
          proveedor: String(formulario.get('proveedor') ?? '').trim(),
          descripcion: String(formulario.get('descripcion') ?? '').trim() || null,
          // un gasto no se regresa a "sin partida": eso se anula y se vuelve a registrar
          ...(partida ? { partida_obra_id: partida } : {}),
        },
        motivo: String(formulario.get('motivo') ?? ''),
      }),
    await exigirAcceso(),
  );
  if (r.ok) revalidatePath(`/obras/${ids.obraId}/gasto`);
  return sinDatos(r);
}

/** Anula un gasto propio dentro de 48 h, con su motivo: queda, pero sale de todos los cálculos. */
export async function anularGasto(
  ids: { obraId: string; gastoId: string },
  _previo: Resultado | null,
  formulario: FormData,
): Promise<Resultado> {
  const r = await comoMiembro(
    (tx) =>
      anular(tx, {
        tabla: 'gastos',
        registroId: ids.gastoId,
        motivo: String(formulario.get('motivo') ?? ''),
      }),
    await exigirAcceso(),
  );
  if (r.ok) revalidatePath(`/obras/${ids.obraId}/gasto`);
  return sinDatos(r);
}

/** El dueño marca revisada una compra del PM arriba del límite. */
export async function revisarGasto(gastoId: string, _previo: Resultado | null): Promise<Resultado> {
  const r = await comoMiembro((tx) => marcarGastoRevisado(tx, { gastoId }), await exigirDueno());
  if (r.ok) revalidatePath('/gastos');
  return sinDatos(r);
}
