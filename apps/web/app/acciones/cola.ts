'use server';
// Lo que manda la cola del teléfono (fase 2, paso 5): un cierre con su clave de envío, o una foto de un cierre. A
// diferencia de las pantallas, no redirigen: si la sesión ya no sirve contestan `sesion`, y la cola espera a que
// el PM vuelva a entrar sin perder nada.
import { cerrarDia, cierreDeClave, type EntradaCierre, registrarFoto, rutaParaFoto } from '@ijm/servidor';
import { comoMiembro, estadoDeAcceso, type Resultado } from '@/lib/acceso';
import type { Respuesta } from '@/lib/cola';
import { clienteSupabase } from '@/lib/supabase';

const SIN_SESION = { ok: false, codigo: 'sesion' } as const;

/** Las fotos llegan ya comprimidas por el teléfono; esto es un tope por si no. */
const MAXIMO = 4 * 1024 * 1024;

const respuesta = (r: Resultado<unknown>): Respuesta =>
  r.ok ? { ok: true } : { ok: false, codigo: r.codigo, ...(r.datos ? { datos: r.datos } : {}) };

/** Un cierre de la cola. Devuelve también su bitácora, para la pantalla que lo capturó. */
export async function enviarCierre(
  entrada: EntradaCierre,
): Promise<Respuesta & { readonly bitacoraId?: string; readonly folio?: string }> {
  const a = await estadoDeAcceso();
  if (a.estado !== 'abierto') return SIN_SESION;
  const r = await comoMiembro((tx) => cerrarDia(tx, entrada), a.acceso);
  return r.ok ? { ok: true, bitacoraId: r.datos.bitacoraId, folio: r.datos.folio } : respuesta(r);
}

/** La foto número `indice` del cierre con esa clave: la ruta la da el servidor y va a Storage con la sesión del PM. */
export async function enviarFoto(clave: string, indice: number, formulario: FormData): Promise<Respuesta> {
  const a = await estadoDeAcceso();
  if (a.estado !== 'abierto') return SIN_SESION;
  const foto = formulario.get('foto');
  if (!(foto instanceof File) || !foto.type.startsWith('image/') || foto.size > MAXIMO)
    return { ok: false, codigo: 'foto_invalida' };
  const tomadaEn = String(formulario.get('tomadaEn') ?? '') || null;

  const bitacora = await comoMiembro((tx) => cierreDeClave(tx, clave), a.acceso);
  if (!bitacora.ok) return respuesta(bitacora);
  if (!bitacora.datos) return { ok: false, codigo: 'registro_no_encontrado' };
  const bitacoraId = bitacora.datos;

  const ruta = await comoMiembro(
    (tx) => rutaParaFoto(tx, { refTipo: 'bitacora', refId: bitacoraId }),
    a.acceso,
  );
  if (!ruta.ok) return respuesta(ruta);
  const supabase = await clienteSupabase();
  const subida = await supabase.storage
    .from('fotos')
    .upload(ruta.datos.ruta, foto, { contentType: 'image/jpeg', upsert: false });
  // una falla de Storage es pasajera: se reintenta, como un error de red
  if (subida.error) throw new Error(`Storage: ${subida.error.message}`);

  return respuesta(
    await comoMiembro(
      (tx) =>
        registrarFoto(tx, {
          refTipo: 'bitacora',
          refId: bitacoraId,
          indice,
          ruta: ruta.datos.ruta,
          tomadaEn,
        }),
      a.acceso,
    ),
  );
}
