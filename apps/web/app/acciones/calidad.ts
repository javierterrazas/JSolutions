'use server';
// Calidad en obra (fase 2, paso 6a): la inspección de un punto de control y la prueba de inundación. Necesitan
// señal, como en el legacy: el PM tiene que ver en el momento si se aprobó. Cada registro y sus fotos van en una
// sola transacción: si una foto no sube, no queda nada a medias (el archivo que alcanzó a subir queda huérfano en
// Storage, sin registro, y nadie lo ve).
import {
  iniciarPruebaAgua,
  registrarFoto,
  registrarInspeccion,
  rutaParaFoto,
  terminarPruebaAgua,
  type Tx,
} from '@ijm/servidor';
import { revalidatePath } from 'next/cache';
import { comoMiembro, exigirAcceso, type Resultado } from '@/lib/acceso';
import { clienteSupabase } from '@/lib/supabase';

/** Las fotos llegan comprimidas por el teléfono; esto es un tope por si no. */
const MAXIMO = 4 * 1024 * 1024;

/** Las fotos del formulario, o null si alguna no es una imagen válida. */
function fotosDe(formulario: FormData): File[] | null {
  const fotos = formulario.getAll('foto').filter((f): f is File => f instanceof File && f.size > 0);
  return fotos.every((f) => f.type.startsWith('image/') && f.size <= MAXIMO) ? fotos : null;
}

/** Sube las fotos a Storage con la sesión del PM y las registra, numeradas desde `desde`, en la misma transacción. */
async function subirFotos(
  tx: Tx,
  refTipo: 'inspeccion' | 'prueba_agua',
  refId: string,
  fotos: readonly File[],
  desde = 1,
) {
  const supabase = await clienteSupabase();
  for (const [i, foto] of fotos.entries()) {
    const { ruta } = await rutaParaFoto(tx, { refTipo, refId });
    const subida = await supabase.storage
      .from('fotos')
      .upload(ruta, foto, { contentType: 'image/jpeg', upsert: false });
    if (subida.error) throw new Error(`Storage: ${subida.error.message}`);
    await registrarFoto(tx, { refTipo, refId, indice: desde + i, ruta });
  }
}

export interface InspeccionGuardada {
  readonly resultado: 'aprobado' | 'con_defectos';
  readonly defectos: number;
}

export async function guardarInspeccion(
  ids: { obraId: string; espacioId: string; hitoId: string },
  _previo: Resultado<InspeccionGuardada> | null,
  formulario: FormData,
): Promise<Resultado<InspeccionGuardada>> {
  const fotos = fotosDe(formulario);
  if (!fotos) return { ok: false, codigo: 'foto_invalida' };
  const r = await comoMiembro(
    async (tx) => {
      const i = await registrarInspeccion(tx, {
        ...ids,
        cumple: formulario.getAll('cumple').map(String),
        noAplica: formulario.getAll('noAplica').map(String),
        fotos: fotos.length,
      });
      await subirFotos(tx, 'inspeccion', i.inspeccionId, fotos);
      return { resultado: i.resultado, defectos: i.defectos };
    },
    await exigirAcceso(),
  );
  if (r.ok) revalidatePath(`/obras/${ids.obraId}`, 'layout');
  return r;
}

/** Arranca la prueba de inundación con la foto del nivel (la foto 1 de la prueba). */
export async function arrancarPrueba(
  ids: { obraId: string; espacioId: string },
  _previo: Resultado | null,
  formulario: FormData,
): Promise<Resultado> {
  const fotos = fotosDe(formulario);
  if (!fotos) return { ok: false, codigo: 'foto_invalida' };
  const r = await comoMiembro(
    async (tx) => {
      const { pruebaId } = await iniciarPruebaAgua(tx, { ...ids, fotos: fotos.length });
      await subirFotos(tx, 'prueba_agua', pruebaId, fotos.slice(0, 1));
    },
    await exigirAcceso(),
  );
  if (r.ok) revalidatePath(`/obras/${ids.obraId}`, 'layout');
  return r.ok ? { ok: true, datos: undefined } : r;
}

/** Cierra la prueba con la foto del nivel (la foto 2 de la prueba): sin fuga, o con fuga. */
export async function cerrarPrueba(
  ids: { obraId: string; pruebaId: string },
  _previo: Resultado | null,
  formulario: FormData,
): Promise<Resultado> {
  const fotos = fotosDe(formulario);
  if (!fotos) return { ok: false, codigo: 'foto_invalida' };
  const hayFuga = formulario.get('fuga') === 'si';
  const r = await comoMiembro(
    async (tx) => {
      await terminarPruebaAgua(tx, { pruebaId: ids.pruebaId, hayFuga, fotos: fotos.length });
      await subirFotos(tx, 'prueba_agua', ids.pruebaId, fotos.slice(0, 1), 2);
    },
    await exigirAcceso(),
  );
  if (r.ok) revalidatePath(`/obras/${ids.obraId}`, 'layout');
  return r.ok ? { ok: true, datos: undefined } : r;
}
