// Los cobros al cliente de una obra, para el dueño (D-071; legacy: admin/servidor.js duCobro): lo que el cliente ha
// pagado contra su contrato con los cambios aprobados, y lo que falta por cobrar. Se corrigen y anulan con motivo,
// como todo (corregir, anular). Lleva dinero: solo el dueño o el administrador.
import { type Dia, ErrorDeNegocio, exigir } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { dia, textoCorto, uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

export const CONCEPTOS_COBRO = ['deposito', 'hito', 'orden_cambio', 'liquidacion', 'otro'] as const;
export type ConceptoCobro = (typeof CONCEPTOS_COBRO)[number];
/** Cómo paga un cliente: los de la base, menos la tarjeta de la empresa (esa es para comprar). */
export const METODOS_COBRO = ['transferencia', 'cheque', 'zelle', 'efectivo', 'tarjeta'] as const;
export type MetodoCobro = (typeof METODOS_COBRO)[number];

export interface CobroDeObra {
  readonly id: string;
  readonly folio: string;
  readonly fecha: Dia;
  readonly concepto: ConceptoCobro;
  readonly monto: number;
  readonly metodo: string;
  readonly referencia: string | null;
}

export interface CobrosDeObra {
  readonly obra: { id: string; folio: string; cliente: string };
  /** Cerrada (obras_cerradas): ya no se registran cobros. */
  readonly cerrada: boolean;
  /** Entregada: los cobros se registran (la liquidación llega después), pero ya no se corrigen. */
  readonly entregada: boolean;
  readonly contrato: number | null;
  /** Las órdenes de cambio autorizadas o facturadas, por su precio al cliente. */
  readonly cambios: number;
  readonly total: number;
  readonly cobrado: number;
  readonly porCobrar: number;
  readonly cobros: readonly CobroDeObra[];
  readonly hoy: Dia;
}

/** Lo cobrado de una obra contra su contrato con los cambios; null si el dueño no la ve. */
export async function cobrosDeObra(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<CobrosDeObra | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const [obra] = await tx<
    { id: string; folio: string; cliente: string; entregada: boolean; cerrada: boolean }[]
  >`
    select id, folio, cliente, estado = 'entregada' as entregada,
           exists (select 1 from obras_cerradas c where c.obra_id = o.id) as cerrada
    from obras o where id = ${obraId}`;
  if (!obra) return null;
  const [f] = await tx<{ contrato: string }[]>`
    select contrato_original as contrato from obras_finanzas where obra_id = ${obraId}`;
  const [c] = await tx<{ cambios: string }[]>`
    select coalesce(sum(m.precio_cliente), 0) as cambios
    from ordenes_cambio oc join ordenes_cambio_montos m on m.orden_cambio_id = oc.id
    where oc.obra_id = ${obraId} and oc.estado in ('autorizada', 'facturada')`;
  const filas = await tx<(Omit<CobroDeObra, 'monto'> & { monto: string })[]>`
    select id, folio, to_char(fecha, 'YYYY-MM-DD') as fecha, concepto, monto, metodo, referencia
    from cobros where obra_id = ${obraId} and estado = 'vigente'
    order by fecha desc, folio desc`;
  const cobros = filas.map((x) => ({ ...x, monto: Number(x.monto) }));
  const contrato = f ? Number(f.contrato) : null;
  const cambios = Number(c?.cambios ?? 0);
  const total = (contrato ?? 0) + cambios;
  const cobrado = cobros.reduce((a, x) => a + x.monto, 0);
  return {
    obra: { id: obra.id, folio: obra.folio, cliente: obra.cliente },
    cerrada: obra.cerrada,
    entregada: obra.entregada,
    contrato,
    cambios,
    total,
    cobrado,
    porCobrar: total - cobrado,
    cobros,
    hoy: s.hoy,
  };
}

const EntradaCobro = z.object({
  obraId: uuid,
  fecha: dia.nullish(),
  concepto: z.enum(CONCEPTOS_COBRO).nullish(),
  monto: z.number().nullish(),
  metodo: z.enum(METODOS_COBRO).nullish(),
  referencia: textoCorto.nullish(),
});

/**
 * Registra un pago del cliente (legacy: duCobro). Sin fecha, es de hoy; no después de hoy. También en una obra ya
 * entregada (la liquidación suele llegar después), no en una cerrada. Errores: `faltan`, `monto_invalido`,
 * `dia_futuro`, `obra_no_encontrada`, `obra_cerrada`.
 */
export async function registrarCobro(
  tx: Tx,
  entrada: z.input<typeof EntradaCobro>,
  ahora = new Date(),
): Promise<{ cobroId: string; folio: string }> {
  const e = validarEntrada(EntradaCobro, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  exigir([
    [e.monto, 'monto'],
    [e.concepto, 'concepto'],
    [e.metodo, 'metodo'],
  ]);
  if (!(Number(e.monto) > 0)) throw new ErrorDeNegocio('monto_invalido');
  const fecha = e.fecha ?? s.hoy;
  if (fecha > s.hoy) throw new ErrorDeNegocio('dia_futuro');
  const [obra] = await tx<{ cerrada: boolean }[]>`
    select exists (select 1 from obras_cerradas c where c.obra_id = o.id) as cerrada from obras o
    where id = ${e.obraId}`;
  if (!obra) throw new ErrorDeNegocio('obra_no_encontrada');
  if (obra.cerrada) throw new ErrorDeNegocio('obra_cerrada');
  const [c] = await tx<{ id: string; folio: string }[]>`
    insert into cobros (empresa_id, obra_id, fecha, concepto, monto, metodo, referencia)
    values (${s.empresaId}, ${e.obraId}, ${fecha}, ${e.concepto!}, ${Number(e.monto)}, ${e.metodo!},
            ${e.referencia?.trim() || null})
    returning id, folio`;
  return { cobroId: c!.id, folio: c!.folio };
}
