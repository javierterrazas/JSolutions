// Los indicadores de la empresa, para el dueño (D-075; legacy: admin/servidor.js kpis_): lee de la base lo que miden
// los 19 y los calcula con las reglas de @ijm/core (calcularIndicadores, con paridad contra el legacy), con las metas
// que la empresa haya cambiado (metas_indicadores), y qué obras están detrás de cada uno de los seis del lunes
// (detallePorObra, D-099). Lleva dinero: solo el dueño o el administrador.
import {
  calcularIndicadores,
  type ClaveIndicador,
  cumplimientoSemanal,
  type DatosIndicadores,
  type DetalleDeObra,
  detallePorObra,
  type Dia,
  type Indicador,
  lunesDe,
  type Real,
  sumarDias,
} from '@ijm/core';
import type { Tx } from './conexion';
import { exigirDueno, leerSesion } from './sesion';

export interface IndicadoresDeLaEmpresa {
  readonly hoy: Dia;
  readonly indicadores: readonly Indicador[];
  /** Las obras detrás de cada uno de los seis del lunes, con su folio y su cliente (D-099). */
  readonly detalle: Partial<
    Record<ClaveIndicador, readonly (DetalleDeObra & { folio: string; cliente: string })[]>
  >;
  /** Cuántas obras están en curso y cuántas se han entregado: el contexto de los números. */
  readonly obrasEnCurso: number;
  readonly obrasEntregadas: number;
}

/** Los 19 indicadores de la empresa, hoy. Solo el dueño o el administrador. */
export async function indicadoresDeLaEmpresa(tx: Tx, ahora = new Date()): Promise<IndicadoresDeLaEmpresa> {
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);

  const [cfg] = await tx<{ sla_avisos: number; sla_oc: number; sin_recibo: number; margen: string }[]>`
    select sla_bloqueo_horas as sla_avisos, sla_oc_horas as sla_oc, horas_sin_recibo as sin_recibo,
           margen_minimo_oc as margen
    from configuracion`;
  const metas = await tx<
    { indicador: string; meta: string }[]
  >`select indicador, meta from metas_indicadores`;

  const obras = await tx<
    {
      id: string;
      folio: string;
      cliente: string;
      estado: string;
      inicio: Dia | null;
      contrato: string | null;
    }[]
  >`
    select o.id, o.folio, o.cliente, o.estado, to_char(o.fecha_inicio, 'YYYY-MM-DD') as inicio,
           f.contrato_original as contrato
    from obras o left join obras_finanzas f on f.obra_id = o.id`;
  const cierres = await tx<{ obra_id: string; dia: Dia; sin_trabajo: boolean }[]>`
    select obra_id, to_char(dia, 'YYYY-MM-DD') as dia, sin_trabajo from bitacora where estado = 'vigente'`;
  const avisos = await tx<{ obra_id: string; creado_en: Date; estado: string; respondido_en: Date | null }[]>`
    select obra_id, creado_en, estado, respondido_en from avisos`;
  const gastos = await tx<{ obra_id: string; monto: string; creado_en: Date; recibo: boolean }[]>`
    select g.obra_id, g.monto, g.creado_en,
           exists (select 1 from fotos f where f.ref_tipo = 'gasto' and f.ref_id = g.id) as recibo
    from gastos g where g.origen = 'pm' and g.estado = 'vigente'`;
  const ordenes = await tx<
    {
      id: string;
      obra_id: string;
      estado: string;
      precio: string | null;
      se_presento: boolean | null;
      faltas: number;
      aprobada: boolean;
    }[]
  >`
    select ot.id, ot.obra_id, ot.estado, p.precio, ot.se_presento, ot.faltas, ot.aprobada_en is not null as aprobada
    from ordenes_trabajo ot left join ordenes_trabajo_precios p on p.orden_trabajo_id = ot.id`;
  const pagos = await tx<{ orden: string; concepto: string; monto: string }[]>`
    select orden_trabajo_id as orden, concepto, monto from pagos_sub where estado = 'vigente'`;
  const inspecciones = await tx<{ resultado: string }[]>`select resultado from inspecciones`;
  const pruebas = await tx<{ resultado: string }[]>`select resultado from pruebas_agua`;
  const punch = await tx<{ estado: string; compromiso: Dia; cerrado: Dia | null }[]>`
    select p.estado, to_char(p.fecha_compromiso, 'YYYY-MM-DD') as compromiso,
           to_char((p.cerrado_en at time zone ${s.zona})::date, 'YYYY-MM-DD') as cerrado
    from punch_list p`;
  const entregas = await tx<{ resena: boolean }[]>`select resena_recibida as resena from entregas`;
  const noCalidad = await tx<{ obra_id: string; tipo: string; costo: string; dias: number }[]>`
    select obra_id, tipo, costo, dias_perdidos as dias from no_calidad`;
  const cambios = await tx<
    { obra_id: string; estado: string; emitida: Date | null; costo: string | null; precio: string | null }[]
  >`
    select oc.obra_id, oc.estado, oc.emitida_en as emitida, m.costo_estimado as costo, m.precio_cliente as precio
    from ordenes_cambio oc left join ordenes_cambio_montos m on m.orden_cambio_id = oc.id`;

  // el cumplimiento del plan de la semana pasada: lo congelado ese lunes contra lo que se terminó
  const lunesPasado = sumarDias(lunesDe(s.hoy), -7);
  const plan = await tx<{ partida: string }[]>`
    select partida_obra_id as partida from plan_semanal where semana = ${lunesPasado}`;
  const terminadas = plan.length
    ? await tx<{ partida: string; fin: Dia }[]>`
        select partida_obra_id as partida, to_char(min(dia), 'YYYY-MM-DD') as fin from avance
        where estado = 'terminada' and estado_registro = 'vigente' and partida_obra_id in ${tx(plan.map((p) => p.partida))}
        group by partida_obra_id`
    : [];
  const real = new Map<string, Real>(terminadas.map((t) => [t.partida, { ini: null, fin: t.fin }]));

  const datos: DatosIndicadores = {
    obras: obras.map((o) => ({
      id: o.id,
      enObra: o.estado === 'en_obra',
      inicio: o.inicio,
      contrato: Number(o.contrato ?? 0),
    })),
    cierres: cierres.map((c) => ({ obraId: c.obra_id, dia: c.dia, conTrabajo: !c.sin_trabajo })),
    cumplimientoSemanaPasada: cumplimientoSemanal(
      plan.map((p) => ({ partidaId: p.partida })),
      real,
      lunesPasado,
      s.calendario,
    ),
    avisos: avisos.map((a) => ({
      obraId: a.obra_id,
      abiertoEn: a.creado_en,
      abierto: a.estado === 'abierto',
      respondidoEn: a.respondido_en,
    })),
    gastosPM: gastos.map((g) => ({
      obraId: g.obra_id,
      monto: Number(g.monto),
      registradoEn: g.creado_en,
      conRecibo: g.recibo,
    })),
    ordenesTrabajo: ordenes.map((o) => ({
      id: o.id,
      obraId: o.obra_id,
      cancelada: o.estado === 'cancelada',
      precio: Number(o.precio ?? 0),
      sePresento: o.se_presento,
      faltas: o.faltas,
      aprobada: o.aprobada,
    })),
    pagosSub: pagos.map((p) => ({
      ordenTrabajoId: p.orden,
      liquidacion: p.concepto === 'liquidacion',
      monto: Number(p.monto),
    })),
    inspecciones: inspecciones.map((i) => ({ conDefectos: i.resultado === 'con_defectos' })),
    pruebasAgua: pruebas.map((p) => ({ conFuga: p.resultado === 'con_fuga' })),
    punch: punch.map((p) => ({
      cerrado: p.estado === 'cerrado',
      compromiso: p.compromiso,
      cerradoEl: p.cerrado,
    })),
    entregas: entregas.map((e) => ({ resenaRecibida: e.resena })),
    noCalidad: noCalidad.map((n) => ({
      obraId: n.obra_id,
      garantia: n.tipo === 'garantia',
      costo: Number(n.costo),
      diasPerdidos: n.dias,
    })),
    ordenesCambio: cambios.map((o) => ({
      obraId: o.obra_id,
      propuesta: o.estado === 'propuesta',
      autorizada: o.estado === 'autorizada' || o.estado === 'facturada',
      emitidaEn: o.emitida,
      costo: Number(o.costo ?? 0),
      precio: Number(o.precio ?? 0),
    })),
  };
  const configuracion = {
    slaAvisosHoras: cfg?.sla_avisos ?? 24,
    slaOrdenesCambioHoras: cfg?.sla_oc ?? 48,
    horasSinRecibo: cfg?.sin_recibo ?? 72,
    margenMinimoOC: Number(cfg?.margen ?? 0.35),
    metas: Object.fromEntries(metas.map((m) => [m.indicador, Number(m.meta)])) as Partial<
      Record<ClaveIndicador, number>
    >,
  };
  const indicadores = calcularIndicadores(datos, configuracion, ahora, s.hoy, s.calendario);
  const obra = new Map(obras.map((o) => [o.id, { folio: o.folio, cliente: o.cliente }]));
  const detalle = Object.fromEntries(
    Object.entries(detallePorObra(datos, configuracion, ahora, s.hoy, s.calendario)).map(([k, xs]) => [
      k,
      xs.filter((x) => obra.has(x.obraId)).map((x) => ({ ...x, ...obra.get(x.obraId)! })),
    ]),
  ) as IndicadoresDeLaEmpresa['detalle'];
  return {
    hoy: s.hoy,
    indicadores,
    detalle,
    obrasEnCurso: obras.filter((o) => o.estado === 'en_obra').length,
    obrasEntregadas: obras.filter((o) => o.estado === 'entregada').length,
  };
}
