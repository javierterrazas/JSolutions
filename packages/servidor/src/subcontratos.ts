// Los subcontratos de una obra, para el dueño (D-074; legacy: admin/servidor.js duCrearOT, duCancelarOT, duPagoSub):
// emitir órdenes de trabajo con precio cerrado (el compromiso de costo de esa partida; varias del mismo sub de una
// vez, D-091), cancelarlas si no tienen pagos, y pagarle a cada sub siempre contra su orden, con los avisos del legacy.
// Las órdenes se mueven solas con el cierre del día del PM (D-091): llegar las confirma y terminar la partida las
// aprueba. Los pagos se corrigen y anulan con motivo (corregir, anular). Lleva dinero: solo el dueño o el
// administrador.
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
  /** El sub ya llegó (lo marca el cierre del PM). */
  readonly confirmada: boolean;
  /** Su partida se terminó: el trabajo se recibió y se le puede liquidar (D-091). */
  readonly aprobada: boolean;
  /** Si el sub llegó el día de arranque (lo marca el cierre del PM); null si todavía no se sabe. */
  readonly sePresento: boolean | null;
  /** Las veces que no llegó y se reprogramó. */
  readonly faltas: number;
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
      se_presento: boolean | null;
      faltas: number;
      precio: string | null;
    }[]
  >`
    select ot.id, ot.folio, ot.subcontratista_id as sub_id, s.nombre as sub, e.nombre as espacio,
           p.nombre_es as es, p.nombre_en as en, ot.alcance,
           to_char(ot.inicio_programado, 'YYYY-MM-DD') as inicio, to_char(ot.fin_programado, 'YYYY-MM-DD') as fin,
           ot.estado, ot.confirmada_en is not null as confirmada, ot.aprobada_en is not null as aprobada,
           ot.se_presento, ot.faltas, pr.precio
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
      sePresento: o.se_presento,
      faltas: o.faltas,
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

const PartidaDeOrden = z.object({
  partidaId: uuid.nullish(),
  inicio: dia.nullish(),
  fin: dia.nullish(),
  precio: z.number().nullish(),
});

const EntradaOrdenes = z.object({
  obraId: uuid,
  subId: uuid.nullish(),
  alcance: textoLargo.nullish(),
  partidas: z.array(PartidaDeOrden).max(30).default([]),
  confirmado: z.array(z.string().max(40)).max(10).default([]),
});

const EntradaOrden = PartidaDeOrden.extend({
  obraId: uuid,
  subId: uuid.nullish(),
  alcance: textoLargo.nullish(),
  confirmado: z.array(z.string().max(40)).max(10).default([]),
});

export type ResultadoOrdenesTrabajo =
  | { readonly ok: true; readonly ordenes: readonly { ordenId: string; folio: string }[] }
  | { readonly ok: false; readonly confirmar: 'papeles'; readonly avisos: readonly AvisoPapeles[] };

export type ResultadoOrdenTrabajo =
  | { readonly ok: true; readonly ordenId: string; readonly folio: string }
  | { readonly ok: false; readonly confirmar: 'papeles'; readonly avisos: readonly AvisoPapeles[] };

/**
 * Emite de una vez las órdenes de un sub activo, una por partida de la obra, cada una con sus fechas y su precio
 * cerrado y el mismo alcance (D-091). Todas o ninguna. Si al sub le faltan papeles, pide confirmar y no guarda nada.
 * Errores: `faltan`, `fin_antes_del_inicio`, `precio_cerrado`, `obra_no_encontrada`, `obra_cerrada`, `sub_no_activo`,
 * `partida_de_otra_obra`, `partida_repetida`.
 */
export async function emitirOrdenesTrabajo(
  tx: Tx,
  entrada: z.input<typeof EntradaOrdenes>,
  ahora = new Date(),
): Promise<ResultadoOrdenesTrabajo> {
  const e = validarEntrada(EntradaOrdenes, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const obra = await obraAbierta(tx, e.obraId);
  if (!obra) throw new ErrorDeNegocio('obra_no_encontrada');
  if (obra.cerrada) throw new ErrorDeNegocio('obra_cerrada');
  if (!e.partidas.length) throw new ErrorDeNegocio('faltan', { campos: ['partida'] });
  const ids = e.partidas.map((p) => p.partidaId).filter((x): x is string => !!x);
  if (new Set(ids).size !== ids.length) throw new ErrorDeNegocio('partida_repetida');
  const sub = e.subId ? await papelesDe(tx, s, e.subId) : null;
  if (e.subId && !sub?.activo) throw new ErrorDeNegocio('sub_no_activo');
  let confirmar: Extract<ResultadoOrdenesTrabajo, { ok: false }> | null = null;
  for (const p of e.partidas) {
    const r = validarOrdenTrabajo(
      {
        subId: e.subId ?? null,
        partidaId: p.partidaId ?? null,
        alcance: e.alcance ?? null,
        inicio: p.inicio ?? null,
        fin: p.fin ?? null,
        precio: p.precio ?? null,
      },
      sub?.avisos ?? [],
      e.confirmado,
    );
    if (!r.ok) confirmar = r;
  }
  if (confirmar) return confirmar;
  const espacios = new Map(
    (
      await tx<{ id: string; espacio_id: string }[]>`
        select id, espacio_id from partidas_obra where id in ${tx(ids)} and obra_id = ${e.obraId}`
    ).map((x) => [x.id, x.espacio_id]),
  );
  if (espacios.size !== ids.length) throw new ErrorDeNegocio('partida_de_otra_obra');
  const ordenes: { ordenId: string; folio: string }[] = [];
  for (const p of e.partidas) {
    const [ot] = await tx<{ id: string; folio: string }[]>`
      insert into ordenes_trabajo (empresa_id, obra_id, subcontratista_id, espacio_id, partida_obra_id, alcance,
                                   inicio_programado, fin_programado)
      values (${s.empresaId}, ${e.obraId}, ${e.subId!}, ${espacios.get(p.partidaId!)!}, ${p.partidaId!},
              ${e.alcance!.trim()}, ${p.inicio!}, ${p.fin!})
      returning id, folio`;
    await tx`
      insert into ordenes_trabajo_precios (orden_trabajo_id, empresa_id, precio)
      values (${ot!.id}, ${s.empresaId}, ${p.precio!})`;
    ordenes.push({ ordenId: ot!.id, folio: ot!.folio });
  }
  return { ok: true, ordenes };
}

/** Emite una sola orden de trabajo (emitirOrdenesTrabajo con una partida). */
export async function emitirOrdenTrabajo(
  tx: Tx,
  entrada: z.input<typeof EntradaOrden>,
  ahora = new Date(),
): Promise<ResultadoOrdenTrabajo> {
  const { obraId, subId, alcance, confirmado, ...partida } = validarEntrada(EntradaOrden, entrada);
  const r = await emitirOrdenesTrabajo(
    tx,
    { obraId, subId, alcance, confirmado, partidas: [partida] },
    ahora,
  );
  return r.ok ? { ok: true, ...r.ordenes[0]! } : r;
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
      aprobada: boolean;
      precio: string | null;
      pagado: string;
    }[]
  >`
    select ot.obra_id, ot.subcontratista_id as sub_id, ot.estado, ot.aprobada_en is not null as aprobada, pr.precio,
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
    { aprobada: ot.aprobada, precio, pagado },
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

const EntradaReprogramar = z.object({
  ordenId: uuid,
  inicio: dia.nullish(),
  /** Sin fin, la orden es de un solo día. */
  fin: dia.nullish(),
  motivo: z.string().max(2000).nullish(),
});

/**
 * Reprograma una orden cuando el sub no llegó o cambió la fecha (legacy: duReprogramarOT), en vez de cancelarla y
 * emitir otra. Si el sub no llegó, la falta queda contada (alimenta la tasa de presentación de subs); la orden
 * regresa a emitida, sin confirmación ni asistencia, para que el PM marque en su cierre cuándo sí llegue. No una aprobada, pagada o cancelada, ni en una obra cerrada. El cambio de fechas queda en correcciones con
 * su motivo. Errores: `faltan`, `falta_motivo`, `fin_antes_del_inicio`, `registro_no_encontrado`,
 * `orden_no_reprogramable`, `obra_cerrada`, `sin_cambios`.
 */
export async function reprogramarOrdenTrabajo(
  tx: Tx,
  entrada: z.input<typeof EntradaReprogramar>,
  ahora = new Date(),
): Promise<{ faltas: number; falto: boolean }> {
  const e = validarEntrada(EntradaReprogramar, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  exigir([[e.inicio, 'fecha_inicio']]);
  const motivo = e.motivo?.trim() ?? '';
  if (motivo.length < 5) throw new ErrorDeNegocio('falta_motivo');
  const fin = e.fin ?? e.inicio!;
  if (fin < e.inicio!) throw new ErrorDeNegocio('fin_antes_del_inicio');
  const [ot] = await tx<
    {
      obra_id: string;
      estado: string;
      inicio: Dia;
      fin: Dia;
      se_presento: boolean | null;
      faltas: number;
    }[]
  >`
    select obra_id, estado, to_char(inicio_programado, 'YYYY-MM-DD') as inicio,
           to_char(fin_programado, 'YYYY-MM-DD') as fin, se_presento, faltas
    from ordenes_trabajo where id = ${e.ordenId} for update`;
  if (!ot) throw new ErrorDeNegocio('registro_no_encontrado');
  if (!['emitida', 'confirmada'].includes(ot.estado)) throw new ErrorDeNegocio('orden_no_reprogramable');
  if ((await obraAbierta(tx, ot.obra_id))?.cerrada) throw new ErrorDeNegocio('obra_cerrada');
  const falto = ot.se_presento === false;
  const faltas = ot.faltas + (falto ? 1 : 0);
  await tx`
    update ordenes_trabajo
    set inicio_programado = ${e.inicio!}, fin_programado = ${fin}, estado = 'emitida', confirmada_en = null,
        se_presento = null, faltas = ${faltas}
    where id = ${e.ordenId}`;
  const porque = falto ? `${motivo} (el sub no llegó)` : motivo;
  const cambios = [
    { campo: 'inicio_programado', antes: ot.inicio, despues: e.inicio! },
    { campo: 'fin_programado', antes: ot.fin, despues: fin },
  ].filter((c) => c.antes !== c.despues);
  if (!cambios.length) throw new ErrorDeNegocio('sin_cambios');
  await tx`insert into correcciones ${tx(
    cambios.map((c) => ({
      empresa_id: s.empresaId,
      tabla: 'ordenes_trabajo',
      registro_id: e.ordenId,
      accion: 'editar',
      ...c,
      motivo: porque,
    })),
  )}`;
  return { faltas, falto };
}
