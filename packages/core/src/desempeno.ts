// El desempeño de un manager (D-106): los números que dicen cómo lleva sus obras, en cuatro grupos (disciplina,
// plazos, dinero y calidad), en un periodo, y los mismos de toda la empresa para compararlos. Se miden por día, por
// obra o por registro, no en totales, para que un PM con obras grandes no salga peor solo por tamaño. Con pocos datos
// el número se muestra pero no se califica: un rojo injusto al principio hace más daño que no tener semáforo.
import { type Calendario, type Dia, domingoDe, esLaborable, lunesDe, sumarDias } from './fechas';
import { type Direccion, type Formato, METAS_POR_OMISION, type Semaforo, semaforo } from './indicadores';

export const METRICAS_PM = [
  'cierre_a_tiempo',
  'segundos_cierre',
  'gastos_con_recibo',
  'atraso',
  'cumplimiento_semanal',
  'presupuesto_en_rojo',
  'inspecciones_a_la_primera',
  'punch_a_tiempo',
  'pruebas_con_fuga',
  'retrabajos',
] as const;
export type MetricaPM = (typeof METRICAS_PM)[number];

export const GRUPOS_PM = {
  disciplina: ['cierre_a_tiempo', 'segundos_cierre', 'gastos_con_recibo'],
  plazos: ['atraso', 'cumplimiento_semanal'],
  dinero: ['presupuesto_en_rojo'],
  calidad: ['inspecciones_a_la_primera', 'punch_a_tiempo', 'pruebas_con_fuga', 'retrabajos'],
} as const satisfies Record<string, readonly MetricaPM[]>;

/** Las metas propias del desempeño; las demás salen de los indicadores de la empresa (D-019). */
export const METAS_PM = {
  segundos_cierre: 60,
  gastos_con_recibo: 1,
  atraso: 0,
  presupuesto_en_rojo: 0,
  inspecciones_a_la_primera: 0.9,
  pruebas_con_fuga: 0,
  retrabajos: 0,
} as const;

/** Lo que mide el desempeño, de todas las obras de la empresa. Días en la zona de la empresa. */
export interface DatosDesempeno {
  readonly obras: readonly {
    readonly id: string;
    readonly enCurso: boolean;
    readonly inicio: Dia | null;
    /** El día en que se entregó; null si no se ha entregado. */
    readonly entregada: Dia | null;
    /** Días de atraso previstos (solo las que van en curso). */
    readonly atraso: number | null;
    /** El semáforo del presupuesto está en rojo (solo las en curso con presupuesto). */
    readonly presupuestoEnRojo: boolean | null;
  }[];
  readonly cierres: readonly {
    readonly obraId: string;
    readonly dia: Dia;
    readonly tardio: boolean;
    /** Cuánto tardó el PM en capturarlo (D-101); null en los de antes. */
    readonly segundos: number | null;
  }[];
  readonly gastos: readonly { readonly obraId: string; readonly dia: Dia; readonly conRecibo: boolean }[];
  /** Lo que se congeló en el plan de cada semana y si se terminó a más tardar el domingo. */
  readonly plan: readonly { readonly obraId: string; readonly semana: Dia; readonly hecho: boolean }[];
  /** Todas, en el orden en que se hicieron. */
  readonly inspecciones: readonly {
    readonly obraId: string;
    readonly espacioId: string;
    readonly hitoId: string;
    readonly dia: Dia;
    readonly aprobada: boolean;
  }[];
  readonly punch: readonly {
    readonly obraId: string;
    readonly compromiso: Dia;
    readonly cerradoEl: Dia | null;
  }[];
  readonly pruebas: readonly { readonly obraId: string; readonly dia: Dia; readonly conFuga: boolean }[];
  readonly noCalidad: readonly { readonly obraId: string; readonly dia: Dia; readonly costo: number }[];
}

export interface MetricaDeDesempeno {
  readonly clave: MetricaPM;
  /** Null si no hay con qué medirlo. */
  readonly valor: number | null;
  readonly meta: number;
  readonly direccion: Direccion;
  readonly formato: Formato;
  /** 'info' sin datos o con pocos datos. */
  readonly semaforo: Semaforo;
  readonly pocosDatos: boolean;
  /** Los números detrás (cuántos días, cuántos tardíos…), para la explicación. */
  readonly datos: Readonly<Record<string, number>>;
}

const mediana = (xs: readonly number[]) => {
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2;
};

/**
 * El desempeño de las obras de `obras` (las de un PM, o todas para el promedio de la empresa) del día `desde` a hoy.
 * `metas` son las de la empresa en metas_indicadores.
 */
export function desempeno(
  d: DatosDesempeno,
  obras: ReadonlySet<string>,
  desde: Dia,
  hoy: Dia,
  cal: Calendario,
  metas: Readonly<Partial<Record<string, number>>> = {},
): MetricaDeDesempeno[] {
  const ayer = sumarDias(hoy, -1);
  const enPeriodo = (dia: Dia) => dia >= desde && dia <= hoy;
  const suyas = <T extends { obraId: string }>(xs: readonly T[]) => xs.filter((x) => obras.has(x.obraId));
  const out: MetricaDeDesempeno[] = [];
  const agregar = (
    clave: MetricaPM,
    valor: number | null,
    meta: number,
    direccion: Direccion,
    formato: Formato,
    pocos: boolean,
    datos: Record<string, number>,
  ) =>
    out.push({
      clave,
      valor,
      meta,
      direccion,
      formato,
      semaforo: valor === null || pocos ? 'info' : semaforo(valor, meta, direccion),
      pocosDatos: valor !== null && pocos,
      datos,
    });

  // ---------------------------------------------------------------- disciplina
  // cada día laborable en que la obra estaba en marcha (desde su primer cierre, o su inicio si ya arrancó, hasta su
  // entrega o ayer): cerrado a tiempo, tarde, o no cerrado
  const cierres = suyas(d.cierres);
  const porDia = new Map(cierres.map((c) => [`${c.obraId}|${c.dia}`, c]));
  let esperados = 0;
  let aTiempo = 0;
  let tardios = 0;
  for (const o of d.obras.filter((x) => obras.has(x.id))) {
    const primero = cierres
      .filter((c) => c.obraId === o.id)
      .reduce<Dia | null>((a, c) => (a === null || c.dia < a ? c.dia : a), null);
    const inicio = primero ?? (o.enCurso ? o.inicio : null);
    if (!inicio) continue;
    const fin = o.entregada ?? (o.enCurso ? ayer : null);
    if (!fin) continue;
    for (let dia = inicio > desde ? inicio : desde; dia <= fin && dia <= ayer; dia = sumarDias(dia, 1)) {
      if (!esLaborable(dia, cal)) continue;
      esperados++;
      const c = porDia.get(`${o.id}|${dia}`);
      if (c && !c.tardio) aTiempo++;
      else if (c) tardios++;
    }
  }
  agregar(
    'cierre_a_tiempo',
    esperados ? aTiempo / esperados : null,
    metas.tasa_cierre_dia ?? METAS_POR_OMISION.tasa_cierre_dia,
    'mayor',
    'pct',
    esperados < 10,
    { esperados, aTiempo, tardios, olvidados: esperados - aTiempo - tardios },
  );
  const segundos = cierres.filter((c) => enPeriodo(c.dia) && c.segundos !== null).map((c) => c.segundos!);
  agregar(
    'segundos_cierre',
    segundos.length ? mediana(segundos) : null,
    METAS_PM.segundos_cierre,
    'menor',
    'num',
    segundos.length < 5,
    { cierres: segundos.length },
  );
  const gastos = suyas(d.gastos).filter((g) => enPeriodo(g.dia));
  const conRecibo = gastos.filter((g) => g.conRecibo).length;
  agregar(
    'gastos_con_recibo',
    gastos.length ? conRecibo / gastos.length : null,
    METAS_PM.gastos_con_recibo,
    'mayor',
    'pct',
    gastos.length < 3,
    { gastos: gastos.length, sinRecibo: gastos.length - conRecibo },
  );

  // ---------------------------------------------------------------- plazos
  const enCurso = d.obras.filter((o) => obras.has(o.id) && o.enCurso && o.atraso !== null);
  const atrasos = enCurso.map((o) => Math.max(0, o.atraso!));
  agregar(
    'atraso',
    atrasos.length ? atrasos.reduce((a, x) => a + x, 0) / atrasos.length : null,
    METAS_PM.atraso,
    'menor',
    'num1',
    false,
    { obras: atrasos.length, tarde: atrasos.filter((x) => x > 0).length },
  );
  // solo las semanas que ya terminaron
  const plan = suyas(d.plan).filter((p) => p.semana >= lunesDe(desde) && domingoDe(p.semana) < hoy);
  const hechas = plan.filter((p) => p.hecho).length;
  agregar(
    'cumplimiento_semanal',
    plan.length ? hechas / plan.length : null,
    metas.cumplimiento_semanal ?? METAS_POR_OMISION.cumplimiento_semanal,
    'mayor',
    'pct',
    plan.length < 5,
    { plan: plan.length, hechas },
  );

  // ---------------------------------------------------------------- dinero
  const conPresupuesto = d.obras.filter((o) => obras.has(o.id) && o.enCurso && o.presupuestoEnRojo !== null);
  const enRojo = conPresupuesto.filter((o) => o.presupuestoEnRojo).length;
  agregar(
    'presupuesto_en_rojo',
    conPresupuesto.length ? enRojo / conPresupuesto.length : null,
    METAS_PM.presupuesto_en_rojo,
    'menor',
    'pct',
    false,
    { obras: conPresupuesto.length, enRojo },
  );

  // ---------------------------------------------------------------- calidad
  // a la primera: la primera inspección de cada punto en cada espacio, si fue en el periodo
  const primeras = new Map<string, DatosDesempeno['inspecciones'][number]>();
  for (const i of suyas(d.inspecciones)) {
    const k = `${i.obraId}|${i.espacioId}|${i.hitoId}`;
    if (!primeras.has(k)) primeras.set(k, i);
  }
  const delPeriodo = [...primeras.values()].filter((i) => enPeriodo(i.dia));
  const aLaPrimera = delPeriodo.filter((i) => i.aprobada).length;
  agregar(
    'inspecciones_a_la_primera',
    delPeriodo.length ? aLaPrimera / delPeriodo.length : null,
    METAS_PM.inspecciones_a_la_primera,
    'mayor',
    'pct',
    delPeriodo.length < 3,
    { inspecciones: delPeriodo.length, aprobadas: aLaPrimera },
  );
  const punch = suyas(d.punch);
  const cerrados = punch.filter((p) => p.cerradoEl && enPeriodo(p.cerradoEl));
  const cerradosATiempo = cerrados.filter((p) => p.cerradoEl! <= p.compromiso).length;
  agregar(
    'punch_a_tiempo',
    cerrados.length ? cerradosATiempo / cerrados.length : null,
    metas.punch_en_7_dias ?? METAS_POR_OMISION.punch_en_7_dias,
    'mayor',
    'pct',
    cerrados.length < 3,
    {
      cerrados: cerrados.length,
      aTiempo: cerradosATiempo,
      vencidos: punch.filter((p) => !p.cerradoEl && p.compromiso < hoy).length,
    },
  );
  const pruebas = suyas(d.pruebas).filter((p) => enPeriodo(p.dia));
  agregar(
    'pruebas_con_fuga',
    pruebas.length ? pruebas.filter((p) => p.conFuga).length : null,
    METAS_PM.pruebas_con_fuga,
    'menor',
    'num',
    false,
    { pruebas: pruebas.length },
  );
  const retrabajos = suyas(d.noCalidad).filter((n) => enPeriodo(n.dia));
  agregar('retrabajos', obras.size ? retrabajos.length : null, METAS_PM.retrabajos, 'menor', 'num', false, {
    costo: retrabajos.reduce((a, n) => a + n.costo, 0),
  });
  return out;
}
