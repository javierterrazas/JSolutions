// El histórico de las obras cerradas, para el dueño (D-087; legacy: admin/servidor.js duHistorico): cada obra con sus
// números finales, los promedios por mes y por tipo de obra (resumenHistorico), la tendencia, lo que cuesta cada
// etapa según el tamaño (analizarCostosEtapa, D-095: lo que se sugiere al cotizar) y las garantías. Lee lo que guardó
// el cierre (D-085). Lleva dinero: solo el dueño o el administrador.
import {
  type AnalisisEtapa,
  analizarCostosEtapa,
  type Dia,
  type ObraCerrada,
  type ResumenHistorico,
  resumenHistorico,
} from '@ijm/core';
import type { Tx } from './conexion';
import { muestrasDeEtapas, type Nombre } from './consultas-obra';
import { exigirDueno, leerSesion } from './sesion';

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
  exigirDueno(await leerSesion(tx, ahora));
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
           (select en.resena_recibida from entregas en where en.obra_id = c.obra_id) as resena
    from obras_cerradas c
    join obras o on o.id = c.obra_id
    left join miembros m on m.id = o.pm_id
    order by c.fecha_fin_real desc, o.folio desc`;
  const obras = filas.map((f): ObraDelHistorico => {
    const pies2 = Number(f.pies2);
    const contrato = Number(f.contrato);
    const costo = Number(f.costo);
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
    };
  });

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
    obras,
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
