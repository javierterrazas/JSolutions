// Lo que cuesta cada etapa según el tamaño del espacio (D-095; lo pidió el dueño): unas crecen con los pies² (tile,
// pintura), otras con los pies lineales (gabinetes, countertop) y otras cuestan casi lo mismo en un espacio chico que
// en uno grande (plomería, appliances). Con las etapas de las obras cerradas:
//   costo = base + tarifa × medida   (mínimos cuadrados, por tipo de espacio y etapa)
// De ahí sale qué tanto depende del tamaño, cuánto sube el presupuesto por cada 10 unidades más (las que más mueven
// el precio) y el costo que se sugiere al cotizar. Con pocas obras, o todas del mismo tamaño, no se ajusta: se usa la
// mediana del costo por unidad (o por espacio, si la etapa es fija).

export const UNIDADES_ETAPA = ['pie2', 'pie_lineal', 'fijo'] as const;
/** Cómo se cotiza una etapa: por pie², por pie lineal, o fija por espacio. */
export type UnidadEtapa = (typeof UNIDADES_ETAPA)[number];
export type Medida = 'pie2' | 'pie_lineal';

/** Una etapa de un espacio de una obra cerrada. */
export interface MuestraEtapa {
  readonly tipoEspacioId: string;
  readonly etapaId: string | null;
  readonly costo: number;
  readonly pies2: number;
  readonly piesLineales: number;
}

export interface AjusteEtapa {
  readonly medida: Medida;
  readonly base: number;
  readonly tarifa: number;
  /** Qué tan bien explica la medida el costo (0 a 1). */
  readonly r2: number;
  /** La parte del costo típico que crece con el tamaño (0 a 1): la tarifa por la medida típica, entre el costo típico. */
  readonly parteDelTamano: number;
  /** Cuánto sube el costo por cada 10 unidades más de la medida. */
  readonly por10: number;
}

export interface AnalisisEtapa {
  readonly tipoEspacioId: string;
  readonly etapaId: string | null;
  /** Cómo se cotiza hoy. */
  readonly unidad: UnidadEtapa;
  /** Cuántas veces se ha cerrado (espacios). */
  readonly n: number;
  /** La mediana del costo por espacio. */
  readonly costoTipico: number;
  /** La mediana del costo por su unidad; null si es fija o no hay medidas. */
  readonly porUnidad: number | null;
  /** Base + tarifa con la medida que mejor explica el costo; null con pocos datos o tamaños parecidos. */
  readonly ajuste: AjusteEtapa | null;
  /** Si los datos dicen que conviene cotizarla de otra forma; null si la de hoy está bien o no se sabe. */
  readonly sugerida: UnidadEtapa | null;
}

/** Las obras que hacen falta para ajustar base + tarifa, y lo distintos que tienen que ser sus tamaños. */
export const MINIMO_PARA_AJUSTE = 5;
const VARIACION_MINIMA = 0.15;

const mediana = (v: readonly number[]): number => {
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2;
};

/** Mínimos cuadrados de costo contra medida; null si los tamaños no varían lo suficiente. */
export function ajustarEtapa(
  puntos: readonly { readonly x: number; readonly y: number }[],
  medida: Medida,
): AjusteEtapa | null {
  const p = puntos.filter((q) => q.x > 0);
  if (p.length < MINIMO_PARA_AJUSTE) return null;
  const n = p.length;
  const mx = p.reduce((a, q) => a + q.x, 0) / n;
  const my = p.reduce((a, q) => a + q.y, 0) / n;
  const sxx = p.reduce((a, q) => a + (q.x - mx) ** 2, 0);
  const sxy = p.reduce((a, q) => a + (q.x - mx) * (q.y - my), 0);
  const syy = p.reduce((a, q) => a + (q.y - my) ** 2, 0);
  // todos del mismo tamaño: no se puede saber qué parte es fija
  if (!mx || Math.sqrt(sxx / n) / mx < VARIACION_MINIMA) return null;
  // la tarifa no es negativa: un espacio más grande no cuesta menos
  const tarifa = Math.max(0, sxy / sxx);
  const base = my - tarifa * mx;
  const r2 = syy ? Math.min(1, (sxy > 0 ? sxy * sxy : 0) / (sxx * syy)) : 0;
  const parte = my ? Math.min(1, Math.max(0, (tarifa * mx) / my)) : 0;
  return { medida, base, tarifa, r2, parteDelTamano: parte, por10: tarifa * 10 };
}

/**
 * Analiza cada etapa de cada tipo de espacio. `unidades` es cómo se cotiza hoy cada etapa (sin etapa, por pie²). La
 * sugerencia, solo con ajuste: fija si el tamaño explica menos del 30% del costo; por la medida que mejor lo explica
 * si es fija y el tamaño explica más del 60%, o si la otra medida lo explica claramente mejor.
 */
export function analizarCostosEtapa(
  muestras: readonly MuestraEtapa[],
  unidades: ReadonlyMap<string, UnidadEtapa>,
): AnalisisEtapa[] {
  const grupos = new Map<string, MuestraEtapa[]>();
  for (const m of muestras) {
    if (!(m.costo > 0)) continue;
    const k = `${m.tipoEspacioId}|${m.etapaId ?? ''}`;
    grupos.set(k, [...(grupos.get(k) ?? []), m]);
  }
  return [...grupos.values()].map((g) => {
    const { tipoEspacioId, etapaId } = g[0]!;
    const unidad = (etapaId ? unidades.get(etapaId) : null) ?? 'pie2';
    const medidaDe = (m: MuestraEtapa, x: Medida) => (x === 'pie2' ? m.pies2 : m.piesLineales);
    const porUnidadDe = (x: Medida) => {
      const v = g.filter((m) => medidaDe(m, x) > 0).map((m) => m.costo / medidaDe(m, x));
      return v.length ? mediana(v) : null;
    };
    const ajustes = (['pie2', 'pie_lineal'] as const)
      .map((x) =>
        ajustarEtapa(
          g.map((m) => ({ x: medidaDe(m, x), y: m.costo })),
          x,
        ),
      )
      .filter((a): a is AjusteEtapa => a !== null);
    const propia = unidad === 'fijo' ? null : (ajustes.find((a) => a.medida === unidad) ?? null);
    const mejor = [...ajustes].sort((a, b) => b.r2 - a.r2)[0] ?? null;
    const ajuste = propia ?? mejor;
    let sugerida: UnidadEtapa | null = null;
    if (mejor) {
      if (unidad === 'fijo') {
        if (mejor.parteDelTamano > 0.6 && mejor.r2 > 0.5) sugerida = mejor.medida;
      } else if (
        mejor.medida !== unidad &&
        mejor.parteDelTamano >= 0.3 &&
        mejor.r2 - (propia?.r2 ?? 0) > 0.2
      ) {
        // la otra medida lo explica claramente mejor (el vanity sigue al largo, no al área)
        sugerida = mejor.medida;
      } else if (propia && propia.parteDelTamano < 0.3) {
        sugerida = 'fijo';
      }
    }
    return {
      tipoEspacioId,
      etapaId,
      unidad,
      n: g.length,
      costoTipico: mediana(g.map((m) => m.costo)),
      porUnidad: unidad === 'fijo' ? null : porUnidadDe(unidad),
      ajuste,
      sugerida,
    };
  });
}

/**
 * El costo que se sugiere para una etapa al cotizar un espacio con sus medidas: fija, su costo típico; por unidad,
 * base + tarifa × medida si hay ajuste, o el costo típico por unidad × medida. Null sin historia, o sin la medida.
 */
export function costoSugerido(
  a: AnalisisEtapa,
  medidas: { readonly pies2: number; readonly piesLineales: number },
): number | null {
  if (a.unidad === 'fijo') return Math.round(a.costoTipico);
  const medida = a.unidad === 'pie2' ? medidas.pies2 : medidas.piesLineales;
  if (!(medida > 0)) return null;
  if (a.ajuste && a.ajuste.medida === a.unidad)
    return Math.round(Math.max(0, a.ajuste.base + a.ajuste.tarifa * medida));
  return a.porUnidad === null ? null : Math.round(a.porUnidad * medida);
}
