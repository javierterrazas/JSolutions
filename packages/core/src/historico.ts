// El histórico de las obras cerradas (D-087; legacy: admin/servidor.js duHistorico): sus promedios por mes y por tipo
// de obra y la tendencia de las últimas obras. Promedios simples, como el legacy: cada obra pesa lo mismo. Lo que
// cuesta cada etapa según el tamaño está en costos-etapa.ts (D-095).

export interface ObraCerrada {
  readonly obraId: string;
  /** El mes de la entrega, "AAAA-MM". */
  readonly mes: string;
  /** Lo que se hizo: los tipos de sus espacios ("Baño + Closet"). */
  readonly tipo: string;
  readonly dias: number;
  readonly contrato: number;
  readonly costo: number;
  readonly cobrado: number;
  readonly noCalidad: number;
  readonly margen: number | null;
  readonly desviacion: number | null;
  /** Costo y contrato por pie²; null sin pies². */
  readonly costoPie: number | null;
  readonly ventaPie: number | null;
}

export interface GrupoHistorico {
  readonly clave: string;
  readonly n: number;
  readonly margen: number | null;
  readonly desviacion: number | null;
  readonly dias: number | null;
  readonly costoPie: number | null;
  readonly ventaPie: number | null;
  readonly contrato: number;
  readonly costo: number;
  readonly cobrado: number;
  readonly noCalidad: number;
  /** Lo que dejaron por día que duraron (D-107): la ganancia de todas entre sus días, no el promedio de cada una. */
  readonly gananciaDia: number | null;
}

/**
 * La ganancia por día de una obra (D-107): contrato final menos costo real, entre los días que duró. Dice qué obras
 * convienen: un margen alto en una obra larga puede dejar menos que uno menor en una corta. Null si no duró días.
 */
export const gananciaPorDia = (o: { contrato: number; costo: number; dias: number }): number | null =>
  o.dias > 0 ? (o.contrato - o.costo) / o.dias : null;

export const CRITERIOS_HISTORICO = ['ganancia_dia', 'margen', 'ganancia', 'dias', 'atraso'] as const;
export type CriterioHistorico = (typeof CRITERIOS_HISTORICO)[number];

/**
 * Las obras cerradas de la mejor a la peor según el criterio (D-107): más ganancia por día, más margen, más ganancia;
 * menos días, menos atraso. Las que no tienen el dato van al final.
 */
export function ordenarObrasCerradas<
  T extends { contrato: number; costo: number; dias: number; margen: number | null; atraso?: number | null },
>(obras: readonly T[], criterio: CriterioHistorico): T[] {
  const valor = (o: T): number | null => {
    switch (criterio) {
      case 'ganancia_dia':
        return gananciaPorDia(o);
      case 'margen':
        return o.margen;
      case 'ganancia':
        return o.contrato - o.costo;
      case 'dias':
        return -o.dias;
      case 'atraso':
        return o.atraso === null || o.atraso === undefined ? null : -o.atraso;
    }
  };
  return [...obras].sort((a, b) => {
    const x = valor(a);
    const y = valor(b);
    if (x === null || y === null) return x === null ? (y === null ? 0 : 1) : -1;
    return y - x;
  });
}

const promedio = (xs: readonly (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x !== null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

function agrupar(obras: readonly ObraCerrada[], clave: string): GrupoHistorico {
  return {
    clave,
    n: obras.length,
    margen: promedio(obras.map((o) => o.margen)),
    desviacion: promedio(obras.map((o) => o.desviacion)),
    dias: promedio(obras.map((o) => o.dias)),
    costoPie: promedio(obras.map((o) => o.costoPie)),
    ventaPie: promedio(obras.map((o) => o.ventaPie)),
    contrato: obras.reduce((a, o) => a + o.contrato, 0),
    costo: obras.reduce((a, o) => a + o.costo, 0),
    cobrado: obras.reduce((a, o) => a + o.cobrado, 0),
    noCalidad: obras.reduce((a, o) => a + o.noCalidad, 0),
    gananciaDia: gananciaPorDia({
      contrato: obras.reduce((a, o) => a + o.contrato, 0),
      costo: obras.reduce((a, o) => a + o.costo, 0),
      dias: obras.reduce((a, o) => a + o.dias, 0),
    }),
  };
}

function porClave(obras: readonly ObraCerrada[], de: (o: ObraCerrada) => string): GrupoHistorico[] {
  const g = new Map<string, ObraCerrada[]>();
  for (const o of obras) g.set(de(o), [...(g.get(de(o)) ?? []), o]);
  return [...g.entries()].map(([k, os]) => agrupar(os, k));
}

export interface Tendencia {
  /** Las últimas 3 obras menos las 3 anteriores; null si no hay con qué comparar. */
  readonly margen: number | null;
  readonly desviacion: number | null;
  readonly dias: number | null;
}

export interface ResumenHistorico {
  readonly total: GrupoHistorico;
  /** Del mes más reciente al más viejo. */
  readonly porMes: readonly GrupoHistorico[];
  /** De más a menos obras. */
  readonly porTipo: readonly GrupoHistorico[];
  readonly tendencia: Tendencia;
}

/** Los promedios del histórico. `obras` va de la entrega más reciente a la más vieja. */
export function resumenHistorico(obras: readonly ObraCerrada[]): ResumenHistorico {
  const ult = obras.slice(0, 3);
  const prev = obras.slice(3, 6);
  const delta = (campo: 'margen' | 'desviacion' | 'dias') => {
    const a = promedio(ult.map((o) => o[campo]));
    const b = promedio(prev.map((o) => o[campo]));
    return a === null || b === null ? null : a - b;
  };
  return {
    total: agrupar(obras, 'total'),
    porMes: porClave(obras, (o) => o.mes).sort((a, b) => (a.clave < b.clave ? 1 : -1)),
    porTipo: porClave(obras, (o) => o.tipo).sort((a, b) => b.n - a.n || a.clave.localeCompare(b.clave)),
    tendencia: { margen: delta('margen'), desviacion: delta('desviacion'), dias: delta('dias') },
  };
}
