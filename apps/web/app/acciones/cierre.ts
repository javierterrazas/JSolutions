'use server';
// Cerrar el día (fase 2, paso 4) y subir sus fotos. El cierre es el flujo de la fase 1 (cerrarDia); las fotos se
// suben después del cierre, una por una y con su número, para que un reintento no las duplique (D-007).
//
// Ninguna de las dos vuelve a pintar la página (revalidatePath): la pantalla de cierre vería el día ya cerrado y
// quitaría el formulario a media subida de fotos. El inicio se lee de nuevo al volver a él.
import {
  cerrarDia,
  type EntradaCierre,
  registrarFoto,
  type ResultadoCierre,
  rutaParaFoto,
} from '@ijm/servidor';
import { comoMiembro, exigirAcceso, type Resultado } from '@/lib/acceso';
import { clienteSupabase } from '@/lib/supabase';

export async function cerrarElDia(
  _previo: Resultado<ResultadoCierre> | null,
  entrada: EntradaCierre,
): Promise<Resultado<ResultadoCierre>> {
  return comoMiembro((tx) => cerrarDia(tx, entrada));
}

/** Las fotos llegan ya comprimidas por el teléfono; esto es un tope por si no. */
const MAXIMO = 4 * 1024 * 1024;

/** Sube la foto número `indice` de un cierre: la ruta la da el servidor, el archivo va a Storage con la sesión del PM. */
export async function subirFotoDeCierre(
  bitacoraId: string,
  indice: number,
  formulario: FormData,
): Promise<Resultado<{ pendientes: number | null }>> {
  const acceso = await exigirAcceso();
  const foto = formulario.get('foto');
  if (!(foto instanceof File) || !foto.type.startsWith('image/') || foto.size > MAXIMO)
    return { ok: false, codigo: 'foto_invalida' };
  const tomadaEn = String(formulario.get('tomadaEn') ?? '') || null;

  const ruta = await comoMiembro(
    (tx) => rutaParaFoto(tx, { refTipo: 'bitacora', refId: bitacoraId }),
    acceso,
  );
  if (!ruta.ok) return ruta;
  const supabase = await clienteSupabase();
  const subida = await supabase.storage
    .from('fotos')
    .upload(ruta.datos.ruta, foto, { contentType: 'image/jpeg', upsert: false });
  if (subida.error) return { ok: false, codigo: 'foto_no_subida' };

  const r = await comoMiembro(
    (tx) =>
      registrarFoto(tx, { refTipo: 'bitacora', refId: bitacoraId, indice, ruta: ruta.datos.ruta, tomadaEn }),
    acceso,
  );
  if (!r.ok) return r;
  return { ok: true, datos: { pendientes: r.datos.pendientes } };
}
