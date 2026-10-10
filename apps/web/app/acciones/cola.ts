'use server';
// Lo que manda la cola del teléfono (fase 2, pasos 5, 6b y 6c): un cierre, un gasto o un aviso con su clave de envío,
// o una foto de uno de ellos. A diferencia de las pantallas, no redirigen: si la sesión ya no sirve contestan
// `sesion`, y la cola espera a que el PM vuelva a entrar sin perder nada.
import {
  avisoDeClave,
  cerrarDia,
  cierreDeClave,
  type EntradaAviso,
  type EntradaCierre,
  type EntradaGasto,
  gastoDeClave,
  levantarAviso,
  registrarFoto,
  registrarGasto,
  rutaParaFoto,
} from '@ijm/servidor';
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

/** Un gasto de la cola (D-049). Devuelve también si pasó el límite, para la pantalla que lo capturó. */
export async function enviarGasto(
  entrada: EntradaGasto,
): Promise<Respuesta & { readonly enRevision?: boolean; readonly limite?: number }> {
  const a = await estadoDeAcceso();
  if (a.estado !== 'abierto') return SIN_SESION;
  const r = await comoMiembro((tx) => registrarGasto(tx, entrada), a.acceso);
  return r.ok ? { ok: true, enRevision: r.datos.enRevision, limite: r.datos.limite } : respuesta(r);
}

/** Un aviso de la cola (D-050). */
export async function enviarAviso(entrada: EntradaAviso): Promise<Respuesta> {
  const a = await estadoDeAcceso();
  if (a.estado !== 'abierto') return SIN_SESION;
  return respuesta(await comoMiembro((tx) => levantarAviso(tx, entrada), a.acceso));
}

/** De qué registro es cada foto de la cola, y cómo se encuentra por su clave de envío. */
const REGISTRO = {
  cierre: { refTipo: 'bitacora', deClave: cierreDeClave },
  gasto: { refTipo: 'gasto', deClave: gastoDeClave },
  aviso: { refTipo: 'aviso', deClave: avisoDeClave },
} as const;

/**
 * La foto número `indice` del cierre, el gasto o el aviso con esa clave: la ruta la da el servidor y va a Storage
 * con la sesión del PM.
 */
export async function enviarFoto(
  clave: string,
  indice: number,
  formulario: FormData,
  de: 'cierre' | 'gasto' | 'aviso' = 'cierre',
): Promise<Respuesta> {
  const a = await estadoDeAcceso();
  if (a.estado !== 'abierto') return SIN_SESION;
  const foto = formulario.get('foto');
  if (!(foto instanceof File) || !foto.type.startsWith('image/') || foto.size > MAXIMO)
    return { ok: false, codigo: 'foto_invalida' };
  const tomadaEn = String(formulario.get('tomadaEn') ?? '') || null;
  const { refTipo, deClave } = REGISTRO[de];

  const registro = await comoMiembro((tx) => deClave(tx, clave), a.acceso);
  if (!registro.ok) return respuesta(registro);
  if (!registro.datos) return { ok: false, codigo: 'registro_no_encontrado' };
  const refId = registro.datos;

  const ruta = await comoMiembro((tx) => rutaParaFoto(tx, { refTipo, refId }), a.acceso);
  if (!ruta.ok) return respuesta(ruta);
  const supabase = await clienteSupabase();
  const subida = await supabase.storage
    .from('fotos')
    .upload(ruta.datos.ruta, foto, { contentType: 'image/jpeg', upsert: false });
  // una falla de Storage es pasajera: se reintenta, como un error de red
  if (subida.error) throw new Error(`Storage: ${subida.error.message}`);

  return respuesta(
    await comoMiembro(
      (tx) => registrarFoto(tx, { refTipo, refId, indice, ruta: ruta.datos.ruta, tomadaEn }),
      a.acceso,
    ),
  );
}
