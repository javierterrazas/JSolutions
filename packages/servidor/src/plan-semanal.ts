// El plan de la semana (D-079): cada semana se congela lo que el cronograma prevé terminar en las obras en curso, para
// medir después cuánto se cumplió (el indicador de cumplimiento, D-075). El cronograma se recorre solo cuando algo se
// atrasa; congelado, el plan guarda lo que se prometió. Como en el legacy (congelarSemana_), se congela la primera
// vez que el dueño o el administrador abre la app en la semana; lo que ya se terminó antes de ese día no entra.
import {
  type AvanceDia,
  cronogramaObra,
  type Dia,
  domingoDe,
  type EspacioCrono,
  lunesDe,
  planDeLaSemana,
  primerLaborable,
  type Responsable,
  sumarDias,
} from '@ijm/core';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { exigirDueno, leerSesion } from './sesion';

/**
 * Congela el plan de esta semana si nadie lo ha hecho. Devuelve cuántas partidas quedaron en él (0 si ya estaba
 * congelado o si esta semana el cronograma no prevé terminar nada). Solo el dueño o el administrador.
 */
export async function congelarPlanSemanal(tx: Tx, ahora = new Date()): Promise<number> {
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const lunes = lunesDe(s.hoy);
  const [ya] = await tx`select 1 from plan_semanal where semana = ${lunes} limit 1`;
  if (ya) return 0;

  const obras = await tx<{ id: string; inicio: Dia }[]>`
    select id, to_char(fecha_inicio, 'YYYY-MM-DD') as inicio from obras where estado = 'en_obra'`;
  if (!obras.length) return 0;
  const ids = obras.map((o) => o.id);
  const espacios = await tx<{ id: string; obra_id: string; generales: boolean }[]>`
    select e.id, e.obra_id, t.es_generales as generales
    from espacios e join tipos_espacio t on t.id = e.tipo_espacio_id
    where e.obra_id = any(${ids}) order by e.orden`;
  const partidas = await tx<
    {
      id: string;
      espacio_id: string;
      dias: number;
      responsable: Responsable;
      oficio_id: string | null;
      paralelo: boolean;
      espera: number;
    }[]
  >`
    select id, espacio_id, dias, responsable, oficio_id, paralelo, espera
    from partidas_obra where obra_id = any(${ids}) and estado = 'activa' order by orden, nombre_es`;
  const avance = await tx<(AvanceDia & { obra_id: string })[]>`
    select obra_id, partida_obra_id as "partidaId", estado, to_char(dia, 'YYYY-MM-DD') as dia
    from avance where obra_id = any(${ids}) and estado_registro = 'vigente'`;

  const filas = obras.flatMap((o) => {
    const crono: EspacioCrono[] = espacios
      .filter((e) => e.obra_id === o.id)
      .map((e) => ({
        id: e.id,
        generales: e.generales,
        partidas: partidas
          .filter((p) => p.espacio_id === e.id)
          .map((p) => ({
            id: p.id,
            dias: p.dias,
            paralelo: p.paralelo,
            espera: p.espera,
            responsable: p.responsable,
            oficioId: p.oficio_id,
          })),
      }));
    const cronograma = cronogramaObra(
      o.inicio,
      crono,
      avance.filter((a) => a.obra_id === o.id),
      s.hoy,
      s.calendario,
    );
    return planDeLaSemana(cronograma, s.hoy, s.calendario).map((p) => ({
      empresa_id: s.empresaId,
      semana: lunes,
      obra_id: o.id,
      partida_obra_id: p.partidaId,
      fin_previsto: p.finPrevisto,
    }));
  });
  if (!filas.length) return 0;
  // si dos pantallas lo congelan a la vez, la segunda no repite nada
  const hechas = await tx`
    insert into plan_semanal ${tx(filas)} on conflict (semana, partida_obra_id) do nothing returning id`;
  return hechas.length;
}

export interface PartidaDelPlan {
  readonly obraId: string;
  readonly folio: string;
  readonly espacio: string;
  readonly partida: Nombre;
  readonly finPrevisto: Dia;
  /** El primer día que se marcó terminada; null si no se ha terminado. */
  readonly terminadaEl: Dia | null;
  /** Si se terminó a más tardar el domingo de esa semana: lo que cuenta para el cumplimiento. */
  readonly cumplida: boolean;
}

export interface CumplimientoDelPlan {
  /** La semana pasada, la que mide el indicador. */
  readonly lunes: Dia;
  readonly domingo: Dia;
  readonly partidas: readonly PartidaDelPlan[];
  /** Cuántas partidas quedaron en el plan de esta semana (0 si todavía no se congela o no prevé terminar nada). */
  readonly estaSemana: number;
}

/**
 * El detalle del cumplimiento: lo que se congeló el lunes pasado y si se terminó en esa semana, por obra; y cuánto
 * lleva el plan de esta semana. Solo el dueño o el administrador.
 */
export async function cumplimientoDelPlan(tx: Tx, ahora = new Date()): Promise<CumplimientoDelPlan> {
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const lunes = sumarDias(lunesDe(s.hoy), -7);
  const domingo = domingoDe(lunes);
  const filas = await tx<
    {
      obra_id: string;
      folio: string;
      espacio: string;
      es: string;
      en: string | null;
      fin: Dia;
      terminada: Dia | null;
    }[]
  >`
    select ps.obra_id, o.folio, e.nombre as espacio, p.nombre_es as es, p.nombre_en as en,
           to_char(ps.fin_previsto, 'YYYY-MM-DD') as fin,
           (select to_char(min(a.dia), 'YYYY-MM-DD') from avance a
            where a.partida_obra_id = ps.partida_obra_id and a.estado = 'terminada'
              and a.estado_registro = 'vigente') as terminada
    from plan_semanal ps
    join obras o on o.id = ps.obra_id
    join partidas_obra p on p.id = ps.partida_obra_id
    join espacios e on e.id = p.espacio_id
    where ps.semana = ${lunes}
    order by o.folio, ps.fin_previsto, e.orden, p.orden`;
  const [esta] = await tx<{ n: number }[]>`
    select count(*)::int as n from plan_semanal where semana = ${lunesDe(s.hoy)}`;
  return {
    lunes,
    domingo,
    estaSemana: esta!.n,
    partidas: filas.map((f) => ({
      obraId: f.obra_id,
      folio: f.folio,
      espacio: f.espacio,
      partida: { es: f.es, en: f.en },
      finPrevisto: f.fin,
      terminadaEl: f.terminada,
      // la misma regla que cumplimientoSemanal: si se terminó en un día no laborable, cuenta el siguiente laborable
      cumplida: !!f.terminada && primerLaborable(f.terminada, s.calendario) <= domingo,
    })),
  };
}
