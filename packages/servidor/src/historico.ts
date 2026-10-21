// El histórico de las obras cerradas, para el dueño (D-087; legacy: admin/servidor.js duHistorico): cada obra con sus
// números finales, los promedios por mes y por tipo de obra (resumenHistorico), la tendencia, lo que cuesta cada
// etapa según el tamaño (analizarCostosEtapa, D-095: lo que se sugiere al cotizar) y las garantías. Lee lo que guardó
// el cierre (D-085). Lleva dinero: solo el dueño o el administrador.
//
// D-107: de cada obra, la ganancia por día y el atraso contra la entrega comprometida, para ordenarlas de la mejor a la
// peor; y, de una, dónde se fue el margen (analisisDeObraCerrada).
import {
  type AnalisisEtapa,
  analizarCostosEtapa,
  type Dia,
  diasEntre,
  gananciaPorDia,
  type ObraCerrada,
  type ResumenHistorico,
  resumenHistorico,
  sumarLaborables,
} from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { muestrasDeEtapas, type Nombre } from './consultas-obra';
import { uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion, type Sesion } from './sesion';

export interface ObraDelHistorico extends ObraCerrada {
  readonly folio: string;
  readonly cliente: string;
  readonly pm: string | null;
  readonly inicio: Dia;
  readonly entrega: Dia;
  /** Los reclamos de garantía y lo que costaron. */
  readonly reclamos: number;
  readonly costoGarantia: number;
  /** Si el cliente dejó su reseña. */
  readonly resena: boolean;
  /** Contrato final menos costo real, y entre los días que duró (D-107). */
  readonly ganancia: number;
  readonly gananciaDia: number | null;
  /** La entrega comprometida: la del alta más los días de las órdenes de cambio aprobadas. */
  readonly comprometida: Dia;
  /** Días de la entrega real contra la comprometida (negativo: antes). */
  readonly atraso: number;
}

export interface CostoDeEtapa extends AnalisisEtapa {
  readonly tipoEspacio: Nombre;
  /** Null: "Otras partidas". */
  readonly etapa: Nombre | null;
}

export interface HistoricoDeObras {
  /** De la entrega más reciente a la más vieja. */
  readonly obras: readonly ObraDelHistorico[];
  readonly resumen: ResumenHistorico;
  /** Lo que cuesta cada etapa según el tamaño, por tipo de espacio (D-095). */
  readonly costos: readonly CostoDeEtapa[];
  readonly garantias: {
    reclamos: number;
    costo: number;
    abiertos: number;
    resenas: number;
    entregas: number;
  };
}

export async function historicoDeObras(tx: Tx, ahora = new Date()): Promise<HistoricoDeObras> {
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const obras = await obrasCerradas(tx, s);
  return { obras, ...(await restoDelHistorico(tx, obras)) };
}

/** Las obras cerradas con sus números, de la entrega más reciente a la más vieja; con `obraId`, solo esa. */
async function obrasCerradas(tx: Tx, s: Sesion, obraId: string | null = null): Promise<ObraDelHistorico[]> {
  const filas = await tx<
    {
      obra_id: string;
      folio: string;
      cliente: string;
      pm: string | null;
      tipo: string | null;
      inicio: Dia;
      entrega: Dia;
      dias: number;
      contrato: string;
      costo: string;
      cobrado: string;
      no_calidad: string;
      margen: string | null;
      desviacion: string | null;
      pies2: string;
      reclamos: number;
      costo_garantia: string;
      resena: boolean | null;
      estimada: Dia;
      dias_oc: number;
    }[]
  >`
    select c.obra_id, o.folio, o.cliente, m.nombre as pm,
           (select string_agg(distinct t.nombre_es, ' + ' order by t.nombre_es)
            from espacios e join tipos_espacio t on t.id = e.tipo_espacio_id
            where e.obra_id = c.obra_id and not t.es_generales) as tipo,
           to_char(c.fecha_inicio, 'YYYY-MM-DD') as inicio, to_char(c.fecha_fin_real, 'YYYY-MM-DD') as entrega,
           c.dias_ciclo as dias, c.contrato_final as contrato, c.costo_total as costo, c.cobrado,
           c.no_calidad, c.margen_bruto as margen, c.desviacion_estimacion as desviacion, c.pies2,
           (select count(*)::int from no_calidad n where n.obra_id = c.obra_id and n.tipo = 'garantia') as reclamos,
           (select coalesce(sum(costo), 0) from no_calidad n where n.obra_id = c.obra_id and n.tipo = 'garantia')
             as costo_garantia,
           (select en.resena_recibida from entregas en where en.obra_id = c.obra_id) as resena,
           to_char(o.fecha_fin_estimada, 'YYYY-MM-DD') as estimada,
           (select coalesce(sum(oc.dias_impacto), 0)::int from ordenes_cambio oc
            where oc.obra_id = c.obra_id and oc.estado in ('autorizada', 'facturada')) as dias_oc
    from obras_cerradas c
    join obras o on o.id = c.obra_id
    left join miembros m on m.id = o.pm_id
    where ${obraId}::uuid is null or c.obra_id = ${obraId}
    order by c.fecha_fin_real desc, o.folio desc`;
  return filas.map((f): ObraDelHistorico => {
    const pies2 = Number(f.pies2);
    const contrato = Number(f.contrato);
    const costo = Number(f.costo);
    // la comprometida se mueve en días laborables, como en el seguimiento
    const comprometida = sumarLaborables(f.estimada, f.dias_oc, s.calendario);
    return {
      obraId: f.obra_id,
      folio: f.folio,
      cliente: f.cliente,
      pm: f.pm,
      tipo: f.tipo ?? '',
      inicio: f.inicio,
      entrega: f.entrega,
      mes: f.entrega.slice(0, 7),
      dias: f.dias,
      contrato,
      costo,
      cobrado: Number(f.cobrado),
      noCalidad: Number(f.no_calidad),
      margen: f.margen === null ? null : Number(f.margen),
      desviacion: f.desviacion === null ? null : Number(f.desviacion),
      costoPie: pies2 ? costo / pies2 : null,
      ventaPie: pies2 ? contrato / pies2 : null,
      reclamos: f.reclamos,
      costoGarantia: Number(f.costo_garantia),
      resena: !!f.resena,
      ganancia: contrato - costo,
      gananciaDia: gananciaPorDia({ contrato, costo, dias: f.dias }),
      comprometida,
      atraso: diasEntre(comprometida, f.entrega),
    };
  });
}

/** Lo demás del histórico: los promedios, lo que cuesta cada etapa y las garantías. */
async function restoDelHistorico(
  tx: Tx,
  obras: readonly ObraDelHistorico[],
): Promise<Omit<HistoricoDeObras, 'obras'>> {
  const nombres = await tx<
    {
      tipo: string;
      tipo_es: string;
      tipo_en: string | null;
      etapa: string | null;
      etapa_es: string | null;
      etapa_en: string | null;
    }[]
  >`
    select distinct h.tipo_espacio_id as tipo, t.nombre_es as tipo_es, t.nombre_en as tipo_en, h.etapa_id as etapa,
           et.nombre_es as etapa_es, et.nombre_en as etapa_en
    from historico_etapas h
    join tipos_espacio t on t.id = h.tipo_espacio_id
    left join etapas et on et.id = h.etapa_id`;
  const nombreTipo = new Map(nombres.map((e) => [e.tipo, { es: e.tipo_es, en: e.tipo_en }]));
  const nombreEtapa = new Map(
    nombres.filter((e) => e.etapa).map((e) => [e.etapa!, { es: e.etapa_es!, en: e.etapa_en }]),
  );
  // cómo se cotiza hoy cada etapa: la sugerencia es contra eso
  const unidades = new Map(
    (await tx<{ id: string; unidad: AnalisisEtapa['unidad'] }[]>`select id, unidad from etapas`).map((x) => [
      x.id,
      x.unidad,
    ]),
  );
  const costos = analizarCostosEtapa(await muestrasDeEtapas(tx), unidades)
    .map((c) => ({
      ...c,
      tipoEspacio: nombreTipo.get(c.tipoEspacioId)!,
      etapa: c.etapaId ? (nombreEtapa.get(c.etapaId) ?? null) : null,
    }))
    .sort((a, b) => a.tipoEspacio.es.localeCompare(b.tipoEspacio.es) || b.costoTipico - a.costoTipico);

  const [g] = await tx<
    { reclamos: number; costo: string; abiertos: number; resenas: number; entregas: number }[]
  >`
    select (select count(*)::int from no_calidad where tipo = 'garantia') as reclamos,
           (select coalesce(sum(costo), 0) from no_calidad where tipo = 'garantia') as costo,
           (select count(*)::int from no_calidad where tipo = 'garantia' and estado = 'abierto') as abiertos,
           (select count(*)::int from entregas e join obras_cerradas c on c.obra_id = e.obra_id
            where e.resena_recibida) as resenas,
           (select count(*)::int from obras_cerradas) as entregas`;

  return {
    resumen: resumenHistorico(obras),
    costos,
    garantias: {
      reclamos: g!.reclamos,
      costo: Number(g!.costo),
      abiertos: g!.abiertos,
      resenas: g!.resenas,
      entregas: g!.entregas,
    },
  };
}

export interface EtapaDelAnalisis {
  readonly espacio: string;
  /** Null: "Otras partidas". */
  readonly etapa: Nombre | null;
  readonly presupuestado: number;
  readonly real: number;
}

export interface AnalisisDeObraCerrada {
  readonly obra: ObraDelHistorico;
  readonly contratoOriginal: number;
  readonly ordenesCambio: { readonly n: number; readonly monto: number };
  /** El costo que se esperaba (la suma de los costos del presupuesto, D-084) y en qué se fue el real. */
  readonly presupuestado: number;
  readonly materiales: number;
  readonly cuadrilla: number;
  readonly subcontratos: number;
  readonly noCalidad: { readonly retrabajos: number; readonly garantias: number; readonly costo: number };
  readonly diasPlaneados: number;
  /** Cada etapa de cada espacio, la que más se pasó primero. */
  readonly etapas: readonly EtapaDelAnalisis[];
}

/**
 * Dónde se fue el margen de una obra cerrada (D-107): presupuesto contra real (en total, por rubro y por etapa), lo
 * que sumaron las órdenes de cambio, lo que costaron los retrabajos y las garantías, y los días planeados contra los
 * reales. Null si la obra no está cerrada. Solo el dueño.
 */
export async function analisisDeObraCerrada(
  tx: Tx,
  entrada: { obraId: string },
  ahora = new Date(),
): Promise<AnalisisDeObraCerrada | null> {
  const { obraId } = validarEntrada(z.object({ obraId: uuid }), entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const [obra] = await obrasCerradas(tx, s, obraId);
  if (!obra) return null;
  const [c] = await tx<
    {
      contrato_original: string;
      monto_oc: string;
      presupuestado: string;
      materiales: string;
      cuadrilla: string;
      subcontratos: string;
    }[]
  >`
    select contrato_original, monto_oc, presupuestado, materiales, cuadrilla, subcontratos
    from obras_cerradas where obra_id = ${obraId}`;
  const [oc] = await tx<{ n: number }[]>`
    select count(*)::int as n from ordenes_cambio where obra_id = ${obraId} and estado in ('autorizada', 'facturada')`;
  const [nc] = await tx<{ retrabajos: number; garantias: number; costo: string }[]>`
    select count(*) filter (where tipo <> 'garantia')::int as retrabajos,
           count(*) filter (where tipo = 'garantia')::int as garantias, coalesce(sum(costo), 0) as costo
    from no_calidad where obra_id = ${obraId}`;
  const etapas = await tx<
    { espacio: string; es: string | null; en: string | null; presupuestado: string; real: string }[]
  >`
    select e.nombre as espacio, et.nombre_es as es, et.nombre_en as en, h.presupuestado, h.costo_real as real
    from historico_etapas h join espacios e on e.id = h.espacio_id left join etapas et on et.id = h.etapa_id
    where h.obra_id = ${obraId}`;
  return {
    obra,
    contratoOriginal: Number(c!.contrato_original),
    ordenesCambio: { n: oc!.n, monto: Number(c!.monto_oc) },
    presupuestado: Number(c!.presupuestado),
    materiales: Number(c!.materiales),
    cuadrilla: Number(c!.cuadrilla),
    subcontratos: Number(c!.subcontratos),
    noCalidad: { retrabajos: nc!.retrabajos, garantias: nc!.garantias, costo: Number(nc!.costo) },
    diasPlaneados: diasEntre(obra.inicio, obra.comprometida),
    etapas: etapas
      .map((x) => ({
        espacio: x.espacio,
        etapa: x.es ? { es: x.es, en: x.en } : null,
        presupuestado: Number(x.presupuestado),
        real: Number(x.real),
      }))
      .sort((a, b) => b.real - b.presupuestado - (a.real - a.presupuestado)),
  };
}
