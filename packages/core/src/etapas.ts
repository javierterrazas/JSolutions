// Presupuesto y costos por etapa (legacy: admin/servidor.js etapasDeArea_, presupuestoPorEtapa_,
// guardarPresupuesto_, presupuestoCompleto_, duDetalleObra, costosUnitarios_).
//
// El dueño cotiza por fuera y captura un COSTO esperado por etapa (= tipo de trabajo: demolición, plomería,
// tile…) y por espacio, no un renglón por partida. El PM registra por partida y el sistema suma sus costos por
// etapa: ahí los errores de asignación del campo (tile contra lechada) se compensan y el desvío sí dice algo.
// Una partida sin etapa cae en "Otras partidas" (etapa nula). Montos en dólares.
import { ErrorDeNegocio } from './errores';

/** La clave de una etapa de un espacio. etapaId nulo = "Otras partidas". */
export const claveEtapa = (espacioId: string, etapaId: string | null) => `${espacioId}|${etapaId ?? ''}`;

export interface EspacioEtapas {
  readonly id: string;
  readonly generales: boolean;
  readonly tipoEspacioId: string;
  /** Los pies² vigentes: los verificados si existen, si no los cotizados (D-014). */
  readonly pies2: number;
  /** Las partidas activas, en orden. */
  readonly partidas: readonly { readonly id: string; readonly etapaId: string | null }[];
}

export interface EtapaDeEspacio {
  readonly etapaId: string | null;
  readonly partidas: readonly string[];
}

/** Las etapas de un espacio en orden de trabajo (la de su primera partida), con sus partidas. */
export function etapasDeEspacio(espacio: EspacioEtapas): EtapaDeEspacio[] {
  const out: { etapaId: string | null; partidas: string[] }[] = [];
  for (const p of espacio.partidas) {
    let e = out.find((x) => x.etapaId === p.etapaId);
    if (!e) out.push((e = { etapaId: p.etapaId, partidas: [] }));
    e.partidas.push(p.id);
  }
  return out;
}

// ------------------------------------------------------------------ el presupuesto
export interface LineaPresupuesto {
  readonly espacioId: string;
  readonly etapaId: string | null;
  readonly monto: number;
}

/**
 * Valida y normaliza el presupuesto que captura el dueño: una línea por espacio y etapa (si llegan dos, se suman),
 * sin montos en cero. Errores: `monto_negativo`, `etapa_no_es_del_espacio`.
 */
export function normalizarPresupuesto(
  espacios: readonly EspacioEtapas[],
  lineas: readonly LineaPresupuesto[],
): LineaPresupuesto[] {
  const validas = new Set(
    espacios.flatMap((e) => etapasDeEspacio(e).map((x) => claveEtapa(e.id, x.etapaId))),
  );
  const suma = new Map<string, LineaPresupuesto>();
  for (const l of lineas) {
    const monto = Number(l.monto) || 0;
    if (monto < 0) throw new ErrorDeNegocio('monto_negativo', { espacio: l.espacioId, etapa: l.etapaId });
    if (!monto) continue;
    const k = claveEtapa(l.espacioId, l.etapaId);
    if (!validas.has(k))
      throw new ErrorDeNegocio('etapa_no_es_del_espacio', { espacio: l.espacioId, etapa: l.etapaId });
    suma.set(k, { espacioId: l.espacioId, etapaId: l.etapaId, monto: (suma.get(k)?.monto ?? 0) + monto });
  }
  return [...suma.values()];
}

/**
 * El presupuesto antiguo del legacy, por partida, convertido a su etapa (D-004). Lo usa el importador de la fase
 * 3. Una partida que ya no existe en el espacio cae en "Otras partidas".
 */
export function presupuestoDesdePartidas(
  espacios: readonly EspacioEtapas[],
  lineas: readonly { readonly espacioId: string; readonly partidaId: string; readonly monto: number }[],
): LineaPresupuesto[] {
  const etapaDe = new Map(
    espacios.flatMap((e) => e.partidas.map((p) => [`${e.id}|${p.id}`, p.etapaId] as const)),
  );
  const suma = new Map<string, LineaPresupuesto>();
  for (const l of lineas) {
    const etapaId = etapaDe.get(`${l.espacioId}|${l.partidaId}`) ?? null;
    const k = claveEtapa(l.espacioId, etapaId);
    suma.set(k, {
      espacioId: l.espacioId,
      etapaId,
      monto: (suma.get(k)?.monto ?? 0) + (Number(l.monto) || 0),
    });
  }
  return [...suma.values()];
}

/**
 * Presupuesto completo: cada espacio (menos Generales) con al menos una etapa con monto. Sin eso no hay desvío ni
 * costos unitarios, y la obra no puede arrancar.
 */
export function presupuestoCompleto(
  espacios: readonly Pick<EspacioEtapas, 'id' | 'generales'>[],
  lineas: readonly LineaPresupuesto[],
): { completo: boolean; faltan: string[] } {
  const conMonto = lineas.filter((l) => l.monto > 0);
  const faltan = espacios
    .filter((e) => !e.generales && !conMonto.some((l) => l.espacioId === e.id))
    .map((e) => e.id);
  return { completo: !faltan.length && conMonto.length > 0, faltan };
}

// ------------------------------------------------------------------ los costos reales
export type Cubo = 'material' | 'cuadrilla' | 'sub';

/** Un costo de la obra: un gasto, horas de cuadrilla ya valuadas, o una orden de trabajo vigente. */
export interface Cargo {
  readonly espacioId: string;
  /** Nulo si no se asignó a una partida: cae en "Otras partidas" de su espacio. */
  readonly partidaId: string | null;
  readonly cubo: Cubo;
  readonly monto: number;
}

export interface Tarifa {
  readonly trabajadorId: string;
  readonly tarifa: number;
  readonly vigenteDesde: string;
}

/**
 * La tarifa de un trabajador el día que trabajó: la última vigente a esa fecha. Así un aumento no cambia el costo
 * de lo pasado. (El legacy usaba siempre la tarifa de hoy: D-031.)
 */
export function tarifaDelDia(tarifas: readonly Tarifa[], trabajadorId: string, dia: string): number {
  let mejor: Tarifa | undefined;
  for (const t of tarifas) {
    if (t.trabajadorId !== trabajadorId || t.vigenteDesde > dia) continue;
    if (!mejor || t.vigenteDesde > mejor.vigenteDesde) mejor = t;
  }
  return mejor?.tarifa ?? 0;
}

export interface CostoEtapa {
  readonly espacioId: string;
  readonly etapaId: string | null;
  readonly generales: boolean;
  readonly material: number;
  readonly cuadrilla: number;
  readonly sub: number;
  readonly total: number;
  readonly presupuesto: number;
  /** Cuánto se pasó (o le faltó) del presupuesto, como fracción; nulo sin presupuesto. */
  readonly desvio: number | null;
  /** Costo real por pie²; nulo en Generales o sin pies². */
  readonly unitario: number | null;
  readonly unitarioPresupuesto: number | null;
  /** Las partidas que costaron algo, de la más cara a la más barata. */
  readonly partidas: readonly { readonly partidaId: string | null; readonly total: number }[];
}

/** Los costos de una obra por espacio y etapa, contra su presupuesto. Solo las etapas con costo o presupuesto. */
export function costosPorEtapa(
  espacios: readonly EspacioEtapas[],
  cargos: readonly Cargo[],
  presupuesto: readonly LineaPresupuesto[],
): CostoEtapa[] {
  const etapaDe = new Map(
    espacios.flatMap((e) => e.partidas.map((p) => [`${e.id}|${p.id}`, p.etapaId] as const)),
  );
  const espacio = new Map(espacios.map((e) => [e.id, e]));
  type Acum = { espacioId: string; etapaId: string | null; material: number; cuadrilla: number; sub: number };
  const acum = new Map<string, Acum & { partidas: Map<string | null, number> }>();
  const nueva = (espacioId: string, etapaId: string | null) => {
    const k = claveEtapa(espacioId, etapaId);
    let x = acum.get(k);
    if (!x) acum.set(k, (x = { espacioId, etapaId, material: 0, cuadrilla: 0, sub: 0, partidas: new Map() }));
    return x;
  };
  for (const e of espacios) for (const et of etapasDeEspacio(e)) nueva(e.id, et.etapaId);
  for (const c of cargos) {
    const etapaId = c.partidaId ? (etapaDe.get(`${c.espacioId}|${c.partidaId}`) ?? null) : null;
    const x = nueva(c.espacioId, etapaId);
    x[c.cubo] += c.monto;
    x.partidas.set(c.partidaId, (x.partidas.get(c.partidaId) ?? 0) + c.monto);
  }
  const presu = new Map(presupuesto.map((l) => [claveEtapa(l.espacioId, l.etapaId), l.monto]));
  return [...acum.entries()]
    .map(([k, x]) => {
      const esp = espacio.get(x.espacioId);
      const generales = !!esp?.generales;
      const cantidad = generales ? 1 : (esp?.pies2 ?? 0);
      const total = x.material + x.cuadrilla + x.sub;
      const p = presu.get(k) ?? 0;
      return {
        espacioId: x.espacioId,
        etapaId: x.etapaId,
        generales,
        material: x.material,
        cuadrilla: x.cuadrilla,
        sub: x.sub,
        total,
        presupuesto: p,
        desvio: p ? (total - p) / p : null,
        unitario: !generales && cantidad ? total / cantidad : null,
        unitarioPresupuesto: !generales && cantidad && p ? p / cantidad : null,
        partidas: [...x.partidas.entries()]
          .filter(([, t]) => t)
          .map(([partidaId, t]) => ({ partidaId, total: t }))
          .sort((a, b) => b.total - a.total),
      };
    })
    .filter((y) => y.total || y.presupuesto);
}

// ------------------------------------------------------------------ costos unitarios históricos
export interface ObraParaHistorico {
  readonly id: string;
  readonly cerrada: boolean;
  readonly espacios: readonly EspacioEtapas[];
  readonly presupuesto: readonly LineaPresupuesto[];
  readonly cargos: readonly Cargo[];
  /** Las partidas que ya se terminaron. */
  readonly terminadas: ReadonlySet<string>;
}

export interface CostoUnitario {
  readonly tipoEspacioId: string;
  readonly etapaId: string | null;
  readonly n: number;
  readonly promedio: number;
  readonly minimo: number;
  readonly maximo: number;
  readonly promedioPresupuesto: number;
  readonly detalle: readonly {
    readonly obraId: string;
    readonly unitario: number;
    readonly pies2: number;
    readonly costo: number;
    readonly presupuesto: number;
  }[];
}

/**
 * El costo real por pie² de cada tipo de espacio y etapa, con TUS obras: es de donde se aprende a cotizar. Una
 * etapa entra cuando todas sus partidas están terminadas en su espacio, o cuando la obra ya cerró; una en curso
 * subestimaría el costo. Solo espacios con pies², no Generales.
 */
export function costosUnitarios(obras: readonly ObraParaHistorico[]): CostoUnitario[] {
  const acum = new Map<
    string,
    { tipoEspacioId: string; etapaId: string | null; vals: CostoUnitario['detalle'][number][] }
  >();
  for (const obra of obras) {
    if (!obra.presupuesto.length) continue;
    const real = new Map<string, number>();
    for (const c of obra.cargos) {
      if (!c.partidaId) continue;
      const k = `${c.espacioId}|${c.partidaId}`;
      real.set(k, (real.get(k) ?? 0) + c.monto);
    }
    const presu = new Map(obra.presupuesto.map((l) => [claveEtapa(l.espacioId, l.etapaId), l.monto]));
    for (const esp of obra.espacios.filter((e) => !e.generales && e.pies2 > 0)) {
      for (const et of etapasDeEspacio(esp)) {
        if (!obra.cerrada && !et.partidas.every((p) => obra.terminadas.has(p))) continue;
        const costo = et.partidas.reduce((s, p) => s + (real.get(`${esp.id}|${p}`) ?? 0), 0);
        if (!costo) continue;
        const k = `${esp.tipoEspacioId}|${et.etapaId ?? ''}`;
        const x = acum.get(k) ?? { tipoEspacioId: esp.tipoEspacioId, etapaId: et.etapaId, vals: [] };
        x.vals.push({
          obraId: obra.id,
          unitario: costo / esp.pies2,
          pies2: esp.pies2,
          costo,
          presupuesto: (presu.get(claveEtapa(esp.id, et.etapaId)) ?? 0) / esp.pies2,
        });
        acum.set(k, x);
      }
    }
  }
  return [...acum.values()].map((x) => {
    const u = x.vals.map((v) => v.unitario);
    return {
      tipoEspacioId: x.tipoEspacioId,
      etapaId: x.etapaId,
      n: u.length,
      promedio: u.reduce((a, b) => a + b, 0) / u.length,
      minimo: Math.min(...u),
      maximo: Math.max(...u),
      promedioPresupuesto: x.vals.reduce((a, v) => a + v.presupuesto, 0) / u.length,
      detalle: x.vals,
    };
  });
}

/** El monto que el histórico sugiere para una etapa: costo unitario promedio por los pies² del espacio. */
export const montoSugerido = (unitarioPromedio: number, pies2: number): number =>
  Math.round(unitarioPromedio * pies2);
