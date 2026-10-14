// Los subcontratos de una obra, para el dueño (D-074; legacy: admin/servidor.js duCrearOT, duCancelarOT, duPagoSub):
// emitir órdenes de trabajo con precio cerrado (el compromiso de costo de esa partida), cancelarlas si no tienen
// pagos, y pagarle a cada sub siempre contra su orden, con los avisos del legacy. El PM confirma y aprueba las órdenes
// en su app (ordenes.ts); los pagos se corrigen y anulan con motivo (corregir, anular). Lleva dinero: solo el dueño o
// el administrador.
import {
  type AvisoPagoSub,
  type AvisoPapeles,
  type Dia,
  ErrorDeNegocio,
  exigir,
  revisarPapelesSub,
  validarOrdenTrabajo,
  validarPagoSub,
} from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { dia, textoCorto, textoLargo, uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion, type Sesion } from './sesion';

export const CONCEPTOS_PAGO_SUB = ['anticipo', 'parcial', 'liquidacion'] as const;
export type ConceptoPagoSub = (typeof CONCEPTOS_PAGO_SUB)[number];
/** Cómo se le paga a un sub: los de la base. */
export const METODOS_PAGO_SUB = [
  'transferencia',
  'cheque',
  'zelle',
  'efectivo',
  'tarjeta',
  'tarjeta_empresa',
] as const;

export interface PagoASub {
  readonly id: string;
  readonly folio: string;
  readonly fecha: Dia;
  readonly concepto: ConceptoPagoSub;
  readonly monto: number;
  readonly metodo: string;
  readonly referencia: string | null;
}

export interface OrdenDeTrabajo {
  readonly id: string;
  readonly folio: string;
  readonly sub: { id: string; nombre: string };
  readonly espacio: string;
  readonly partida: Nombre;
  readonly alcance: string;
  readonly inicio: Dia;
  readonly fin: Dia;
  readonly estado: 'emitida' | 'confirmada' | 'aprobada' | 'pagada' | 'cancelada';
  /** El sub la confirmó por escrito (el PM lo anota). */
  readonly confirmada: boolean;
  /** El PM aprobó el trabajo. */
  readonly aprobada: boolean;
  readonly precio: number;
  readonly pagado: number;
  readonly saldo: number;
  readonly pagos: readonly PagoASub[];
}

export interface SubcontratosDeObra {
  readonly obra: { id: string; folio: string; cliente: string };
  /** Entregada o cerrada: ya no se emiten órdenes ni se pagan. */
  readonly cerrada: boolean;
  readonly hoy: Dia;
  /** Los subs activos, para emitirles una orden, con lo que les falta en papeles. */
  readonly subs: readonly { id: string; nombre: string; oficio: Nombre; avisos: readonly AvisoPapeles[] }[];
  readonly espacios: readonly {
    id: string;
    nombre: string;
    partidas: readonly { id: string; nombre: Nombre }[];
  }[];
  readonly ordenes: readonly OrdenDeTrabajo[];
  /** Lo comprometido (las órdenes no canceladas, por su precio), lo pagado y lo que se les debe. */
  readonly comprometido: number;
  readonly pagado: number;
  readonly saldo: number;
}

async function papelesDe(tx: Tx, s: Sesion, subId: string) {
  const [x] = await tx<
    { seguro: Dia | null; licencia: string | null; vence: Dia | null; requiere: boolean; activo: boolean }[]
  >`
    select to_char(s.seguro_vence, 'YYYY-MM-DD') as seguro, s.licencia,
           to_char(s.licencia_vence, 'YYYY-MM-DD') as vence, o.requiere_licencia as requiere, s.activo
    from subcontratistas s join oficios o on o.id = s.oficio_id where s.id = ${subId}`;
  if (!x) return null;
  return {
    activo: x.activo,
    avisos: revisarPapelesSub(
      { seguroVence: x.seguro, licencia: x.licencia, licenciaVence: x.vence, requiereLicencia: x.requiere },
      s.hoy,
    ),
  };
}

async function obraAbierta(
  tx: Tx,
  obraId: string,
): Promise<{ id: string; folio: string; cliente: string; cerrada: boolean } | null> {
  const [o] = await tx<{ id: string; folio: string; cliente: string; cerrada: boolean }[]>`
    select id, folio, cliente,
           estado = 'entregada' or exists (select 1 from obras_cerradas c where c.obra_id = o.id) as cerrada
    from obras o where id = ${obraId}`;
  return o ?? null;
}

/** Las órdenes de trabajo de una obra con lo pagado a cada una; null si el dueño no la ve. */
export async function subcontratosDeObra(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<SubcontratosDeObra | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const obra = await obraAbierta(tx, obraId);
  if (!obra) return null;

  const subs = await tx<
    {
      id: string;
      nombre: string;
      es: string;
      en: string | null;
      seguro: Dia | null;
      licencia: string | null;
      vence: Dia | null;
      requiere: boolean;
    }[]
  >`
    select s.id, s.nombre, o.nombre_es as es, o.nombre_en as en, to_char(s.seguro_vence, 'YYYY-MM-DD') as seguro,
           s.licencia, to_char(s.licencia_vence, 'YYYY-MM-DD') as vence, o.requiere_licencia as requiere
    from subcontratistas s join oficios o on o.id = s.oficio_id where s.activo order by lower(s.nombre)`;
  const espacios = await tx<{ id: string; nombre: string }[]>`
    select id, nombre from espacios where obra_id = ${obraId} order by orden`;
  const partidas = await tx<{ id: string; espacio_id: string; es: string; en: string | null }[]>`
    select id, espacio_id, nombre_es as es, nombre_en as en from partidas_obra
    where obra_id = ${obraId} and estado = 'activa' order by orden, nombre_es`;
  const filas = await tx<
    {
      id: string;
      folio: string;
      sub_id: string;
      sub: string;
      espacio: string;
      es: string;
      en: string | null;
      alcance: string;
      inicio: Dia;
      fin: Dia;
      estado: OrdenDeTrabajo['estado'];
      confirmada: boolean;
      aprobada: boolean;
      precio: string | null;
    }[]
  >`
    select ot.id, ot.folio, ot.subcontratista_id as sub_id, s.nombre as sub, e.nombre as espacio,
           p.nombre_es as es, p.nombre_en as en, ot.alcance,
           to_char(ot.inicio_programado, 'YYYY-MM-DD') as inicio, to_char(ot.fin_programado, 'YYYY-MM-DD') as fin,
           ot.estado, ot.confirmada_en is not null as confirmada, ot.aprobada_en is not null as aprobada, pr.precio
    from ordenes_trabajo ot
    join subcontratistas s on s.id = ot.subcontratista_id
    join espacios e on e.id = ot.espacio_id
    join partidas_obra p on p.id = ot.partida_obra_id
    left join ordenes_trabajo_precios pr on pr.orden_trabajo_id = ot.id
    where ot.obra_id = ${obraId}
    order by ot.estado = 'cancelada', ot.inicio_programado desc, ot.folio desc`;
  const pagos = await tx<(Omit<PagoASub, 'monto'> & { monto: string; orden: string })[]>`
    select id, folio, orden_trabajo_id as orden, to_char(fecha, 'YYYY-MM-DD') as fecha, concepto, monto, metodo,
           referencia
    from pagos_sub where obra_id = ${obraId} and estado = 'vigente'
    order by fecha desc, folio desc`;

  const ordenes = filas.map((o): OrdenDeTrabajo => {
    const suyos = pagos
      .filter((p) => p.orden === o.id)
      .map(({ orden: _, ...p }) => ({ ...p, monto: Number(p.monto) }));
    const precio = Number(o.precio ?? 0);
    const pagado = suyos.reduce((a, p) => a + p.monto, 0);
    return {
      id: o.id,
      folio: o.folio,
      sub: { id: o.sub_id, nombre: o.sub },
      espacio: o.espacio,
      partida: { es: o.es, en: o.en },
      alcance: o.alcance,
      inicio: o.inicio,
      fin: o.fin,
      estado: o.estado,
      confirmada: o.confirmada,
      aprobada: o.aprobada,
      precio,
      pagado,
      saldo: precio - pagado,
      pagos: suyos,
    };
  });
  const vigentes = ordenes.filter((o) => o.estado !== 'cancelada');
  const comprometido = vigentes.reduce((a, o) => a + o.precio, 0);
  const pagado = ordenes.reduce((a, o) => a + o.pagado, 0);
  return {
    obra: { id: obra.id, folio: obra.folio, cliente: obra.cliente },
    cerrada: obra.cerrada,
    hoy: s.hoy,
    subs: subs.map((x) => ({
      id: x.id,
      nombre: x.nombre,
      oficio: { es: x.es, en: x.en },
      avisos: revisarPapelesSub(
        { seguroVence: x.seguro, licencia: x.licencia, licenciaVence: x.vence, requiereLicencia: x.requiere },
        s.hoy,
      ),
    })),
    espacios: espacios
      .map((e) => ({
        id: e.id,
        nombre: e.nombre,
        partidas: partidas
          .filter((p) => p.espacio_id === e.id)
          .map((p) => ({ id: p.id, nombre: { es: p.es, en: p.en } })),
      }))
      .filter((e) => e.partidas.length),
    ordenes,
    comprometido,
    pagado,
    saldo: comprometido - pagado,
  };
}

const EntradaOrden = z.object({
  obraId: uuid,
  subId: uuid.nullish(),
  partidaId: uuid.nullish(),
  alcance: textoLargo.nullish(),
  inicio: dia.nullish(),
  fin: dia.nullish(),
  precio: z.number().nullish(),
  confirmado: z.array(z.string().max(40)).max(10).default([]),
});

export type ResultadoOrdenTrabajo =
  | { readonly ok: true; readonly ordenId: string; readonly folio: string }
  | { readonly ok: false; readonly confirmar: 'papeles'; readonly avisos: readonly AvisoPapeles[] };

/**
 * Emite una orden de trabajo a un sub activo, por una partida de la obra, con precio cerrado. Si al sub le faltan
 * papeles, pide confirmar y no guarda nada. Errores: `faltan`, `fin_antes_del_inicio`, `precio_cerrado`,
 * `obra_no_encontrada`, `obra_cerrada`, `sub_no_activo`, `partida_de_otra_obra`.
 */
export async function emitirOrdenTrabajo(
  tx: Tx,
  entrada: z.input<typeof EntradaOrden>,
  ahora = new Date(),
): Promise<ResultadoOrdenTrabajo> {
  const e = validarEntrada(EntradaOrden, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const obra = await obraAbierta(tx, e.obraId);
  if (!obra) throw new ErrorDeNegocio('obra_no_encontrada');
  if (obra.cerrada) throw new ErrorDeNegocio('obra_cerrada');
  const sub = e.subId ? await papelesDe(tx, s, e.subId) : null;
  if (e.subId && !sub?.activo) throw new ErrorDeNegocio('sub_no_activo');
  const r = validarOrdenTrabajo(
    {
      subId: e.subId ?? null,
      partidaId: e.partidaId ?? null,
      alcance: e.alcance ?? null,
      inicio: e.inicio ?? null,
      fin: e.fin ?? null,
      precio: e.precio ?? null,
    },
    sub?.avisos ?? [],
    e.confirmado,
  );
  if (!r.ok) return r;
  const [p] = await tx<{ espacio_id: string }[]>`
    select espacio_id from partidas_obra where id = ${e.partidaId!} and obra_id = ${e.obraId}`;
  if (!p) throw new ErrorDeNegocio('partida_de_otra_obra');
  const [ot] = await tx<{ id: string; folio: string }[]>`
    insert into ordenes_trabajo (empresa_id, obra_id, subcontratista_id, espacio_id, partida_obra_id, alcance,
                                 inicio_programado, fin_programado)
    values (${s.empresaId}, ${e.obraId}, ${e.subId!}, ${p.espacio_id}, ${e.partidaId!}, ${e.alcance!.trim()},
            ${e.inicio!}, ${e.fin!})
    returning id, folio`;
  await tx`
    insert into ordenes_trabajo_precios (orden_trabajo_id, empresa_id, precio)
    values (${ot!.id}, ${s.empresaId}, ${e.precio!})`;
  return { ok: true, ordenId: ot!.id, folio: ot!.folio };
}

/**
 * Cancela una orden: deja de contar como costo comprometido. No una con pagos (se ajusta el alcance en vez de
 * cancelarla), ni una pagada. Errores: `registro_no_encontrado`, `orden_con_pagos`, `orden_no_cancelable`.
 */
export async function cancelarOrdenTrabajo(
  tx: Tx,
  entrada: { ordenId: string },
  ahora = new Date(),
): Promise<void> {
  const { ordenId } = validarEntrada(z.object({ ordenId: uuid }), entrada);
  exigirDueno(await leerSesion(tx, ahora));
  const [ot] = await tx<{ estado: string; pagos: number }[]>`
    select estado, (select count(*)::int from pagos_sub p where p.orden_trabajo_id = ot.id and p.estado = 'vigente')
             as pagos
    from ordenes_trabajo ot where id = ${ordenId}`;
  if (!ot) throw new ErrorDeNegocio('registro_no_encontrado');
  if (ot.pagos) throw new ErrorDeNegocio('orden_con_pagos');
  if (ot.estado === 'pagada' || ot.estado === 'cancelada') throw new ErrorDeNegocio('orden_no_cancelable');
  await tx`update ordenes_trabajo set estado = 'cancelada' where id = ${ordenId}`;
}

const EntradaPago = z.object({
  ordenId: uuid,
  fecha: dia.nullish(),
  concepto: z.enum(CONCEPTOS_PAGO_SUB).nullish(),
  monto: z.number().nullish(),
  metodo: z.enum(METODOS_PAGO_SUB).default('transferencia'),
  referencia: textoCorto.nullish(),
  confirmado: z.array(z.string().max(40)).max(10).default([]),
});

export type ResultadoPagoSub =
  | { readonly ok: true; readonly pagoId: string; readonly folio: string; readonly saldo: number }
  | { readonly ok: false; readonly confirmar: AvisoPagoSub; readonly total?: number };

/**
 * Le paga a un sub contra su orden (sin fecha, es de hoy; no después de hoy). Con los avisos del legacy, que se
 * confirman uno por uno (validarPagoSub). Con lo pagado igual al precio, la orden queda pagada. Errores: `faltan`,
 * `monto_invalido`, `dia_futuro`, `registro_no_encontrado`, `orden_cancelada`, `obra_cerrada`.
 */
export async function registrarPagoSub(
  tx: Tx,
  entrada: z.input<typeof EntradaPago>,
  ahora = new Date(),
): Promise<ResultadoPagoSub> {
  const e = validarEntrada(EntradaPago, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  exigir([
    [e.monto, 'monto'],
    [e.concepto, 'concepto'],
  ]);
  const fecha = e.fecha ?? s.hoy;
  if (fecha > s.hoy) throw new ErrorDeNegocio('dia_futuro');
  const [ot] = await tx<
    {
      obra_id: string;
      sub_id: string;
      estado: string;
      confirmada: boolean;
      aprobada: boolean;
      precio: string | null;
      pagado: string;
    }[]
  >`
    select ot.obra_id, ot.subcontratista_id as sub_id, ot.estado, ot.confirmada_en is not null as confirmada,
           ot.aprobada_en is not null as aprobada, pr.precio,
           (select coalesce(sum(p.monto), 0) from pagos_sub p where p.orden_trabajo_id = ot.id and p.estado = 'vigente')
             as pagado
    from ordenes_trabajo ot left join ordenes_trabajo_precios pr on pr.orden_trabajo_id = ot.id
    where ot.id = ${e.ordenId} for update of ot`;
  if (!ot) throw new ErrorDeNegocio('registro_no_encontrado');
  if (ot.estado === 'cancelada') throw new ErrorDeNegocio('orden_cancelada');
  const obra = await obraAbierta(tx, ot.obra_id);
  if (obra?.cerrada) throw new ErrorDeNegocio('obra_cerrada');
  const papeles = (await papelesDe(tx, s, ot.sub_id))?.avisos ?? [];
  const precio = Number(ot.precio ?? 0);
  const pagado = Number(ot.pagado);
  const r = validarPagoSub(
    { monto: e.monto ?? null, concepto: e.concepto! },
    { confirmada: ot.confirmada, aprobada: ot.aprobada, precio, pagado },
    papeles,
    e.confirmado,
  );
  if (!r.ok) return r;
  const [pago] = await tx<{ id: string; folio: string }[]>`
    insert into pagos_sub (empresa_id, obra_id, orden_trabajo_id, fecha, concepto, monto, metodo, referencia)
    values (${s.empresaId}, ${ot.obra_id}, ${e.ordenId}, ${fecha}, ${e.concepto!}, ${Number(e.monto)}, ${e.metodo},
            ${e.referencia?.trim() || null})
    returning id, folio`;
  if (r.liquida) await tx`update ordenes_trabajo set estado = 'pagada' where id = ${e.ordenId}`;
  return { ok: true, pagoId: pago!.id, folio: pago!.folio, saldo: precio - pagado - Number(e.monto) };
}
