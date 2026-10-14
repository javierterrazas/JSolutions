// La marca de cada empresa (D-078): su logo, su color y el fondo del ícono. La app instalada lleva el ícono y el nombre
// de la empresa que la usa; el logo sale arriba de cada pantalla y en el portal del cliente. El dueño la cambia en
// "Mi empresa"; el manifiesto y los íconos se leen sin sesión (el teléfono los pide sin las cookies de la app).
import { ErrorDeNegocio } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

export const COLOR_POR_OMISION = '#1d3557';
/** El logo, hasta 1 MB: PNG o JPEG (lo que dibuja el generador de íconos). */
export const LOGO_MAXIMO = 1024 * 1024;
export type TipoLogo = 'image/png' | 'image/jpeg';

export interface MarcaDeEmpresa {
  readonly empresaId: string;
  readonly nombre: string;
  readonly color: string;
  readonly fondoBlanco: boolean;
  readonly conLogo: boolean;
  readonly version: number;
}

export interface MarcaPublica {
  readonly nombre: string;
  readonly color: string;
  readonly logo: Buffer | null;
  readonly logoTipo: TipoLogo | null;
  readonly fondoBlanco: boolean;
  readonly version: number;
}

/** El tipo real de una imagen por sus primeros bytes: no se le cree a la extensión ni a lo que diga el navegador. */
export function tipoDeImagen(bytes: Uint8Array): TipoLogo | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'image/png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null;
}

/** La marca de la empresa del dueño, para "Mi empresa". */
export async function marcaDeMiEmpresa(tx: Tx, ahora = new Date()): Promise<MarcaDeEmpresa> {
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const [m] = await tx<
    { nombre: string; color: string | null; fondo: boolean | null; logo: boolean; version: number | null }[]
  >`
    select e.nombre, m.color, m.fondo_blanco as fondo, m.logo is not null as logo, m.version
    from empresa_actual_datos e left join marcas_empresa m on m.empresa_id = e.id`;
  return {
    empresaId: s.empresaId,
    nombre: m?.nombre ?? '',
    color: m?.color ?? COLOR_POR_OMISION,
    fondoBlanco: m?.fondo ?? true,
    conLogo: !!m?.logo,
    version: m?.version ?? 1,
  };
}

const EntradaMarca = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fondoBlanco: z.boolean(),
  /** El logo nuevo; null lo quita; sin él, se queda el que hay. */
  logo: z.instanceof(Uint8Array).nullish(),
});

/**
 * Cambia la marca de la empresa: su color, el fondo del ícono y, si se manda, su logo (o lo quita). Cada cambio sube
 * la versión, para que el teléfono pida los íconos nuevos. Solo el dueño o el administrador. Errores: `logo_invalido`
 * (no es PNG ni JPEG), `logo_pesado` (más de 1 MB).
 */
export async function guardarMarca(
  tx: Tx,
  entrada: z.input<typeof EntradaMarca>,
  ahora = new Date(),
): Promise<{ version: number }> {
  const e = validarEntrada(EntradaMarca, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  let logo: { bytes: Buffer | null; tipo: TipoLogo | null } | undefined;
  if (e.logo === null) logo = { bytes: null, tipo: null };
  else if (e.logo) {
    if (e.logo.length > LOGO_MAXIMO) throw new ErrorDeNegocio('logo_pesado');
    const tipo = tipoDeImagen(e.logo);
    if (!tipo) throw new ErrorDeNegocio('logo_invalido');
    logo = { bytes: Buffer.from(e.logo), tipo };
  }
  const [m] = await tx<{ version: number }[]>`
    insert into marcas_empresa (empresa_id, color, fondo_blanco, logo, logo_tipo)
    values (${s.empresaId}, ${e.color.toLowerCase()}, ${e.fondoBlanco}, ${logo?.bytes ?? null}, ${logo?.tipo ?? null})
    on conflict (empresa_id) do update set
      color = excluded.color,
      fondo_blanco = excluded.fondo_blanco,
      logo = ${logo ? tx`excluded.logo` : tx`marcas_empresa.logo`},
      logo_tipo = ${logo ? tx`excluded.logo_tipo` : tx`marcas_empresa.logo_tipo`},
      version = marcas_empresa.version + 1
    returning version`;
  return { version: m!.version };
}

/** La marca de una empresa, sin sesión (`sinUsuario`), para su manifiesto y sus íconos; null si no existe. */
export async function marcaPublica(tx: Tx, entrada: { empresaId: string }): Promise<MarcaPublica | null> {
  const { empresaId } = validarEntrada(z.object({ empresaId: uuid }), entrada);
  const [m] = await tx<
    {
      nombre: string;
      color: string;
      logo: Buffer | null;
      logo_tipo: TipoLogo | null;
      fondo_blanco: boolean;
      version: number;
    }[]
  >`select * from public.marca_publica(${empresaId})`;
  if (!m) return null;
  return {
    nombre: m.nombre,
    color: m.color,
    logo: m.logo,
    logoTipo: m.logo_tipo,
    fondoBlanco: m.fondo_blanco,
    version: m.version,
  };
}

/**
 * La empresa del enlace del portal del cliente, para mostrar su logo (si tiene, y su versión); null si el enlace no
 * sirve. Sin sesión.
 */
export async function empresaDelPortal(
  tx: Tx,
  entrada: { token: string },
): Promise<{ id: string; conLogo: boolean; version: number } | null> {
  const { token } = validarEntrada(z.object({ token: z.string().min(20).max(200) }), entrada);
  const [r] = await tx<{ empresa_id: string; con_logo: boolean; version: number }[]>`
    select * from public.empresa_portal_cliente(${token})`;
  return r ? { id: r.empresa_id, conLogo: r.con_logo, version: r.version } : null;
}
