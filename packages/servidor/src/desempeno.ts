// El desempeño de cada manager, para el dueño (D-106): lee lo que hicieron las obras de la empresa y lo mide por PM
// con `desempeno` (core), junto al promedio de la empresa. Las obras se le cuentan al PM que las lleva hoy.
import {
  type DatosDesempeno,
  type Dia,
  desempeno,
  domingoDe,
  type MetricaDeDesempeno,
  sumarDias,
} from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { uuid, validarEntrada } from './entrada';
import { resumenDeObras, type Semaforo as SemaforoPresupuesto } from './seguimiento';
import { exigirDueno, leerSesion } from './sesion';

export const PERIODOS_DESEMPENO = [30, 90, 365] as const;
const Periodo = z.union([z.literal(30), z.literal(90), z.literal(365)]).default(90);

export interface ObraDelManager {
  readonly id: string;
  readonly folio: string;
  readonly cliente: string;
  readonly estado: string;
  readonly avance: number | null;
  readonly atraso: number | null;
  /** El semáforo de su presupuesto (el del seguimiento). */
  readonly presupuesto: SemaforoPresupuesto | null;
}

export interface DesempenoDeManager {
  readonly id: string;
  readonly nombre: string;
  readonly activo: boolean;
  /** Las obras que lleva hoy, en curso o entregadas en el periodo. */
  readonly obras: readonly ObraDelManager[];
  readonly metricas: readonly MetricaDeDesempeno[];
}

export interface DesempenoDeLaEmpresa {
  readonly hoy: Dia;
  readonly desde: Dia;
  readonly dias: number;
  readonly empresa: readonly MetricaDeDesempeno[];
  readonly managers: readonly DesempenoDeManager[];
}

/** El desempeño de todos los managers de la empresa en los últimos `dias`, y el de la empresa. Solo el dueño. */
export async function desempenoDeManagers(
  tx: Tx,
  entrada: { dias?: number } = {},
  ahora = new Date(),
): Promise<DesempenoDeLaEmpresa> {
  const { dias } = validarEntrada(z.object({ dias: Periodo }), entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const desde = sumarDias(s.hoy, -(dias - 1));
  const z_ = s.zona;

  const obras = await tx<
    {
      id: string;
      folio: string;
      cliente: string;
      estado: string;
      pm_id: string | null;
      inicio: Dia | null;
      entregada: Dia | null;
    }[]
  >`
    select o.id, o.folio, o.cliente, o.estado, o.pm_id, to_char(o.fecha_inicio, 'YYYY-MM-DD') as inicio,
           (select to_char(max(e.fecha_entrega), 'YYYY-MM-DD') from entregas e where e.obra_id = o.id) as entregada
    from obras o order by o.folio`;
  const resumen = await resumenDeObras(tx, ahora);

  const cierres = await tx<{ obra_id: string; dia: Dia; tardio: boolean; segundos: number | null }[]>`
    select obra_id, to_char(dia, 'YYYY-MM-DD') as dia, tardio, segundos_captura as segundos
    from bitacora where estado = 'vigente'`;
  const gastos = await tx<{ obra_id: string; dia: Dia; recibo: boolean }[]>`
    select g.obra_id, to_char(g.dia, 'YYYY-MM-DD') as dia,
           exists (select 1 from fotos f where f.ref_tipo = 'gasto' and f.ref_id = g.id) as recibo
    from gastos g where g.origen = 'pm' and g.estado = 'vigente' and g.dia >= ${desde}`;
  const plan = await tx<{ obra_id: string; semana: Dia; fin: Dia | null }[]>`
    select ps.obra_id, to_char(ps.semana, 'YYYY-MM-DD') as semana,
           (select to_char(min(a.dia), 'YYYY-MM-DD') from avance a
            where a.partida_obra_id = ps.partida_obra_id and a.estado = 'terminada' and a.estado_registro = 'vigente')
             as fin
    from plan_semanal ps where ps.semana >= ${sumarDias(desde, -7)}`;
  const inspecciones = await tx<
    { obra_id: string; espacio_id: string; hito_id: string; dia: Dia; resultado: string }[]
  >`
    select obra_id, espacio_id, hito_id, to_char((realizada_en at time zone ${z_})::date, 'YYYY-MM-DD') as dia,
           resultado
    from inspecciones order by realizada_en`;
  const punch = await tx<{ obra_id: string; compromiso: Dia; cerrado: Dia | null }[]>`
    select obra_id, to_char(fecha_compromiso, 'YYYY-MM-DD') as compromiso,
           to_char((cerrado_en at time zone ${z_})::date, 'YYYY-MM-DD') as cerrado
    from punch_list`;
  const pruebas = await tx<{ obra_id: string; dia: Dia; resultado: string }[]>`
    select obra_id, to_char((creado_en at time zone ${z_})::date, 'YYYY-MM-DD') as dia, resultado
    from pruebas_agua where resultado <> 'en_curso'`;
  const noCalidad = await tx<{ obra_id: string; dia: Dia; costo: string }[]>`
    select obra_id, to_char((creado_en at time zone ${z_})::date, 'YYYY-MM-DD') as dia, costo from no_calidad`;
  const metas = await tx<
    { indicador: string; meta: string }[]
  >`select indicador, meta from metas_indicadores`;

  const datos: DatosDesempeno = {
    obras: obras.map((o) => {
      const r = resumen.get(o.id);
      const enCurso = o.estado === 'en_obra';
      return {
        id: o.id,
        enCurso,
        inicio: o.inicio,
        entregada: o.estado === 'entregada' ? o.entregada : null,
        atraso: enCurso && r ? r.atraso : null,
        presupuestoEnRojo: enCurso && r?.semaforo ? r.semaforo === 'rojo' : null,
      };
    }),
    cierres: cierres.map((c) => ({ obraId: c.obra_id, dia: c.dia, tardio: c.tardio, segundos: c.segundos })),
    gastos: gastos.map((g) => ({ obraId: g.obra_id, dia: g.dia, conRecibo: g.recibo })),
    plan: plan.map((p) => ({
      obraId: p.obra_id,
      semana: p.semana,
      hecho: !!p.fin && p.fin <= domingoDe(p.semana),
    })),
    inspecciones: inspecciones.map((i) => ({
      obraId: i.obra_id,
      espacioId: i.espacio_id,
      hitoId: i.hito_id,
      dia: i.dia,
      aprobada: i.resultado === 'aprobado',
    })),
    punch: punch.map((p) => ({ obraId: p.obra_id, compromiso: p.compromiso, cerradoEl: p.cerrado })),
    pruebas: pruebas.map((p) => ({ obraId: p.obra_id, dia: p.dia, conFuga: p.resultado === 'con_fuga' })),
    noCalidad: noCalidad.map((n) => ({ obraId: n.obra_id, dia: n.dia, costo: Number(n.costo) })),
  };
  const lasMetas = Object.fromEntries(metas.map((m) => [m.indicador, Number(m.meta)]));
  // las obras que cuentan: en curso, o entregadas dentro del periodo
  const cuentan = obras.filter((o) => o.estado === 'en_obra' || (o.entregada && o.entregada >= desde));
  const medir = (ids: Set<string>) => desempeno(datos, ids, desde, s.hoy, s.calendario, lasMetas);

  const miembros = await tx<{ id: string; nombre: string; activo: boolean; rol: string }[]>`
    select id, nombre, activo, rol from miembros order by nombre`;
  const conObras = new Set(obras.map((o) => o.pm_id));
  const managers = miembros
    .filter((m) => m.rol === 'pm' || conObras.has(m.id))
    .map((m): DesempenoDeManager => {
      const suyas = cuentan.filter((o) => o.pm_id === m.id);
      return {
        id: m.id,
        nombre: m.nombre,
        activo: m.activo,
        obras: suyas.map((o) => {
          const r = resumen.get(o.id);
          return {
            id: o.id,
            folio: o.folio,
            cliente: o.cliente,
            estado: o.estado,
            avance: r?.avance ?? null,
            atraso: r?.atraso ?? null,
            presupuesto: r?.semaforo ?? null,
          };
        }),
        metricas: medir(new Set(suyas.map((o) => o.id))),
      };
    })
    // los dados de baja sin obras no se comparan
    .filter((m) => m.activo || m.obras.length);
  return { hoy: s.hoy, desde, dias, empresa: medir(new Set(cuentan.map((o) => o.id))), managers };
}

/** El desempeño de un manager, con el de la empresa; null si no es manager de la empresa. Solo el dueño. */
export async function desempenoDeUnManager(
  tx: Tx,
  entrada: { miembroId: string; dias?: number },
  ahora = new Date(),
): Promise<(Omit<DesempenoDeLaEmpresa, 'managers'> & { manager: DesempenoDeManager }) | null> {
  const e = validarEntrada(z.object({ miembroId: uuid, dias: Periodo }), entrada);
  const { managers, ...resto } = await desempenoDeManagers(tx, { dias: e.dias }, ahora);
  const manager = managers.find((m) => m.id === e.miembroId);
  return manager ? { ...resto, manager } : null;
}
