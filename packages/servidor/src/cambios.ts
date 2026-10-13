// Las órdenes de cambio de una obra, para el dueño (D-067; legacy: admin/servidor.js duCrearOC y duEstadoOC): las
// emite con el margen mínimo de la empresa (validarOrdenCambio) y ve cómo respondió el cliente, que las aprueba con
// su firma en su portal (D-066). El dueño también registra la respuesta que el cliente le dio en papel. Lleva
// dinero (costo y margen): solo el dueño o el administrador.
import { type Dia, ErrorDeNegocio, validarOrdenCambio } from '@ijm/core';
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
    (Omit<OrdenDeCambio, 'costo' | 'precio' | 'margen' | 'respuesta'> & {
      costo: string;
      precio: string;
      r_decision: 'aprobada' | 'rechazada' | null;
      r_nombre: string | null;
      r_cuando: Date | null;
      r_comentario: string | null;
      r_portal: boolean | null;
      r_firma: string | null;
    })[]
  >`
    select oc.id, oc.folio, oc.motivo, oc.descripcion, to_char(oc.fecha_hallazgo, 'YYYY-MM-DD') as hallazgo,
           oc.dias_impacto as dias, oc.condicion_pago as condicion, oc.estado, oc.emitida_en as emitida,
           m.costo_estimado as costo, m.precio_cliente as precio,
           r.decision as r_decision, r.nombre as r_nombre, r.creado_en as r_cuando, r.comentario as r_comentario,
           r.desde_portal as r_portal, r.firma as r_firma
    from ordenes_cambio oc
    join ordenes_cambio_montos m on m.orden_cambio_id = oc.id
    left join respuestas_cambio r on r.orden_cambio_id = oc.id
    where oc.obra_id = ${obraId}
    order by oc.emitida_en desc, oc.folio desc`;
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
 * legacy) y no guarda nada. Errores: `faltan`, `falta_precio`, `obra_no_encontrada`, `obra_cerrada`,
 * `hallazgo_futuro`.
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

  const [oc] = await tx<{ id: string; folio: string }[]>`
    insert into ordenes_cambio (empresa_id, obra_id, fecha_hallazgo, motivo, descripcion, dias_impacto, condicion_pago)
    values (${s.empresaId}, ${e.obraId}, ${e.hallazgo!}, ${e.motivo!}, ${e.descripcion!.trim()}, ${e.dias},
            ${e.condicion})
    returning id, folio`;
  await tx`
    insert into ordenes_cambio_montos (orden_cambio_id, empresa_id, costo_estimado, precio_cliente)
    values (${oc!.id}, ${s.empresaId}, ${e.costo!}, ${e.precio!})`;
  return { ok: true, ordenId: oc!.id, folio: oc!.folio, margen: r.margen };
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
