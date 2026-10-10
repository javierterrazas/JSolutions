// El recorrido de entrega y la medida verificada (fase 2, paso 6e; legacy: pm/servidor.js pmPunch, pmCerrarPunch,
// pmMedida y la pantalla de entrega de PM.html).
//   · Punch list: se anota TODO lo que señala el cliente, sin discutir nada en el momento; la clasificación se hace
//     después. Cada detalle tiene 7 días hábiles para corregirse. Su foto es una foto del punch (refTipo 'punch').
//   · Medida verificada (D-014): los pies² reales del espacio, medidos en sitio. Se guardan aparte de los cotizados,
//     con quién y cuándo, y dejan rastro en correcciones. Los costos unitarios usan la verificada.
import { type Dia, ErrorDeNegocio, sumarLaborables } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { uuid, validarEntrada } from './entrada';
import { leerSesion, type Sesion } from './sesion';

export const ORIGENES_PUNCH = ['defecto', 'cambio_alcance', 'expectativa'] as const;
export type OrigenPunch = (typeof ORIGENES_PUNCH)[number];

/** Los días hábiles para corregir un detalle del punch list (legacy: masDiasHabiles_(7)). */
export const DIAS_PARA_CORREGIR_PUNCH = 7;
/** Lo mínimo para saber qué señaló el cliente (legacy: 4 letras). */
const LARGO_ITEM = 4;

async function obraDelPm(tx: Tx, s: Sesion, obraId: string) {
  const [o] = await tx<{ id: string; folio: string; cliente: string }[]>`
    select id, folio, cliente from obras where id = ${obraId} and pm_id = ${s.miembroId} and estado <> 'entregada'`;
  if (!o) throw new ErrorDeNegocio('obra_no_encontrada');
  return o;
}

// ------------------------------------------------------------------ lo que lee la pantalla

export interface DetallePunch {
  readonly id: string;
  readonly folio: string;
  readonly item: string;
  readonly origen: OrigenPunch;
  readonly responsable: string | null;
  readonly compromiso: Dia;
  readonly vencido: boolean;
  readonly cerradoEn: string | null;
}

export interface MedidaEspacio {
  readonly id: string;
  readonly nombre: string;
  readonly pies2Cotizados: number;
  readonly piesLinealesCotizados: number;
  /** La verificada en sitio, si ya se midió. */
  readonly pies2Verificados: number | null;
  readonly piesLinealesVerificados: number | null;
  readonly verificadoEn: string | null;
}

export interface DatosEntrega {
  readonly obra: { id: string; folio: string; cliente: string };
  readonly abiertos: readonly DetallePunch[];
  readonly cerrados: readonly DetallePunch[];
  /** Los espacios de la obra, sin Generales de obra. */
  readonly medidas: readonly MedidaEspacio[];
}

/** La pantalla de entrega de una obra del PM: su punch list y las medidas; null si la obra no es suya. */
export async function datosParaEntrega(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<DatosEntrega | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  const obra = await obraDelPm(tx, s, obraId).catch(() => null);
  if (!obra) return null;
  const punch = await tx<
    {
      id: string;
      folio: string;
      item: string;
      origen: OrigenPunch;
      responsable: string | null;
      compromiso: Dia;
      estado: 'abierto' | 'cerrado';
      cerrado_en: Date | null;
    }[]
  >`
    select id, folio, item, origen, responsable, to_char(fecha_compromiso, 'YYYY-MM-DD') as compromiso, estado,
           cerrado_en
    from punch_list where obra_id = ${obraId} order by fecha_compromiso, creado_en`;
  const detalle = (p: (typeof punch)[number]): DetallePunch => ({
    id: p.id,
    folio: p.folio,
    item: p.item,
    origen: p.origen,
    responsable: p.responsable,
    compromiso: p.compromiso,
    vencido: p.estado === 'abierto' && p.compromiso < s.hoy,
    cerradoEn: p.cerrado_en?.toISOString() ?? null,
  });
  const medidas = await tx<
    {
      id: string;
      nombre: string;
      p2c: string;
      plc: string;
      p2v: string | null;
      plv: string | null;
      verificado_en: Date | null;
    }[]
  >`
    select e.id, e.nombre, e.pies2_cotizados as p2c, e.pies_lineales_cotizados as plc, e.pies2_verificados as p2v,
           e.pies_lineales_verificados as plv, e.verificado_en
    from espacios e join tipos_espacio t on t.id = e.tipo_espacio_id
    where e.obra_id = ${obraId} and not t.es_generales
    order by e.orden`;
  return {
    obra,
    abiertos: punch.filter((p) => p.estado === 'abierto').map(detalle),
    cerrados: punch.filter((p) => p.estado === 'cerrado').map(detalle),
    medidas: medidas.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      pies2Cotizados: Number(m.p2c),
      piesLinealesCotizados: Number(m.plc),
      pies2Verificados: m.p2v === null ? null : Number(m.p2v),
      piesLinealesVerificados: m.plv === null ? null : Number(m.plv),
      verificadoEn: m.verificado_en?.toISOString() ?? null,
    })),
  };
}

// ------------------------------------------------------------------ el punch list

const EntradaPunch = z.object({
  obraId: uuid,
  item: z.string().nullish(),
  origen: z.enum(ORIGENES_PUNCH).default('defecto'),
  responsable: z.string().nullish(),
});

/**
 * Anota un detalle del recorrido con el cliente (legacy: pmPunch), con 7 días hábiles para corregirlo. Errores:
 * `punch_sin_detalle` (menos de 4 letras), `obra_no_encontrada`.
 */
export async function agregarPunch(
  tx: Tx,
  entrada: z.input<typeof EntradaPunch>,
  ahora = new Date(),
): Promise<{ punchId: string; folio: string; compromiso: Dia }> {
  const e = validarEntrada(EntradaPunch, entrada);
  const s = await leerSesion(tx, ahora);
  await obraDelPm(tx, s, e.obraId);
  const item = e.item?.trim() ?? '';
  if (item.length < LARGO_ITEM) throw new ErrorDeNegocio('punch_sin_detalle');
  const compromiso = sumarLaborables(s.hoy, DIAS_PARA_CORREGIR_PUNCH, s.calendario);
  const [p] = await tx<{ id: string; folio: string }[]>`
    insert into punch_list (empresa_id, obra_id, item, origen, responsable, fecha_compromiso)
    values (${s.empresaId}, ${e.obraId}, ${item}, ${e.origen}, ${e.responsable?.trim() || null}, ${compromiso})
    returning id, folio`;
  return { punchId: p!.id, folio: p!.folio, compromiso };
}

/** Marca corregido un detalle del punch list (legacy: pmCerrarPunch). Error: `punch_no_encontrado`. */
export async function cerrarPunch(tx: Tx, entrada: { punchId: string }, ahora = new Date()): Promise<void> {
  const { punchId } = validarEntrada(z.object({ punchId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  const [p] = await tx<{ obra_id: string }[]>`
    select obra_id from punch_list where id = ${punchId} and estado = 'abierto'`;
  if (!p) throw new ErrorDeNegocio('punch_no_encontrado');
  await obraDelPm(tx, s, p.obra_id);
  await tx`update punch_list set estado = 'cerrado', cerrado_en = ${ahora} where id = ${punchId}`;
}

// ------------------------------------------------------------------ la medida verificada

const EntradaMedida = z.object({
  espacioId: uuid,
  pies2: z.number().nullish(),
  piesLineales: z.number().nullish(),
});

/**
 * Guarda la medida verificada en sitio de un espacio (legacy: pmMedida; D-014), con quién y cuándo, y su rastro en
 * correcciones. No se mide Generales de obra. Errores: `medida_invalida`, `espacio_no_encontrado`.
 */
export async function verificarMedida(
  tx: Tx,
  entrada: z.input<typeof EntradaMedida>,
  ahora = new Date(),
): Promise<void> {
  const e = validarEntrada(EntradaMedida, entrada);
  const s = await leerSesion(tx, ahora);
  const pies2 = Number(e.pies2);
  const lineales = e.piesLineales === null || e.piesLineales === undefined ? null : Number(e.piesLineales);
  if (!(pies2 > 0) || pies2 >= 1e8 || (lineales !== null && !(lineales >= 0 && lineales < 1e8)))
    throw new ErrorDeNegocio('medida_invalida');
  const [esp] = await tx<{ obra_id: string; vigente: string; lineales: string | null }[]>`
    select e.obra_id, coalesce(e.pies2_verificados, e.pies2_cotizados) as vigente,
           coalesce(e.pies_lineales_verificados, e.pies_lineales_cotizados) as lineales
    from espacios e join tipos_espacio t on t.id = e.tipo_espacio_id
    where e.id = ${e.espacioId} and not t.es_generales`;
  if (!esp) throw new ErrorDeNegocio('espacio_no_encontrado');
  await obraDelPm(tx, s, esp.obra_id);
  await tx`
    update espacios set pies2_verificados = ${pies2}, pies_lineales_verificados = ${lineales},
                        verificado_por = ${s.miembroId}, verificado_en = ${ahora}
    where id = ${e.espacioId}`;
  await tx`
    insert into correcciones (empresa_id, tabla, registro_id, accion, campo, antes, despues, motivo)
    values (${s.empresaId}, 'espacios', ${e.espacioId}, 'medida_verificada', 'pies2', ${String(Number(esp.vigente))},
            ${String(pies2)}, 'Medida verificada en sitio')`;
}
