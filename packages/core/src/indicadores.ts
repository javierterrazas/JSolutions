// Los 19 indicadores del negocio con sus metas (legacy: admin/servidor.js kpis_).
//
// Cada indicador es un número, una meta y un semáforo. Los textos que explican qué revela cada uno son de la
// pantalla y se traducen (D-015); aquí solo va su clave y sus datos. Las metas tienen un valor por omisión (el del
// legacy) y la empresa puede cambiarlas en metas_indicadores (D-019).
import type { Cumplimiento } from './semana';
import { type Calendario, type Dia, esLaborable, sumarDias } from './fechas';

export type Proceso = 'P3' | 'P4' | 'P5' | 'P6';
export type Direccion = 'mayor' | 'menor' | 'info';
export type Formato = 'pct' | 'num' | 'num1' | 'dinero';
export type Semaforo = 'verde' | 'ambar' | 'rojo' | 'info';

/** Los 19, en el orden en que se muestran. */
export const INDICADORES = [
  'tasa_cierre_dia',
  'cumplimiento_semanal',
  'avisos_fuera_de_sla',
  'horas_respuesta_avisos',
  'cargos_sin_recibo',
  'presentacion_subs',
  'pagos_sin_aprobacion',
  'saldo_subcontratistas',
  'inspecciones_con_defectos',
  'pruebas_agua_con_fuga',
  'punch_por_obra',
  'punch_en_7_dias',
  'garantias_por_obra',
  'resenas',
  'oc_fuera_de_sla',
  'oc_autorizadas',
  'margen_oc',
  'oc_sobre_contratos',
  'no_calidad_sobre_contratos',
] as const;
export type ClaveIndicador = (typeof INDICADORES)[number];

/** Los seis del lunes: lo primero que ve el dueño. */
export const PRINCIPALES: readonly ClaveIndicador[] = [
  'tasa_cierre_dia',
  'avisos_fuera_de_sla',
  'oc_fuera_de_sla',
  'cargos_sin_recibo',
  'saldo_subcontratistas',
  'no_calidad_sobre_contratos',
];

/** Las metas del legacy (sus valores en Config y los fijos en su código). */
export const METAS_POR_OMISION: Readonly<
  Record<Exclude<ClaveIndicador, 'horas_respuesta_avisos' | 'margen_oc'>, number>
> = {
  tasa_cierre_dia: 0.95,
  cumplimiento_semanal: 0.8,
  avisos_fuera_de_sla: 0,
  cargos_sin_recibo: 0,
  presentacion_subs: 0.9,
  pagos_sin_aprobacion: 0,
  saldo_subcontratistas: 0,
  inspecciones_con_defectos: 0,
  pruebas_agua_con_fuga: 0,
  punch_por_obra: 5,
  punch_en_7_dias: 0.9,
  garantias_por_obra: 1,
  resenas: 0.6,
  oc_fuera_de_sla: 0,
  oc_autorizadas: 0.7,
  oc_sobre_contratos: 0.2,
  no_calidad_sobre_contratos: 0.02,
};

export interface Configuracion {
  readonly slaAvisosHoras: number;
  readonly slaOrdenesCambioHoras: number;
  readonly horasSinRecibo: number;
  /** La meta del margen de las órdenes de cambio es el margen mínimo exigido. */
  readonly margenMinimoOC: number;
  /** Las metas que la empresa cambió. */
  readonly metas?: Readonly<Partial<Record<ClaveIndicador, number>>>;
}

/** Todo lo que miden los indicadores, ya leído y convertido. Instantes como Date; días como Dia. */
export interface DatosIndicadores {
  readonly obras: readonly {
    readonly id: string;
    readonly enObra: boolean;
    readonly inicio: Dia | null;
    readonly contrato: number;
  }[];
  readonly cierres: readonly { readonly obraId: string; readonly dia: Dia; readonly conTrabajo: boolean }[];
  /** El cumplimiento de la semana pasada de todas las obras (cumplimientoSemanal). */
  readonly cumplimientoSemanaPasada: Cumplimiento | null;
  readonly avisos: readonly {
    readonly abiertoEn: Date;
    readonly abierto: boolean;
    readonly respondidoEn: Date | null;
  }[];
  /** Solo los gastos del PM: las compras de la oficina no llevan recibo de tarjeta. */
  readonly gastosPM: readonly { readonly registradoEn: Date; readonly conRecibo: boolean }[];
  readonly ordenesTrabajo: readonly {
    readonly id: string;
    readonly cancelada: boolean;
    readonly precio: number;
    readonly sePresento: boolean | null;
    readonly faltas: number;
    readonly aprobada: boolean;
  }[];
  readonly pagosSub: readonly {
    readonly ordenTrabajoId: string;
    readonly liquidacion: boolean;
    readonly monto: number;
  }[];
  readonly inspecciones: readonly { readonly conDefectos: boolean }[];
  readonly pruebasAgua: readonly { readonly conFuga: boolean }[];
  readonly punch: readonly {
    readonly cerrado: boolean;
    readonly compromiso: Dia;
    readonly cerradoEl: Dia | null;
  }[];
  readonly entregas: readonly { readonly resenaRecibida: boolean }[];
  readonly noCalidad: readonly {
    readonly garantia: boolean;
    readonly costo: number;
    readonly diasPerdidos: number;
  }[];
  readonly ordenesCambio: readonly {
    readonly propuesta: boolean;
    readonly autorizada: boolean;
    readonly emitidaEn: Date | null;
    readonly costo: number;
    readonly precio: number;
  }[];
}

export interface Indicador {
  readonly clave: ClaveIndicador;
  readonly proceso: Proceso;
  readonly valor: number;
  readonly meta: number;
  readonly direccion: Direccion;
  readonly formato: Formato;
  readonly semaforo: Semaforo;
  /** Todavía no hay con qué medirlo: el valor es 0 y el semáforo, informativo. */
  readonly sinDatos: boolean;
  readonly principal: boolean;
  /** Lo que la pantalla agrega a la explicación (horas del plazo, costo de garantías, días perdidos). */
  readonly datos?: Readonly<Record<string, number>>;
}

/** El semáforo del legacy: verde en la meta; ámbar cerca (10 % abajo, o 25 % + medio arriba); rojo lejos. */
export function semaforo(valor: number, meta: number, direccion: Direccion): Semaforo {
  if (direccion === 'info') return 'info';
  if (direccion === 'mayor') return valor >= meta ? 'verde' : valor >= meta * 0.9 ? 'ambar' : 'rojo';
  return valor <= meta ? 'verde' : valor <= meta * 1.25 + 0.5 ? 'ambar' : 'rojo';
}

const horasEntre = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3_600_000;
const suma = <T>(xs: readonly T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

/**
 * Tasa de cierre: de los días laborables de la última semana (sin hoy: a las 8 am el cierre de hoy todavía no
 * puede existir), cuántos tuvieron su cierre, por obra en curso y desde su primer día con trabajo. Un día sin
 * trabajo reportado como tal sí cuenta como cierre.
 */
export function tasaDeCierre(
  obras: DatosIndicadores['obras'],
  cierres: DatosIndicadores['cierres'],
  hoy: Dia,
  cal: Calendario,
): { esperados: number; cumplidos: number } {
  const dias = [1, 2, 3, 4, 5, 6, 7].map((i) => sumarDias(hoy, -i)).filter((d) => esLaborable(d, cal));
  const cerrados = new Set(cierres.map((c) => `${c.obraId}|${c.dia}`));
  const primerDia = new Map<string, Dia>();
  for (const c of cierres) {
    if (c.conTrabajo && (!primerDia.has(c.obraId) || c.dia < primerDia.get(c.obraId)!))
      primerDia.set(c.obraId, c.dia);
  }
  let esperados = 0;
  let cumplidos = 0;
  for (const o of obras.filter((x) => x.enObra)) {
    const desde = primerDia.get(o.id) ?? o.inicio;
    for (const d of dias) {
      if (desde && d < desde) continue;
      esperados++;
      if (cerrados.has(`${o.id}|${d}`)) cumplidos++;
    }
  }
  return { esperados, cumplidos };
}

/** Horas de respuesta de un aviso, con un decimal, como las guardaba el legacy al responder. */
export const horasDeRespuesta = (abiertoEn: Date, respondidoEn: Date) =>
  Math.round(horasEntre(abiertoEn, respondidoEn) * 10) / 10;

/** Los 19 indicadores, a la hora `ahora` y el día `hoy` de la empresa. */
export function calcularIndicadores(
  d: DatosIndicadores,
  cfg: Configuracion,
  ahora: Date,
  hoy: Dia,
  cal: Calendario,
): Indicador[] {
  const meta = (k: keyof typeof METAS_POR_OMISION) => cfg.metas?.[k] ?? METAS_POR_OMISION[k];
  const out: Indicador[] = [];
  const agregar = (
    clave: ClaveIndicador,
    proceso: Proceso,
    valor: number,
    m: number,
    direccion: Direccion,
    formato: Formato,
    sinDatos = false,
    datos?: Record<string, number>,
  ) =>
    out.push({
      clave,
      proceso,
      valor: sinDatos ? 0 : valor,
      meta: m,
      direccion,
      formato,
      semaforo: sinDatos ? 'info' : semaforo(valor, m, direccion),
      sinDatos,
      principal: PRINCIPALES.includes(clave),
      ...(datos ? { datos } : {}),
    });

  // ---------------------------------------------------------------- P3: control diario
  const tasa = tasaDeCierre(d.obras, d.cierres, hoy, cal);
  agregar(
    'tasa_cierre_dia',
    'P3',
    tasa.esperados ? tasa.cumplidos / tasa.esperados : 0,
    meta('tasa_cierre_dia'),
    'mayor',
    'pct',
    !tasa.esperados,
  );
  const ppc = d.cumplimientoSemanaPasada;
  agregar('cumplimiento_semanal', 'P3', ppc?.ppc ?? 0, meta('cumplimiento_semanal'), 'mayor', 'pct', !ppc);
  agregar(
    'avisos_fuera_de_sla',
    'P3',
    d.avisos.filter((a) => a.abierto && horasEntre(a.abiertoEn, ahora) > cfg.slaAvisosHoras).length,
    meta('avisos_fuera_de_sla'),
    'menor',
    'num',
    false,
    { slaHoras: cfg.slaAvisosHoras },
  );
  const respuestas = d.avisos
    .filter((a) => a.respondidoEn)
    .map((a) => horasDeRespuesta(a.abiertoEn, a.respondidoEn!))
    .filter((h) => h > 0);
  agregar(
    'horas_respuesta_avisos',
    'P3',
    respuestas.length ? suma(respuestas, (h) => h) / respuestas.length : 0,
    cfg.metas?.horas_respuesta_avisos ?? cfg.slaAvisosHoras,
    'menor',
    'num1',
  );
  agregar(
    'cargos_sin_recibo',
    'P3',
    d.gastosPM.filter((g) => !g.conRecibo && horasEntre(g.registradoEn, ahora) > cfg.horasSinRecibo).length,
    meta('cargos_sin_recibo'),
    'menor',
    'num',
    false,
    { horas: cfg.horasSinRecibo },
  );
  // de las órdenes cuyo día de arranque ya se registró (llegó, no llegó o faltó al reprogramar)
  const conRegistro = d.ordenesTrabajo.filter((o) => o.sePresento !== null || o.faltas > 0);
  const presentados = conRegistro.filter((o) => o.sePresento === true).length;
  const oportunidades = suma(d.ordenesTrabajo, (o) => (o.sePresento !== null ? 1 : 0) + o.faltas);
  agregar(
    'presentacion_subs',
    'P3',
    oportunidades ? presentados / oportunidades : 0,
    meta('presentacion_subs'),
    'mayor',
    'pct',
    !conRegistro.length,
  );
  const ordenes = new Map(d.ordenesTrabajo.map((o) => [o.id, o]));
  agregar(
    'pagos_sin_aprobacion',
    'P3',
    d.pagosSub.filter((p) => p.liquidacion && !ordenes.get(p.ordenTrabajoId)?.aprobada).length,
    meta('pagos_sin_aprobacion'),
    'menor',
    'num',
  );
  agregar(
    'saldo_subcontratistas',
    'P3',
    suma(
      d.ordenesTrabajo.filter((o) => !o.cancelada),
      (o) => o.precio,
    ) - suma(d.pagosSub, (p) => p.monto),
    meta('saldo_subcontratistas'),
    'info',
    'dinero',
  );

  // ---------------------------------------------------------------- P5: calidad
  agregar(
    'inspecciones_con_defectos',
    'P5',
    d.inspecciones.filter((i) => i.conDefectos).length,
    meta('inspecciones_con_defectos'),
    'menor',
    'num',
  );
  agregar(
    'pruebas_agua_con_fuga',
    'P5',
    d.pruebasAgua.filter((p) => p.conFuga).length,
    meta('pruebas_agua_con_fuga'),
    'menor',
    'num',
  );

  // ---------------------------------------------------------------- P6: entrega y garantía
  const entregadas = d.entregas.length;
  agregar(
    'punch_por_obra',
    'P6',
    entregadas ? d.punch.length / entregadas : 0,
    meta('punch_por_obra'),
    'menor',
    'num1',
  );
  const cerrados = d.punch.filter((p) => p.cerrado);
  const aTiempo = cerrados.filter((p) => p.cerradoEl && p.cerradoEl <= p.compromiso).length;
  agregar(
    'punch_en_7_dias',
    'P6',
    cerrados.length ? aTiempo / cerrados.length : 1,
    meta('punch_en_7_dias'),
    'mayor',
    'pct',
  );
  const garantias = d.noCalidad.filter((n) => n.garantia);
  const contratos = suma(d.obras, (o) => o.contrato);
  const costoGarantias = suma(garantias, (g) => g.costo);
  agregar(
    'garantias_por_obra',
    'P6',
    entregadas ? garantias.length / entregadas : 0,
    meta('garantias_por_obra'),
    'menor',
    'num1',
    false,
    costoGarantias
      ? { costo: costoGarantias, ...(contratos ? { sobreContratos: costoGarantias / contratos } : {}) }
      : undefined,
  );
  agregar(
    'resenas',
    'P6',
    entregadas ? d.entregas.filter((e) => e.resenaRecibida).length / entregadas : 0,
    meta('resenas'),
    'mayor',
    'pct',
  );

  // ---------------------------------------------------------------- P4: órdenes de cambio
  const oc = d.ordenesCambio;
  agregar(
    'oc_fuera_de_sla',
    'P4',
    oc.filter((o) => o.propuesta && o.emitidaEn && horasEntre(o.emitidaEn, ahora) > cfg.slaOrdenesCambioHoras)
      .length,
    meta('oc_fuera_de_sla'),
    'menor',
    'num',
    false,
    { slaHoras: cfg.slaOrdenesCambioHoras },
  );
  agregar(
    'oc_autorizadas',
    'P4',
    oc.length ? oc.filter((o) => o.autorizada).length / oc.length : 0,
    meta('oc_autorizadas'),
    'mayor',
    'pct',
  );
  const precioOC = suma(oc, (o) => o.precio);
  const costoOC = suma(oc, (o) => o.costo);
  agregar(
    'margen_oc',
    'P4',
    precioOC ? 1 - costoOC / precioOC : 0,
    cfg.metas?.margen_oc ?? cfg.margenMinimoOC,
    'mayor',
    'pct',
  );
  agregar(
    'oc_sobre_contratos',
    'P4',
    contratos ? precioOC / contratos : 0,
    meta('oc_sobre_contratos'),
    'menor',
    'pct',
  );
  const diasPerdidos = suma(d.noCalidad, (n) => n.diasPerdidos);
  agregar(
    'no_calidad_sobre_contratos',
    'P4',
    contratos ? suma(d.noCalidad, (n) => n.costo) / contratos : 0,
    meta('no_calidad_sobre_contratos'),
    'menor',
    'pct',
    false,
    diasPerdidos ? { diasPerdidos } : undefined,
  );
  return out;
}
