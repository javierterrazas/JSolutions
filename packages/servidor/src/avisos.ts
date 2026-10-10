// Avisos (bloqueos) del PM y la respuesta del dueño (fase 2, paso 6c; legacy: pm/servidor.js pmBloqueo;
// admin/servidor.js duResponderBloqueo y la cola de bloqueos del inicio del administrador). Si algo detiene el avance,
// el PM lo levanta con fotos; el dueño se compromete a contestar en las horas de su configuración (SLA).
//
// El aviso lleva una clave de envío (D-050): sin señal va a la cola del teléfono, y un reintento con la misma clave
// recibe el aviso que ya existe. Sus fotos son fotos del aviso (refTipo 'aviso') y van detrás, por la cola.
import { ErrorDeNegocio } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

export const TIPOS_AVISO = ['material', 'cliente', 'sub', 'condicion_oculta', 'diseno', 'otro'] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number];

/** Lo mínimo para que el dueño pueda resolverlo (legacy: 10 letras). */
const LARGO_DESCRIPCION = 10;
/** Una respuesta útil para el PM (legacy: 5 letras). */
const LARGO_RESPUESTA = 5;

const EntradaAviso = z.object({
  obraId: uuid,
  claveEnvio: uuid,
  tipo: z.enum(TIPOS_AVISO).default('otro'),
  descripcion: z.string().nullish(),
  /** Si hay gente parada. El legacy lo da por hecho si no se dice. */
  detiene: z.boolean().default(true),
  /** Cuántas fotos vienen detrás. */
  fotos: z.number().int().min(0).default(0),
});
export type EntradaAviso = z.input<typeof EntradaAviso>;

/**
 * Levanta un aviso en una obra del PM (legacy: pmBloqueo). Errores: `aviso_sin_detalle` (menos de 10 letras),
 * `obra_no_encontrada`.
 */
export async function levantarAviso(
  tx: Tx,
  entrada: EntradaAviso,
  ahora = new Date(),
): Promise<{ avisoId: string; folio: string; slaHoras: number }> {
  const e = validarEntrada(EntradaAviso, entrada);
  const s = await leerSesion(tx, ahora);
  const [cfg] = await tx<{ sla: number }[]>`select sla_bloqueo_horas as sla from configuracion_pm`;
  const slaHoras = cfg?.sla ?? 24;

  // el reintento de uno que ya llegó recibe el mismo
  const [ya] = await tx<
    { id: string; folio: string }[]
  >`select id, folio from avisos where clave_envio = ${e.claveEnvio}`;
  if (ya) return { avisoId: ya.id, folio: ya.folio, slaHoras };

  const descripcion = e.descripcion?.trim() ?? '';
  if (descripcion.length < LARGO_DESCRIPCION) throw new ErrorDeNegocio('aviso_sin_detalle');
  const [obra] = await tx<{ id: string }[]>`
    select id from obras where id = ${e.obraId} and pm_id = ${s.miembroId} and estado <> 'entregada'`;
  if (!obra) throw new ErrorDeNegocio('obra_no_encontrada');
  const [a] = await tx<{ id: string; folio: string }[]>`
    insert into avisos (empresa_id, obra_id, tipo, descripcion, detiene_avance, clave_envio)
    values (${s.empresaId}, ${e.obraId}, ${e.tipo}, ${descripcion}, ${e.detiene}, ${e.claveEnvio})
    returning id, folio`;
  return { avisoId: a!.id, folio: a!.folio, slaHoras };
}

/** El aviso de esa clave de envío, para las fotos de la cola; null si todavía no llega. */
export async function avisoDeClave(tx: Tx, claveEnvio: string): Promise<string | null> {
  const clave = validarEntrada(uuid, claveEnvio);
  const [a] = await tx<{ id: string }[]>`select id from avisos where clave_envio = ${clave}`;
  return a?.id ?? null;
}

// ------------------------------------------------------------------ lo que lee la pantalla del PM

export interface AvisoDelPm {
  readonly id: string;
  readonly folio: string;
  readonly tipo: TipoAviso;
  readonly descripcion: string;
  readonly detiene: boolean;
  readonly creadoEn: string;
  readonly respuesta: string | null;
  readonly respondidoEn: string | null;
}

export interface DatosAviso {
  readonly obra: { id: string; folio: string; cliente: string };
  readonly slaHoras: number;
  /** Sus avisos de esta obra: los abiertos primero, después los contestados más recientes. */
  readonly avisos: readonly AvisoDelPm[];
}

/** La pantalla de avisos de una obra del PM; null si no es suya. RLS le deja ver solo los avisos que él levantó. */
export async function datosParaAviso(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<DatosAviso | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  const [obra] = await tx<{ id: string; folio: string; cliente: string }[]>`
    select id, folio, cliente from obras where id = ${obraId} and pm_id = ${s.miembroId} and estado <> 'entregada'`;
  if (!obra) return null;
  const [cfg] = await tx<{ sla: number }[]>`select sla_bloqueo_horas as sla from configuracion_pm`;
  const avisos = await tx<
    {
      id: string;
      folio: string;
      tipo: TipoAviso;
      descripcion: string;
      detiene_avance: boolean;
      creado_en: Date;
      respuesta: string | null;
      respondido_en: Date | null;
    }[]
  >`
    select id, folio, tipo, descripcion, detiene_avance, creado_en, respuesta, respondido_en from avisos
    where obra_id = ${obraId} and creado_por = ${s.miembroId}
    order by (estado = 'abierto') desc, coalesce(respondido_en, creado_en) desc
    limit 20`;
  return {
    obra,
    slaHoras: cfg?.sla ?? 24,
    avisos: avisos.map((a) => ({
      id: a.id,
      folio: a.folio,
      tipo: a.tipo,
      descripcion: a.descripcion,
      detiene: a.detiene_avance,
      creadoEn: a.creado_en.toISOString(),
      respuesta: a.respuesta,
      respondidoEn: a.respondido_en?.toISOString() ?? null,
    })),
  };
}

// ------------------------------------------------------------------ la respuesta del dueño

export interface AvisoAbierto {
  readonly id: string;
  readonly folio: string;
  readonly obra: { id: string; folio: string; cliente: string };
  readonly pm: string;
  readonly tipo: TipoAviso;
  readonly descripcion: string;
  readonly detiene: boolean;
  readonly creadoEn: string;
  /** Las horas que lleva abierto, y si ya pasó el compromiso de respuesta. */
  readonly horas: number;
  readonly fueraDeSla: boolean;
  readonly fotos: readonly string[];
}

/** Los avisos abiertos de la empresa, los que llevan más tiempo primero (legacy: colaBloqueos). */
export async function avisosAbiertos(tx: Tx, ahora = new Date()): Promise<AvisoAbierto[]> {
  exigirDueno(await leerSesion(tx, ahora));
  const [cfg] = await tx<{ sla: number }[]>`select sla_bloqueo_horas as sla from configuracion`;
  const sla = cfg?.sla ?? 24;
  const filas = await tx<
    {
      id: string;
      folio: string;
      obra_id: string;
      obra_folio: string;
      cliente: string;
      pm: string;
      tipo: TipoAviso;
      descripcion: string;
      detiene_avance: boolean;
      creado_en: Date;
      fotos: string[] | null;
    }[]
  >`
    select a.id, a.folio, o.id as obra_id, o.folio as obra_folio, o.cliente, coalesce(m.nombre, '') as pm, a.tipo,
           a.descripcion, a.detiene_avance, a.creado_en,
           (select array_agg(f.id order by f.indice) from fotos f where f.ref_tipo = 'aviso' and f.ref_id = a.id) as fotos
    from avisos a join obras o on o.id = a.obra_id left join miembros m on m.id = a.creado_por
    where a.estado = 'abierto'
    order by a.creado_en`;
  return filas.map((a) => {
    const horas = Math.floor((ahora.getTime() - a.creado_en.getTime()) / 3_600_000);
    return {
      id: a.id,
      folio: a.folio,
      obra: { id: a.obra_id, folio: a.obra_folio, cliente: a.cliente },
      pm: a.pm,
      tipo: a.tipo,
      descripcion: a.descripcion,
      detiene: a.detiene_avance,
      creadoEn: a.creado_en.toISOString(),
      horas,
      fueraDeSla: horas > sla,
      fotos: a.fotos ?? [],
    };
  });
}

/**
 * El dueño contesta un aviso y lo cierra (legacy: duResponderBloqueo). El PM ve la respuesta en su inicio. Errores:
 * `respuesta_corta` (menos de 5 letras), `registro_no_encontrado` (no existe o ya se contestó).
 */
export async function responderAviso(
  tx: Tx,
  entrada: { avisoId: string; respuesta: string },
  ahora = new Date(),
): Promise<void> {
  const e = validarEntrada(z.object({ avisoId: uuid, respuesta: z.string() }), entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const respuesta = e.respuesta.trim();
  if (respuesta.length < LARGO_RESPUESTA) throw new ErrorDeNegocio('respuesta_corta');
  const r = await tx`
    update avisos set estado = 'cerrado', respuesta = ${respuesta}, respondido_en = ${ahora},
                      respondido_por = ${s.miembroId}
    where id = ${e.avisoId} and estado = 'abierto'`;
  if (!r.count) throw new ErrorDeNegocio('registro_no_encontrado');
}
