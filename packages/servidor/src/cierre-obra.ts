// El cierre de una obra (D-085; legacy: admin/servidor.js duPreCierre y duCerrarObra). Primero la revisión: los números
// finales (contrato con sus órdenes de cambio, costo real, cobrado, margen, desviación contra el presupuesto) y lo que
// falta (dinero por cobrar o por pagar, órdenes sin facturar, partidas sin terminar…). Luego el cierre, en una sola
// transacción: la entrega con su garantía, la obra como entregada, su resumen en obras_cerradas y su histórico
// (D-008): el costo real de cada etapa de cada espacio, por pie², y los días reales de cada partida. De ese histórico
// se aprende a cotizar. Nada se borra; cerrada, la obra ya no se edita. Solo el dueño o el administrador.
import { type Dia, ErrorDeNegocio, laborablesEntre, realDeAvance, sumarMeses } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { dia, uuid, validarEntrada } from './entrada';
import { lecturaParaCierre } from './seguimiento';

export type Gravedad = 'alto' | 'medio' | 'bajo';

/** Lo que falta antes de cerrar; `codigo` lo traduce la pantalla con sus `datos`. */
export interface AvisoDeCierre {
  readonly gravedad: Gravedad;
  readonly codigo: string;
  readonly datos?: Readonly<Record<string, number | string>>;
}

export interface NumerosDeCierre {
  readonly contratoOriginal: number;
  /** Lo que suman las órdenes de cambio autorizadas y facturadas. */
  readonly montoOC: number;
  readonly contratoFinal: number;
  /** Lo que se esperaba gastar: los costos del presupuesto (D-084); sin costo, su precio. */
  readonly presupuestado: number;
  readonly materiales: number;
  readonly cuadrilla: number;
  readonly subcontratos: number;
  readonly costo: number;
  readonly cobrado: number;
  readonly noCalidad: number;
  /** (contrato final − costo) / contrato final; null sin contrato. */
  readonly margen: number | null;
  /** (costo − presupuestado) / presupuestado; null sin presupuesto. */
  readonly desviacion: number | null;
  readonly diasReportados: number;
  readonly pies2: number;
}

export interface RevisionDeCierre {
  readonly obra: { id: string; folio: string; cliente: string; estado: string; inicio: Dia };
  /** Ya cerrada: cuándo y su resumen guardado; no se puede cerrar otra vez. */
  readonly cerrada: { fechaEntrega: Dia; margen: number | null; desviacion: number | null } | null;
  /** La entrega, si ya se registró (fecha y meses de garantía). */
  readonly entrega: { fecha: Dia; garantiaMeses: number } | null;
  readonly numeros: NumerosDeCierre;
  readonly avisos: readonly AvisoDeCierre[];
  readonly hoy: Dia;
}

const ARRANCADA = ['en_obra'];

async function revisar(tx: Tx, obraId: string, ahora: Date) {
  const lectura = await lecturaParaCierre(tx, obraId, ahora);
  if (!lectura) return null;
  const { s, l, c } = lectura;
  const o = l.obras[0]!;

  const [fin] = await tx<{ contrato: string | null }[]>`
    select contrato_original as contrato from obras_finanzas where obra_id = ${obraId}`;
  const ocs = await tx<{ estado: string; precio: string | null }[]>`
    select oc.estado, m.precio_cliente as precio from ordenes_cambio oc
    left join ordenes_cambio_montos m on m.orden_cambio_id = oc.id where oc.obra_id = ${obraId}`;
  const [d] = await tx<
    {
      cobrado: string;
      no_calidad: string;
      pagado_sub: string;
      ot_sin_aprobar: number;
      sin_recibo: number;
      sin_partida: number;
      punch: number;
      dias: number;
    }[]
  >`
    select
      (select coalesce(sum(monto), 0) from cobros where obra_id = ${obraId} and estado = 'vigente') as cobrado,
      (select coalesce(sum(costo), 0) from no_calidad where obra_id = ${obraId}) as no_calidad,
      (select coalesce(sum(monto), 0) from pagos_sub where obra_id = ${obraId} and estado = 'vigente') as pagado_sub,
      (select count(*)::int from ordenes_trabajo where obra_id = ${obraId} and estado <> 'cancelada'
         and aprobada_en is null) as ot_sin_aprobar,
      (select count(*)::int from gastos g where g.obra_id = ${obraId} and g.estado = 'vigente'
         and not exists (select 1 from fotos f where f.ref_tipo = 'gasto' and f.ref_id = g.id)) as sin_recibo,
      (select count(*)::int from gastos where obra_id = ${obraId} and estado = 'vigente' and partida_obra_id is null)
        + (select count(*)::int from mano_obra where obra_id = ${obraId} and estado = 'vigente'
             and partida_obra_id is null) as sin_partida,
      (select count(*)::int from punch_list where obra_id = ${obraId} and estado <> 'cerrado') as punch,
      (select count(*)::int from bitacora where obra_id = ${obraId} and estado = 'vigente') as dias`;
  const [ent] = await tx<{ fecha: Dia; meses: number }[]>`
    select to_char(fecha_entrega, 'YYYY-MM-DD') as fecha, garantia_meses as meses from entregas
    where obra_id = ${obraId}`;
  const [cerrada] = await tx<{ fecha: Dia; margen: string | null; desviacion: string | null }[]>`
    select to_char(fecha_fin_real, 'YYYY-MM-DD') as fecha, margen_bruto as margen,
           desviacion_estimacion as desviacion
    from obras_cerradas where obra_id = ${obraId}`;

  const materiales = c.costos.reduce((a, x) => a + x.material, 0);
  const cuadrilla = c.costos.reduce((a, x) => a + x.cuadrilla, 0);
  const subcontratos = c.costos.reduce((a, x) => a + x.sub, 0);
  const costo = materiales + cuadrilla + subcontratos;
  const presupuestado = c.costos.reduce((a, x) => a + x.presupuesto, 0);
  const contratoOriginal = Number(fin?.contrato ?? 0);
  const montoOC = ocs
    .filter((x) => x.estado === 'autorizada' || x.estado === 'facturada')
    .reduce((a, x) => a + Number(x.precio ?? 0), 0);
  const contratoFinal = contratoOriginal + montoOC;
  const cobrado = Number(d!.cobrado);
  const pies2 = l.espacios.filter((e) => !e.generales).reduce((a, e) => a + Number(e.pies2), 0);

  // lo que falta, como en el legacy: primero lo que deja dinero en la mesa
  const avisos: AvisoDeCierre[] = [];
  const dinero = (n: number) => Math.round(n * 100) / 100;
  if (contratoFinal - cobrado > 1)
    avisos.push({
      gravedad: 'alto',
      codigo: 'falta_cobrar',
      datos: { monto: dinero(contratoFinal - cobrado) },
    });
  const propuestas = ocs.filter((x) => x.estado === 'propuesta').length;
  if (propuestas) avisos.push({ gravedad: 'alto', codigo: 'oc_sin_responder', datos: { n: propuestas } });
  const sinFacturar = ocs.filter((x) => x.estado === 'autorizada').length;
  if (sinFacturar) avisos.push({ gravedad: 'alto', codigo: 'oc_sin_facturar', datos: { n: sinFacturar } });
  const terminadas = new Set(
    [...realDeAvance(l.avance.filter((a) => a.obra_id === obraId)).entries()]
      .filter(([, r]) => r.fin)
      .map(([id]) => id),
  );
  const sinTerminar = l.partidas.filter((p) => !terminadas.has(p.id)).length;
  if (sinTerminar)
    avisos.push({ gravedad: 'alto', codigo: 'partidas_sin_terminar', datos: { n: sinTerminar } });
  const porPagarSub = subcontratos - Number(d!.pagado_sub);
  if (porPagarSub > 1)
    avisos.push({ gravedad: 'medio', codigo: 'subs_por_pagar', datos: { monto: dinero(porPagarSub) } });
  if (d!.ot_sin_aprobar)
    avisos.push({ gravedad: 'medio', codigo: 'ot_sin_aprobar', datos: { n: d!.ot_sin_aprobar } });
  if (d!.punch) avisos.push({ gravedad: 'medio', codigo: 'punch_abiertos', datos: { n: d!.punch } });
  if (d!.sin_recibo)
    avisos.push({ gravedad: 'medio', codigo: 'gastos_sin_recibo', datos: { n: d!.sin_recibo } });
  if (!presupuestado) avisos.push({ gravedad: 'medio', codigo: 'sin_presupuesto' });
  if (d!.sin_partida)
    avisos.push({ gravedad: 'bajo', codigo: 'costos_sin_partida', datos: { n: d!.sin_partida } });

  const revision: RevisionDeCierre = {
    obra: { id: o.id, folio: o.folio, cliente: o.cliente, estado: o.estado, inicio: o.inicio },
    cerrada: cerrada
      ? {
          fechaEntrega: cerrada.fecha,
          margen: cerrada.margen === null ? null : Number(cerrada.margen),
          desviacion: cerrada.desviacion === null ? null : Number(cerrada.desviacion),
        }
      : null,
    entrega: ent ? { fecha: ent.fecha, garantiaMeses: ent.meses } : null,
    numeros: {
      contratoOriginal,
      montoOC,
      contratoFinal,
      presupuestado,
      materiales,
      cuadrilla,
      subcontratos,
      costo,
      cobrado,
      noCalidad: Number(d!.no_calidad),
      margen: contratoFinal ? (contratoFinal - costo) / contratoFinal : null,
      desviacion: presupuestado ? (costo - presupuestado) / presupuestado : null,
      diasReportados: d!.dias,
      pies2,
    },
    avisos,
    hoy: s.hoy,
  };
  return { revision, s, l, c, terminadas };
}

/** La revisión antes de cerrar una obra; null si no existe. Solo el dueño o el administrador. */
export async function revisionDeCierre(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<RevisionDeCierre | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  return (await revisar(tx, obraId, ahora))?.revision ?? null;
}

const EntradaCierre = z.object({
  obraId: uuid,
  /** El día que se le entregó al cliente: con él cuentan los días de la obra y empieza la garantía. */
  fechaEntrega: dia,
  garantiaMeses: z.number().int().min(0).max(120).default(12),
  /** Cerrar aunque falte algo grave (dinero por cobrar, partidas sin terminar…). */
  forzar: z.boolean().default(false),
});
export type EntradaCierreObra = z.input<typeof EntradaCierre>;

export type ResultadoCierreObra =
  | {
      readonly ok: true;
      readonly margen: number | null;
      readonly desviacion: number | null;
      readonly dias: number;
    }
  | { readonly ok: false; readonly confirmar: 'avisos'; readonly avisos: readonly AvisoDeCierre[] };

/**
 * Cierra una obra. Si falta algo grave, no cierra y devuelve los avisos para confirmar (`forzar`). Errores:
 * `obra_no_encontrada`, `obra_ya_cerrada`, `obra_sin_arrancar`, `fecha_futura`, `entrega_antes_del_inicio`.
 */
export async function cerrarObra(
  tx: Tx,
  entrada: EntradaCierreObra,
  ahora = new Date(),
): Promise<ResultadoCierreObra> {
  const e = validarEntrada(EntradaCierre, entrada);
  const r = await revisar(tx, e.obraId, ahora);
  if (!r) throw new ErrorDeNegocio('obra_no_encontrada');
  const { revision, s, l, c, terminadas } = r;
  if (revision.cerrada) throw new ErrorDeNegocio('obra_ya_cerrada');
  if (!ARRANCADA.includes(revision.obra.estado)) throw new ErrorDeNegocio('obra_sin_arrancar');
  if (e.fechaEntrega > s.hoy) throw new ErrorDeNegocio('fecha_futura');
  if (e.fechaEntrega < revision.obra.inicio) throw new ErrorDeNegocio('entrega_antes_del_inicio');
  const graves = revision.avisos.filter((a) => a.gravedad === 'alto');
  if (graves.length && !e.forzar) return { ok: false, confirmar: 'avisos', avisos: revision.avisos };

  const n = revision.numeros;
  const dias = Math.max(
    0,
    Math.round(
      (Date.parse(`${e.fechaEntrega}T12:00:00Z`) - Date.parse(`${revision.obra.inicio}T12:00:00Z`)) / 864e5,
    ),
  );

  // la entrega y su garantía (si ya estaba, se corrige su fecha)
  const vence = sumarMeses(e.fechaEntrega, e.garantiaMeses);
  await tx`
    insert into entregas (empresa_id, obra_id, fecha_entrega, garantia_meses, garantia_vence)
    values (${s.empresaId}, ${e.obraId}, ${e.fechaEntrega}, ${e.garantiaMeses}, ${vence})
    on conflict (obra_id) do update set fecha_entrega = excluded.fecha_entrega,
      garantia_meses = excluded.garantia_meses, garantia_vence = excluded.garantia_vence`;
  await tx`update obras set estado = 'entregada', fecha_fin_real = ${e.fechaEntrega} where id = ${e.obraId}`;

  await tx`
    insert into obras_cerradas (obra_id, empresa_id, fecha_inicio, fecha_fin_real, dias_ciclo, contrato_original,
                                monto_oc, contrato_final, presupuestado, materiales, cuadrilla, subcontratos,
                                costo_total, margen_bruto, desviacion_estimacion, cobrado, no_calidad, dias_reportados,
                                pies2)
    values (${e.obraId}, ${s.empresaId}, ${revision.obra.inicio}, ${e.fechaEntrega}, ${dias}, ${n.contratoOriginal},
            ${n.montoOC}, ${n.contratoFinal}, ${n.presupuestado}, ${n.materiales}, ${n.cuadrilla}, ${n.subcontratos},
            ${n.costo}, ${n.margen}, ${n.desviacion}, ${n.cobrado}, ${n.noCalidad}, ${n.diasReportados}, ${n.pies2})`;

  // el histórico por etapa: su costo real contra lo presupuestado, y por pie² (D-008)
  const lineales = new Map(
    (
      await tx<{ id: string; lineales: string }[]>`
        select id, coalesce(pies_lineales_verificados, pies_lineales_cotizados) as lineales
        from espacios where obra_id = ${e.obraId}`
    ).map((x) => [x.id, Number(x.lineales)]),
  );
  const espacio = new Map(l.espacios.map((x) => [x.id, x]));
  const unidadDe = new Map(
    (await tx<{ id: string; unidad: string }[]>`select id, unidad from etapas`).map((x) => [x.id, x.unidad]),
  );
  const etapas = c.costos
    .filter((x) => x.total || x.presupuesto)
    .map((x) => {
      const esp = espacio.get(x.espacioId)!;
      const pies2 = esp.generales ? 0 : Number(esp.pies2);
      const piesLineales = esp.generales ? 0 : (lineales.get(x.espacioId) ?? 0);
      // la unidad con que se cotiza la etapa (D-086), y su costo real por esa unidad
      const unidad = (x.etapaId ? unidadDe.get(x.etapaId) : null) ?? 'pie2';
      const medida = unidad === 'pie_lineal' ? piesLineales : pies2;
      return {
        empresa_id: s.empresaId,
        obra_id: e.obraId,
        espacio_id: x.espacioId,
        tipo_espacio_id: esp.tipo,
        etapa_id: x.etapaId,
        presupuestado: x.presupuesto,
        costo_real: Math.round(x.total * 100) / 100,
        pies2,
        pies_lineales: piesLineales,
        costo_por_pie2: pies2 ? x.total / pies2 : null,
        unidad,
        costo_por_unidad: medida ? x.total / medida : null,
      };
    });
  if (etapas.length) await tx`insert into historico_etapas ${tx(etapas)}`;

  // y los días reales de cada partida terminada, contra los que traía su plantilla
  const real = realDeAvance(l.avance.filter((a) => a.obra_id === e.obraId));
  const plantillas = new Map(
    (
      await tx<{ id: string; plantilla: string | null }[]>`
        select id, plantilla_id as plantilla from partidas_obra where obra_id = ${e.obraId}`
    ).map((x) => [x.id, x.plantilla]),
  );
  const duraciones = l.partidas
    .filter((p) => terminadas.has(p.id) && real.get(p.id)?.ini)
    .map((p) => {
      const r = real.get(p.id)!;
      return {
        empresa_id: s.empresaId,
        obra_id: e.obraId,
        partida_obra_id: p.id,
        tipo_espacio_id: espacio.get(p.espacio_id)!.tipo,
        plantilla_id: plantillas.get(p.id) ?? null,
        dias_planeados: p.dias,
        dias_reales: Math.max(1, laborablesEntre(r.ini!, r.fin!, s.calendario) + 1),
      };
    });
  if (duraciones.length) await tx`insert into historico_duraciones ${tx(duraciones)}`;

  return { ok: true, margen: n.margen, desviacion: n.desviacion, dias };
}
