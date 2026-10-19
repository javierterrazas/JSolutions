// Las órdenes de cambio de una obra, para el dueño (D-067; legacy: admin/servidor.js duCrearOC y duEstadoOC): las
// emite con el margen mínimo de la empresa (validarOrdenCambio) y ve cómo respondió el cliente, que las aprueba con
// su firma en su portal (D-066). El dueño también registra la respuesta que el cliente le dio en papel. Lleva
// dinero (costo y margen): solo el dueño o el administrador.
//
// D-103: una orden puede salir de un aviso del PM (queda ligada y el aviso se contesta solo), y mientras el cliente no
// responda el dueño la puede editar, para describirla bien después de hablar con él.
import { type Dia, ErrorDeNegocio, validarOrdenCambio } from '@ijm/core';
import postgres from 'postgres';
import { z } from 'zod';
import type { Tx } from './conexion';
import { dia, textoCorto, textoLargo, uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

export const MOTIVOS_CAMBIO = ['condicion_oculta', 'solicitud_cliente', 'cambio_seleccion'] as const;
export type MotivoCambio = (typeof MOTIVOS_CAMBIO)[number];
/** Las condiciones de pago del legacy; se guardan como clave y cada pantalla las traduce. */
export const CONDICIONES_PAGO = [
  'al_autorizar',
  'mitad_al_autorizar',
  'siguiente_hito',
  'contra_entrega',
] as const;

export interface RespuestaDeCambio {
  readonly decision: 'aprobada' | 'rechazada';
  readonly nombre: string;
  readonly cuando: Date;
  readonly comentario: string | null;
  /** Desde el portal, con su firma; si no, la registró el dueño (firmada en papel). */
  readonly desdePortal: boolean;
  readonly firma: string | null;
}

export interface OrdenDeCambio {
  readonly id: string;
  readonly folio: string;
  readonly motivo: MotivoCambio;
  readonly descripcion: string;
  readonly hallazgo: Dia;
  readonly dias: number;
  readonly condicion: string | null;
  readonly estado: 'propuesta' | 'autorizada' | 'rechazada' | 'facturada';
  readonly emitida: Date;
  readonly costo: number;
  readonly precio: number;
  readonly margen: number;
  readonly respuesta: RespuestaDeCambio | null;
  /** Si ya se hizo (D-081): cuándo, quién lo marcó, su nota y sus fotos. */
  readonly hecho: CambioHecho | null;
  /** El aviso del PM del que salió (D-103), con sus fotos. */
  readonly aviso: AvisoDeLaOrden | null;
}

export interface AvisoDeLaOrden {
  readonly id: string;
  readonly folio: string;
  readonly tipo: string;
  readonly descripcion: string;
  /** El día en que el PM lo levantó, en la zona de la empresa. */
  readonly dia: Dia;
  readonly pm: string | null;
  readonly fotos: readonly string[];
}

export interface CambioHecho {
  readonly cuando: Date;
  readonly por: string | null;
  readonly nota: string | null;
  readonly fotos: readonly string[];
}

export interface CambiosDeObra {
  readonly obra: { id: string; folio: string; cliente: string; estado: string };
  readonly contrato: number | null;
  readonly margenMinimo: number;
  /** Lo que suman las autorizadas y facturadas. */
  readonly autorizado: number;
  readonly ordenes: readonly OrdenDeCambio[];
  /** Hoy en la zona de la empresa, para la fecha del hallazgo. */
  readonly hoy: Dia;
}

/** Las órdenes de cambio de una obra, la más nueva primero; null si el dueño no la ve. */
export async function cambiosDeObra(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<CambiosDeObra | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const [obra] = await tx<CambiosDeObra['obra'][]>`
    select id, folio, cliente, estado from obras where id = ${obraId}`;
  if (!obra) return null;
  const [f] = await tx<{ contrato: string }[]>`
    select contrato_original as contrato from obras_finanzas where obra_id = ${obraId}`;
  const [c] = await tx<{ minimo: string }[]>`select margen_minimo_oc as minimo from configuracion`;
  const filas = await tx<
    (Omit<OrdenDeCambio, 'costo' | 'precio' | 'margen' | 'respuesta' | 'hecho' | 'aviso'> & {
      costo: string;
      precio: string;
      r_decision: 'aprobada' | 'rechazada' | null;
      r_nombre: string | null;
      r_cuando: Date | null;
      r_comentario: string | null;
      r_portal: boolean | null;
      r_firma: string | null;
      h_cuando: Date | null;
      h_por: string | null;
      h_nota: string | null;
      h_fotos: string[] | null;
      aviso_id: string | null;
    })[]
  >`
    select oc.id, oc.folio, oc.motivo, oc.descripcion, to_char(oc.fecha_hallazgo, 'YYYY-MM-DD') as hallazgo,
           oc.dias_impacto as dias, oc.condicion_pago as condicion, oc.estado, oc.emitida_en as emitida,
           m.costo_estimado as costo, m.precio_cliente as precio,
           r.decision as r_decision, r.nombre as r_nombre, r.creado_en as r_cuando, r.comentario as r_comentario,
           r.desde_portal as r_portal, r.firma as r_firma,
           h.creado_en as h_cuando, mh.nombre as h_por, h.nota as h_nota,
           (select array_agg(f.id::text order by f.indice) from fotos f
            where f.ref_tipo = 'cambio_hecho' and f.ref_id = h.id) as h_fotos,
           oc.aviso_id
    from ordenes_cambio oc
    join ordenes_cambio_montos m on m.orden_cambio_id = oc.id
    left join respuestas_cambio r on r.orden_cambio_id = oc.id
    left join cambios_hechos h on h.orden_cambio_id = oc.id
    left join miembros mh on mh.id = h.creado_por
    where oc.obra_id = ${obraId}
    order by oc.emitida_en desc, oc.folio desc`;
  const avisos = await avisosDeOrdenes(
    tx,
    filas.flatMap((o) => (o.aviso_id ? [o.aviso_id] : [])),
    s.zona,
  );
  const ordenes = filas.map((o): OrdenDeCambio => {
    const costo = Number(o.costo);
    const precio = Number(o.precio);
    return {
      id: o.id,
      folio: o.folio,
      motivo: o.motivo,
      descripcion: o.descripcion,
      hallazgo: o.hallazgo,
      dias: o.dias,
      condicion: o.condicion,
      estado: o.estado,
      emitida: o.emitida,
      costo,
      precio,
      margen: 1 - costo / precio,
      respuesta: o.r_decision
        ? {
            decision: o.r_decision,
            nombre: o.r_nombre!,
            cuando: o.r_cuando!,
            comentario: o.r_comentario,
            desdePortal: o.r_portal!,
            firma: o.r_firma,
          }
        : null,
      hecho: o.h_cuando ? { cuando: o.h_cuando, por: o.h_por, nota: o.h_nota, fotos: o.h_fotos ?? [] } : null,
      aviso: (o.aviso_id && avisos.get(o.aviso_id)) || null,
    };
  });
  return {
    obra,
    contrato: f ? Number(f.contrato) : null,
    margenMinimo: Number(c?.minimo ?? 0.35),
    autorizado: ordenes
      .filter((o) => o.estado === 'autorizada' || o.estado === 'facturada')
      .reduce((a, o) => a + o.precio, 0),
    ordenes,
    hoy: s.hoy,
  };
}

/** Los avisos de esos ids, con sus fotos y el día en que se levantaron. */
async function avisosDeOrdenes(
  tx: Tx,
  ids: readonly string[],
  zona: string,
): Promise<Map<string, AvisoDeLaOrden>> {
  if (!ids.length) return new Map();
  const filas = await tx<(Omit<AvisoDeLaOrden, 'fotos'> & { fotos: string[] | null })[]>`
    select a.id, a.folio, a.tipo, a.descripcion, to_char((a.creado_en at time zone ${zona})::date, 'YYYY-MM-DD') as dia,
           m.nombre as pm,
           (select array_agg(f.id::text order by f.indice) from fotos f
            where f.ref_tipo = 'aviso' and f.ref_id = a.id) as fotos
    from avisos a left join miembros m on m.id = a.creado_por
    where a.id in ${tx([...ids])}`;
  return new Map(filas.map((a) => [a.id, { ...a, fotos: a.fotos ?? [] }]));
}

/** El motivo de la orden que corresponde al tipo de aviso; los demás los elige el dueño. */
const MOTIVO_DEL_AVISO: Partial<Record<string, MotivoCambio>> = {
  condicion_oculta: 'condicion_oculta',
  cliente: 'solicitud_cliente',
  diseno: 'cambio_seleccion',
};

/**
 * Un aviso del PM para empezar una orden de cambio desde él (D-103): su texto, su día y sus fotos, y el motivo que le
 * corresponde. Null si no existe o no es de esa obra.
 */
export async function avisoParaOrden(
  tx: Tx,
  entrada: { obraId: string; avisoId: string },
  ahora = new Date(),
): Promise<(AvisoDeLaOrden & { motivo: MotivoCambio | null; abierto: boolean }) | null> {
  const e = validarEntrada(z.object({ obraId: uuid, avisoId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const [a] = await tx<{ abierto: boolean }[]>`
    select estado = 'abierto' as abierto from avisos where id = ${e.avisoId} and obra_id = ${e.obraId}`;
  if (!a) return null;
  const aviso = (await avisosDeOrdenes(tx, [e.avisoId], s.zona)).get(e.avisoId)!;
  return { ...aviso, motivo: MOTIVO_DEL_AVISO[aviso.tipo] ?? null, abierto: a.abierto };
}

const EntradaOrden = z.object({
  obraId: uuid,
  motivo: z.enum(MOTIVOS_CAMBIO).nullish(),
  descripcion: textoLargo.nullish(),
  hallazgo: dia.nullish(),
  costo: z.number().nonnegative().nullish(),
  precio: z.number().nonnegative().nullish(),
  dias: z.number().int().min(0).max(365).default(0),
  condicion: z.enum(CONDICIONES_PAGO).default('al_autorizar'),
  forzar: z.boolean().default(false),
  /** El aviso del PM del que sale (D-103). */
  avisoId: uuid.nullish(),
  /** Lo que se le contesta al PM en ese aviso, si sigue abierto; `{folio}` se cambia por el de la orden. */
  respuestaAviso: z.string().trim().min(5).max(1000).nullish(),
});

export type ResultadoOrdenDeCambio =
  | { readonly ok: true; readonly ordenId: string; readonly folio: string; readonly margen: number }
  | {
      readonly ok: false;
      readonly confirmar: 'margen_bajo';
      readonly margen: number;
      readonly minimo: number;
      readonly sugerido: number;
    };

/**
 * Emite una orden de cambio, por aprobar. Si el precio deja menos del margen mínimo, pide confirmar (como el
 * legacy) y no guarda nada. Si sale de un aviso del PM, queda ligada a él y, si el aviso sigue abierto, se contesta
 * con `respuestaAviso` y se cierra (D-103). Errores: `faltan`, `falta_precio`, `obra_no_encontrada`, `obra_cerrada`,
 * `hallazgo_futuro`, `registro_no_encontrado` (el aviso no es de esa obra).
 */
export async function crearOrdenCambio(
  tx: Tx,
  entrada: z.input<typeof EntradaOrden>,
  ahora = new Date(),
): Promise<ResultadoOrdenDeCambio> {
  const e = validarEntrada(EntradaOrden, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const [obra] = await tx<{ estado: string }[]>`select estado from obras where id = ${e.obraId}`;
  if (!obra) throw new ErrorDeNegocio('obra_no_encontrada');
  if (obra.estado === 'entregada') throw new ErrorDeNegocio('obra_cerrada');
  const [c] = await tx<{ minimo: string }[]>`select margen_minimo_oc as minimo from configuracion`;
  const r = validarOrdenCambio(
    {
      motivo: e.motivo ?? null,
      descripcion: e.descripcion ?? null,
      hallazgo: e.hallazgo ?? null,
      costo: e.costo ?? null,
      precio: e.precio ?? null,
      forzar: e.forzar,
    },
    Number(c?.minimo ?? 0.35),
  );
  if (!r.ok) return r;
  if (e.hallazgo! > s.hoy) throw new ErrorDeNegocio('hallazgo_futuro');
  if (e.avisoId) {
    const [a] = await tx`select 1 from avisos where id = ${e.avisoId} and obra_id = ${e.obraId}`;
    if (!a) throw new ErrorDeNegocio('registro_no_encontrado');
  }

  const [oc] = await tx<{ id: string; folio: string }[]>`
    insert into ordenes_cambio (empresa_id, obra_id, fecha_hallazgo, motivo, descripcion, dias_impacto, condicion_pago,
                                aviso_id)
    values (${s.empresaId}, ${e.obraId}, ${e.hallazgo!}, ${e.motivo!}, ${e.descripcion!.trim()}, ${e.dias},
            ${e.condicion}, ${e.avisoId ?? null})
    returning id, folio`;
  await tx`
    insert into ordenes_cambio_montos (orden_cambio_id, empresa_id, costo_estimado, precio_cliente)
    values (${oc!.id}, ${s.empresaId}, ${e.costo!}, ${e.precio!})`;
  if (e.avisoId && e.respuestaAviso)
    await tx`
      update avisos set estado = 'cerrado', respuesta = ${e.respuestaAviso.replaceAll('{folio}', oc!.folio)},
                        respondido_en = ${ahora}, respondido_por = ${s.miembroId}
      where id = ${e.avisoId} and estado = 'abierto'`;
  return { ok: true, ordenId: oc!.id, folio: oc!.folio, margen: r.margen };
}

const EntradaEdicion = EntradaOrden.omit({ obraId: true, avisoId: true, respuestaAviso: true }).extend({
  ordenId: uuid,
});

/**
 * Corrige una orden de cambio que el cliente todavía no responde (D-103): el dueño la describe mejor después de
 * hablar con él, o ajusta el precio. Las mismas reglas que al emitirla (margen mínimo, hallazgo). Respondida, ya no
 * cambia: lo que el cliente firmó es lo que queda. Errores: `orden_no_encontrada`, `orden_ya_respondida`, `faltan`,
 * `falta_precio`, `obra_cerrada`, `hallazgo_futuro`.
 */
export async function editarOrdenCambio(
  tx: Tx,
  entrada: z.input<typeof EntradaEdicion>,
  ahora = new Date(),
): Promise<ResultadoOrdenDeCambio> {
  const e = validarEntrada(EntradaEdicion, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const [oc] = await tx<{ folio: string; estado: string; obra: string; respondida: boolean }[]>`
    select oc.folio, oc.estado, o.estado as obra,
           exists (select 1 from respuestas_cambio r where r.orden_cambio_id = oc.id) as respondida
    from ordenes_cambio oc join obras o on o.id = oc.obra_id
    where oc.id = ${e.ordenId} for update of oc`;
  if (!oc) throw new ErrorDeNegocio('orden_no_encontrada');
  if (oc.estado !== 'propuesta' || oc.respondida) throw new ErrorDeNegocio('orden_ya_respondida');
  if (oc.obra === 'entregada') throw new ErrorDeNegocio('obra_cerrada');
  const [c] = await tx<{ minimo: string }[]>`select margen_minimo_oc as minimo from configuracion`;
  const r = validarOrdenCambio(
    {
      motivo: e.motivo ?? null,
      descripcion: e.descripcion ?? null,
      hallazgo: e.hallazgo ?? null,
      costo: e.costo ?? null,
      precio: e.precio ?? null,
      forzar: e.forzar,
    },
    Number(c?.minimo ?? 0.35),
  );
  if (!r.ok) return r;
  if (e.hallazgo! > s.hoy) throw new ErrorDeNegocio('hallazgo_futuro');
  await tx`
    update ordenes_cambio
    set motivo = ${e.motivo!}, descripcion = ${e.descripcion!.trim()}, fecha_hallazgo = ${e.hallazgo!},
        dias_impacto = ${e.dias}, condicion_pago = ${e.condicion}
    where id = ${e.ordenId}`;
  await tx`
    update ordenes_cambio_montos
    set costo_estimado = ${e.costo!}, precio_cliente = ${e.precio!}
    where orden_cambio_id = ${e.ordenId}`;
  return { ok: true, ordenId: e.ordenId, folio: oc.folio, margen: r.margen };
}

const EntradaRespuesta = z.object({
  ordenId: uuid,
  decision: z.enum(['aprobada', 'rechazada']),
  nombre: z.string().max(120).nullish(),
  comentario: textoCorto.nullish(),
});

/**
 * El dueño registra la respuesta que el cliente le dio fuera del portal (firmada en papel, por correo): aprobada,
 * la orden queda autorizada; no aprobada, rechazada. Errores: `orden_no_encontrada`, `orden_ya_respondida`,
 * `falta_nombre`.
 */
export async function responderCambioDueno(
  tx: Tx,
  entrada: z.input<typeof EntradaRespuesta>,
  ahora = new Date(),
): Promise<void> {
  const e = validarEntrada(EntradaRespuesta, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const [oc] = await tx<{ obra_id: string; estado: string; respondida: boolean }[]>`
    select obra_id, estado, exists (select 1 from respuestas_cambio r where r.orden_cambio_id = oc.id) as respondida
    from ordenes_cambio oc where id = ${e.ordenId} for update`;
  if (!oc) throw new ErrorDeNegocio('orden_no_encontrada');
  if (oc.estado !== 'propuesta' || oc.respondida) throw new ErrorDeNegocio('orden_ya_respondida');
  const nombre = e.nombre?.trim();
  if (!nombre) throw new ErrorDeNegocio('falta_nombre');
  await tx`
    insert into respuestas_cambio (empresa_id, obra_id, orden_cambio_id, decision, nombre, comentario, desde_portal)
    values (${s.empresaId}, ${oc.obra_id}, ${e.ordenId}, ${e.decision}, ${nombre}, ${e.comentario?.trim() || null},
            false)`;
  await tx`
    update ordenes_cambio
    set estado = ${e.decision === 'aprobada' ? 'autorizada' : 'rechazada'},
        autorizada_en = ${e.decision === 'aprobada' ? ahora : null}
    where id = ${e.ordenId}`;
}

/**
 * Marca hecha una orden de cambio que el cliente aprobó (D-081): el PM de la obra desde su inicio, o el dueño. Una
 * vez por orden. Devuelve el registro, para colgarle la foto. Errores: `orden_no_encontrada` (no existe o no la ve),
 * `cambio_no_autorizado` (el cliente no la ha aprobado), `cambio_ya_hecho`.
 */
export async function marcarCambioHecho(
  tx: Tx,
  entrada: { ordenId: string; nota?: string | null },
  ahora = new Date(),
): Promise<{ cambioHechoId: string; obraId: string }> {
  const e = validarEntrada(z.object({ ordenId: uuid, nota: z.string().trim().max(500).nullish() }), entrada);
  const s = await leerSesion(tx, ahora);
  // el PM no lee ordenes_cambio: ve las autorizadas de sus obras por su vista
  const [o] = s.esDuenoOAdmin
    ? await tx<{ obra_id: string }[]>`select obra_id from ordenes_cambio where id = ${e.ordenId}`
    : await tx<{ obra_id: string }[]>`select obra_id from ordenes_cambio_pm where id = ${e.ordenId}`;
  if (!o) throw new ErrorDeNegocio('orden_no_encontrada');
  try {
    const [h] = await tx.savepoint(
      (sp) => sp<{ id: string }[]>`
        insert into cambios_hechos (empresa_id, obra_id, orden_cambio_id, nota, creado_por)
        values (${s.empresaId}, ${o.obra_id}, ${e.ordenId}, ${e.nota || null}, ${s.miembroId})
        returning id`,
    );
    return { cambioHechoId: h!.id, obraId: o.obra_id };
  } catch (err) {
    if (err instanceof postgres.PostgresError) {
      if (err.code === '23505') throw new ErrorDeNegocio('cambio_ya_hecho');
      if (err.code === 'P0001' && err.message === 'cambio_no_autorizado')
        throw new ErrorDeNegocio(err.message);
    }
    throw err;
  }
}
