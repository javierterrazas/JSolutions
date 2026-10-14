// Los subcontratistas de la empresa, para el dueño (D-073; legacy: admin/servidor.js duGuardarSub, duActivarSub,
// revisionSub_): darlos de alta, editarlos con sus papeles (seguro, licencia, W-9) y darlos de baja o reactivarlos.
// Nunca se borran: su historial vive en sus órdenes de trabajo y sus pagos. El PM los ve por la vista
// subcontratistas_pm, sin papeles ni dinero.
import { type AvisoPapeles, type Dia, ErrorDeNegocio, exigir, revisarPapelesSub } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { dia, textoCorto, uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

export interface Subcontratista {
  readonly id: string;
  readonly nombre: string;
  readonly oficio: { id: string; nombre: Nombre; requiereLicencia: boolean };
  readonly telefono: string | null;
  readonly contacto: string | null;
  readonly correo: string | null;
  readonly seguroVence: Dia | null;
  readonly licencia: string | null;
  readonly licenciaVence: Dia | null;
  readonly w9: boolean;
  readonly activo: boolean;
  /** Lo que le falta en papeles (revisarPapelesSub); vacío, en regla. */
  readonly avisos: readonly AvisoPapeles[];
  /** Sus órdenes de trabajo sin terminar (emitidas, confirmadas o aprobadas). */
  readonly ordenesAbiertas: number;
}

export interface Subcontratistas {
  readonly hoy: Dia;
  readonly oficios: readonly { id: string; nombre: Nombre; requiereLicencia: boolean }[];
  readonly subcontratistas: readonly Subcontratista[];
}

/** Los subcontratistas de la empresa, los activos primero y por nombre, con sus avisos de papeles. Solo el dueño. */
export async function subcontratistas(tx: Tx, ahora = new Date()): Promise<Subcontratistas> {
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const oficios = await tx<{ id: string; es: string; en: string | null; licencia: boolean }[]>`
    select id, nombre_es as es, nombre_en as en, requiere_licencia as licencia from oficios
    where activo order by nombre_es`;
  const filas = await tx<
    {
      id: string;
      nombre: string;
      oficio_id: string;
      oficio_es: string;
      oficio_en: string | null;
      licencia_req: boolean;
      telefono: string | null;
      contacto: string | null;
      correo: string | null;
      seguro: Dia | null;
      licencia: string | null;
      licencia_vence: Dia | null;
      w9: boolean;
      activo: boolean;
      abiertas: number;
    }[]
  >`
    select s.id, s.nombre, s.oficio_id, o.nombre_es as oficio_es, o.nombre_en as oficio_en,
           o.requiere_licencia as licencia_req, s.telefono, s.contacto, s.correo,
           to_char(s.seguro_vence, 'YYYY-MM-DD') as seguro, s.licencia,
           to_char(s.licencia_vence, 'YYYY-MM-DD') as licencia_vence, s.w9, s.activo,
           (select count(*)::int from ordenes_trabajo ot
            where ot.subcontratista_id = s.id and ot.estado in ('emitida', 'confirmada', 'aprobada')) as abiertas
    from subcontratistas s join oficios o on o.id = s.oficio_id
    order by s.activo desc, lower(s.nombre)`;
  return {
    hoy: s.hoy,
    oficios: oficios.map((o) => ({ id: o.id, nombre: { es: o.es, en: o.en }, requiereLicencia: o.licencia })),
    subcontratistas: filas.map((x) => ({
      id: x.id,
      nombre: x.nombre,
      oficio: {
        id: x.oficio_id,
        nombre: { es: x.oficio_es, en: x.oficio_en },
        requiereLicencia: x.licencia_req,
      },
      telefono: x.telefono,
      contacto: x.contacto,
      correo: x.correo,
      seguroVence: x.seguro,
      licencia: x.licencia,
      licenciaVence: x.licencia_vence,
      w9: x.w9,
      activo: x.activo,
      avisos: revisarPapelesSub(
        {
          seguroVence: x.seguro,
          licencia: x.licencia,
          licenciaVence: x.licencia_vence,
          requiereLicencia: x.licencia_req,
        },
        s.hoy,
      ),
      ordenesAbiertas: x.abiertas,
    })),
  };
}

const EntradaSub = z.object({
  /** Sin id, es un alta. */
  subId: uuid.nullish(),
  nombre: textoCorto.nullish(),
  oficioId: uuid.nullish(),
  telefono: z.string().max(40).nullish(),
  contacto: textoCorto.nullish(),
  correo: z.string().max(200).nullish(),
  seguroVence: dia.nullish(),
  licencia: z.string().max(80).nullish(),
  licenciaVence: dia.nullish(),
  w9: z.boolean().default(false),
});

/**
 * Da de alta o edita un subcontratista. Pide nombre, oficio y teléfono; el nombre no se repite (dos altas del mismo
 * sub parten su historial en dos). Devuelve lo que le falta en papeles, para avisarlo. Errores: `faltan`,
 * `sub_repetido`, `oficio_inexistente`, `registro_no_encontrado`, `solo_dueno`.
 */
export async function guardarSubcontratista(
  tx: Tx,
  entrada: z.input<typeof EntradaSub>,
  ahora = new Date(),
): Promise<{ subId: string; avisos: AvisoPapeles[] }> {
  const e = validarEntrada(EntradaSub, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  exigir([
    [e.nombre, 'nombre'],
    [e.oficioId, 'oficio'],
    [e.telefono, 'telefono'],
  ]);
  const nombre = e.nombre!.trim();
  const [oficio] = await tx<{ licencia: boolean }[]>`
    select requiere_licencia as licencia from oficios where id = ${e.oficioId!} and activo`;
  if (!oficio) throw new ErrorDeNegocio('oficio_inexistente');
  const [otro] = await tx<{ id: string }[]>`
    select id from subcontratistas
    where lower(btrim(nombre)) = lower(${nombre}) and id is distinct from ${e.subId ?? null}`;
  if (otro) throw new ErrorDeNegocio('sub_repetido', { nombre });
  const datos = {
    nombre,
    oficio_id: e.oficioId!,
    telefono: e.telefono!.trim(),
    contacto: e.contacto?.trim() || null,
    correo: e.correo?.trim() || null,
    seguro_vence: e.seguroVence ?? null,
    licencia: e.licencia?.trim() || null,
    licencia_vence: e.licenciaVence ?? null,
    w9: e.w9,
  };
  let subId = e.subId;
  if (subId) {
    const r = await tx`update subcontratistas set ${tx(datos)} where id = ${subId} returning id`;
    if (!r.length) throw new ErrorDeNegocio('registro_no_encontrado');
  } else {
    const [n] = await tx<{ id: string }[]>`
      insert into subcontratistas ${tx({ ...datos, empresa_id: s.empresaId })} returning id`;
    subId = n!.id;
  }
  return {
    subId: subId!,
    avisos: revisarPapelesSub(
      {
        seguroVence: datos.seguro_vence,
        licencia: datos.licencia,
        licenciaVence: datos.licencia_vence,
        requiereLicencia: oficio.licencia,
      },
      s.hoy,
    ),
  };
}

/**
 * Da de baja o reactiva un subcontratista. De baja ya no se le emiten órdenes; las que tiene abiertas siguen, y se
 * dice cuántas son. Errores: `registro_no_encontrado`, `solo_dueno`.
 */
export async function cambiarActivoSub(
  tx: Tx,
  entrada: { subId: string; activo: boolean },
  ahora = new Date(),
): Promise<{ abiertas: number }> {
  const e = validarEntrada(z.object({ subId: uuid, activo: z.boolean() }), entrada);
  exigirDueno(await leerSesion(tx, ahora));
  const r = await tx`update subcontratistas set activo = ${e.activo} where id = ${e.subId} returning id`;
  if (!r.length) throw new ErrorDeNegocio('registro_no_encontrado');
  const [a] = await tx<{ n: number }[]>`
    select count(*)::int as n from ordenes_trabajo
    where subcontratista_id = ${e.subId} and estado in ('emitida', 'confirmada', 'aprobada')`;
  return { abiertas: a!.n };
}
