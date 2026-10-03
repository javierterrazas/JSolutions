// Fotos (D-007, D-026). El teléfono sube el archivo directo a Storage, a una ruta aleatoria que le da el servidor;
// después el servidor la registra. Cada foto lleva su número: si la señal falla y se reintenta, la que ya llegó no
// se guarda dos veces. Para verlas, el servidor da enlaces firmados de pocos minutos, solo si el usuario puede ver
// esa foto.
import { randomUUID } from 'node:crypto';
import { ErrorDeNegocio } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { uuid, validarEntrada } from './entrada';
import { leerSesion } from './sesion';

const TIPOS = ['bitacora', 'inspeccion', 'prueba_agua', 'aviso', 'punch', 'gasto', 'orden_cambio'] as const;
type TipoFoto = (typeof TIPOS)[number];
const TABLA: Record<TipoFoto, string> = {
  bitacora: 'bitacora',
  inspeccion: 'inspecciones',
  prueba_agua: 'pruebas_agua',
  aviso: 'avisos',
  punch: 'punch_list',
  gasto: 'gastos',
  orden_cambio: 'ordenes_cambio',
};

/** La obra de un registro que el usuario puede ver, o `registro_no_encontrado`. */
async function obraDe(tx: Tx, tipo: TipoFoto, refId: string): Promise<string> {
  const [r] = await tx<{ obra_id: string }[]>`select obra_id from ${tx(TABLA[tipo])} where id = ${refId}`;
  if (!r) throw new ErrorDeNegocio('registro_no_encontrado');
  return r.obra_id;
}

/** Una ruta nueva, aleatoria, dentro de la carpeta de la empresa y la obra del registro. */
export async function rutaParaFoto(
  tx: Tx,
  entrada: { refTipo: TipoFoto; refId: string; extension?: string },
  ahora = new Date(),
) {
  const e = validarEntrada(
    z.object({
      refTipo: z.enum(TIPOS),
      refId: uuid,
      extension: z.enum(['jpg', 'png', 'webp', 'heic', 'pdf']).default('jpg'),
    }),
    entrada,
  );
  const s = await leerSesion(tx, ahora);
  const obra = await obraDe(tx, e.refTipo, e.refId);
  return { ruta: `${s.empresaId}/${obra}/${e.refTipo}/${randomUUID()}.${e.extension}` };
}

const EntradaFoto = z.object({
  refTipo: z.enum(TIPOS),
  refId: uuid,
  indice: z.number().int().positive(),
  ruta: z.string().min(1),
  tomadaEn: z.string().datetime({ offset: true }).nullish(),
});
export type EntradaFoto = z.input<typeof EntradaFoto>;

/**
 * Registra una foto ya subida. Un reintento con el mismo número devuelve la que ya estaba (`repetida`). La foto de
 * un cierre tiene que ser una de las comprometidas; el archivo tiene que existir y haberlo subido este usuario.
 * Errores: `registro_no_encontrado`, `foto_no_comprometida`, `foto_no_subida`.
 */
export async function registrarFoto(
  tx: Tx,
  entrada: EntradaFoto,
  ahora = new Date(),
): Promise<{ fotoId: string; repetida: boolean; pendientes: number | null }> {
  const e = validarEntrada(EntradaFoto, entrada);
  const s = await leerSesion(tx, ahora);
  const obra = await obraDe(tx, e.refTipo, e.refId);
  const pendientes = async () => {
    if (e.refTipo !== 'bitacora') return null;
    const [b] = await tx<{ n: number; subidas: number }[]>`
      select fotos_comprometidas as n,
             (select count(*)::int from fotos f where f.ref_tipo = 'bitacora' and f.ref_id = ${e.refId}) as subidas
      from bitacora where id = ${e.refId}`;
    return Math.max(0, b!.n - b!.subidas);
  };

  const [ya] = await tx<{ id: string }[]>`
    select id from fotos where ref_tipo = ${e.refTipo} and ref_id = ${e.refId} and indice = ${e.indice}`;
  if (ya) return { fotoId: ya.id, repetida: true, pendientes: await pendientes() };

  if (e.refTipo === 'bitacora') {
    const [b] = await tx<
      { n: number }[]
    >`select fotos_comprometidas as n from bitacora where id = ${e.refId}`;
    if (e.indice > b!.n) throw new ErrorDeNegocio('foto_no_comprometida', { comprometidas: b!.n });
  }
  const [subida] = await tx<{ ok: boolean }[]>`select public.foto_subida(${e.ruta}) as ok`;
  if (!subida!.ok) throw new ErrorDeNegocio('foto_no_subida');

  const [f] = await tx<{ id: string }[]>`
    insert into fotos (empresa_id, obra_id, ref_tipo, ref_id, indice, storage_path, tomada_en)
    values (${s.empresaId}, ${obra}, ${e.refTipo}, ${e.refId}, ${e.indice}, ${e.ruta}, ${e.tomadaEn ?? null})
    returning id`;
  return { fotoId: f!.id, repetida: false, pendientes: await pendientes() };
}

/** Quien firma los enlaces de Storage (el service role, solo para esto). */
export type FirmarEnlace = (ruta: string, segundos: number) => Promise<string>;

/** Los minutos que dura un enlace a una foto: no sobrevive a una baja ni a la entrega de la obra. */
export const SEGUNDOS_ENLACE = 300;

/** Un enlace firmado para ver una foto que el usuario puede ver (RLS); si no, `foto_no_encontrada`. */
export async function enlaceDeFoto(
  tx: Tx,
  fotoId: string,
  firmar: FirmarEnlace,
): Promise<{ url: string; segundos: number }> {
  validarEntrada(uuid, fotoId);
  const [f] = await tx<{ ruta: string }[]>`select storage_path as ruta from fotos where id = ${fotoId}`;
  if (!f) throw new ErrorDeNegocio('foto_no_encontrada');
  return { url: await firmar(f.ruta, SEGUNDOS_ENLACE), segundos: SEGUNDOS_ENLACE };
}
