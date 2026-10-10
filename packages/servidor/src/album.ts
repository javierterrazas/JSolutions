// El álbum de fotos de una obra (fase 2, paso 6f; legacy: pm/servidor.js pmAlbum y vFotos de PM.html): las fotos de
// la obra agrupadas por su registro (el cierre del día, la inspección, la prueba de agua, el detalle del punch, el
// gasto, el aviso), lo más nuevo primero, por páginas. RLS decide qué fotos ve cada quien: el PM, las de sus obras,
// y de los gastos y avisos solo las suyas; nunca las de la oficina ni las de órdenes de cambio (D-002).
import { type Dia, diaEnZona } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { uuid, validarEntrada } from './entrada';
import { leerSesion } from './sesion';

/** Cuántos registros por página. */
export const REGISTROS_POR_PAGINA = 20;

export type TipoRegistroAlbum =
  'bitacora' | 'inspeccion' | 'prueba_agua' | 'punch' | 'gasto' | 'aviso' | 'orden_cambio';

export interface RegistroDelAlbum {
  readonly tipo: TipoRegistroAlbum;
  readonly id: string;
  /** El día del registro en la zona de la empresa. */
  readonly dia: Dia;
  /** Lo que identifica al registro, según su tipo (folio, punto de control, espacio, proveedor…). */
  readonly folio: string | null;
  readonly titulo: Nombre | null;
  readonly detalle: string | null;
  /** Para la inspección y la prueba de agua. */
  readonly resultado: string | null;
  readonly fotos: readonly string[];
}

export interface Album {
  readonly obra: { id: string; folio: string; cliente: string };
  readonly registros: readonly RegistroDelAlbum[];
  readonly hayMas: boolean;
}

/**
 * El álbum de una obra que el usuario ve: el PM, una de las suyas; el dueño, cualquiera de su empresa. Con `pagina`
 * (desde 0), los registros más viejos. Null si la obra no existe para él.
 */
export async function albumDeObra(
  tx: Tx,
  entrada: { obraId: string; pagina?: number },
  ahora = new Date(),
): Promise<Album | null> {
  const e = validarEntrada(
    z.object({ obraId: uuid, pagina: z.number().int().min(0).max(1000).default(0) }),
    entrada,
  );
  const s = await leerSesion(tx, ahora);
  const [obra] = await tx<{ id: string; folio: string; cliente: string }[]>`
    select id, folio, cliente from obras
    where id = ${e.obraId} and (${s.esDuenoOAdmin} or pm_id = ${s.miembroId})`;
  if (!obra) return null;

  const grupos = await tx<{ ref_tipo: TipoRegistroAlbum; ref_id: string; ultima: Date; fotos: string[] }[]>`
    select ref_tipo, ref_id, max(creado_en) as ultima, array_agg(id order by indice) as fotos
    from fotos where obra_id = ${e.obraId}
    group by ref_tipo, ref_id
    order by ultima desc
    limit ${REGISTROS_POR_PAGINA + 1} offset ${e.pagina * REGISTROS_POR_PAGINA}`;
  const pagina = grupos.slice(0, REGISTROS_POR_PAGINA);
  const ids = (tipo: TipoRegistroAlbum) => pagina.filter((g) => g.ref_tipo === tipo).map((g) => g.ref_id);

  // lo que identifica a cada registro, por tipo; lo que RLS no deja leer queda sin descripción
  type Info = Omit<RegistroDelAlbum, 'tipo' | 'id' | 'fotos' | 'dia'> & { dia: Dia | null };
  const info = new Map<string, Info>();
  const vacio: Info = { dia: null, folio: null, titulo: null, detalle: null, resultado: null };
  if (ids('bitacora').length)
    for (const b of await tx<
      { id: string; folio: string; dia: Dia; incidencia: string | null; estado: string }[]
    >`select id, folio, to_char(dia, 'YYYY-MM-DD') as dia, incidencia, estado from bitacora
      where id in ${tx(ids('bitacora'))}`)
      info.set(b.id, { ...vacio, dia: b.dia, folio: b.folio, detalle: b.incidencia, resultado: b.estado });
  if (ids('inspeccion').length)
    for (const i of await tx<
      { id: string; clave: string; es: string; en: string | null; espacio: string; resultado: string }[]
    >`select i.id, h.clave, h.nombre_es as es, h.nombre_en as en, e.nombre as espacio, i.resultado
      from inspecciones i join hitos_calidad h on h.id = i.hito_id join espacios e on e.id = i.espacio_id
      where i.id in ${tx(ids('inspeccion'))}`)
      info.set(i.id, {
        ...vacio,
        folio: i.clave,
        titulo: { es: i.es, en: i.en },
        detalle: i.espacio,
        resultado: i.resultado,
      });
  if (ids('prueba_agua').length)
    for (const p of await tx<{ id: string; espacio: string; resultado: string }[]>`
      select p.id, e.nombre as espacio, p.resultado from pruebas_agua p join espacios e on e.id = p.espacio_id
      where p.id in ${tx(ids('prueba_agua'))}`)
      info.set(p.id, { ...vacio, detalle: p.espacio, resultado: p.resultado });
  if (ids('punch').length)
    for (const p of await tx<{ id: string; folio: string; item: string }[]>`
      select id, folio, item from punch_list where id in ${tx(ids('punch'))}`)
      info.set(p.id, { ...vacio, folio: p.folio, detalle: p.item });
  if (ids('gasto').length)
    for (const g of await tx<{ id: string; folio: string; dia: Dia; proveedor: string }[]>`
      select id, folio, to_char(dia, 'YYYY-MM-DD') as dia, proveedor from gastos where id in ${tx(ids('gasto'))}`)
      info.set(g.id, { ...vacio, dia: g.dia, folio: g.folio, detalle: g.proveedor });
  if (ids('aviso').length)
    for (const a of await tx<{ id: string; folio: string; tipo: string; descripcion: string }[]>`
      select id, folio, tipo, descripcion from avisos where id in ${tx(ids('aviso'))}`)
      info.set(a.id, { ...vacio, folio: a.folio, detalle: a.descripcion, resultado: a.tipo });

  return {
    obra,
    registros: pagina.map((g) => {
      const i = info.get(g.ref_id) ?? vacio;
      return {
        tipo: g.ref_tipo,
        id: g.ref_id,
        ...i,
        dia: i.dia ?? diaEnZona(g.ultima, s.zona),
        fotos: g.fotos,
      };
    }),
    hayMas: grupos.length > REGISTROS_POR_PAGINA,
  };
}
