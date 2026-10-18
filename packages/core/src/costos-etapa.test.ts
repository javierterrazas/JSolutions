import { describe, expect, it } from 'vitest';
import { ajustarEtapa, analizarCostosEtapa, costoSugerido, type MuestraEtapa } from './costos-etapa';

/** Cinco baños de 40 a 80 pie² (y 4 a 8 pies lineales) con el costo que da la fórmula. */
const banos = (etapaId: string, costo: (pies2: number, lineales: number) => number): MuestraEtapa[] =>
  [40, 50, 60, 70, 80].map((pies2) => ({
    tipoEspacioId: 'bano',
    etapaId,
    pies2,
    piesLineales: pies2 / 10,
    costo: costo(pies2, pies2 / 10),
  }));

describe('el costo de cada etapa según el tamaño (D-095)', () => {
  it('ajusta base + tarifa; con pocos datos o tamaños iguales, no', () => {
    const a = ajustarEtapa(
      [40, 50, 60, 70, 80].map((x) => ({ x, y: 500 + 20 * x })),
      'pie2',
    )!;
    expect(a.base).toBeCloseTo(500);
    expect(a.tarifa).toBeCloseTo(20);
    expect(a.r2).toBeCloseTo(1);
    expect(a.por10).toBeCloseTo(200);
    // el tamaño es 1200 de 1700 del costo típico
    expect(a.parteDelTamano).toBeCloseTo(1200 / 1700);
    expect(
      ajustarEtapa(
        [
          { x: 40, y: 100 },
          { x: 50, y: 120 },
        ],
        'pie2',
      ),
    ).toBeNull();
    expect(
      ajustarEtapa(
        [60, 60, 61, 60, 59].map((x) => ({ x, y: 900 })),
        'pie2',
      ),
    ).toBeNull();
  });

  it('el tile crece con el tamaño; la plomería casi no: conviene fija', () => {
    const r = analizarCostosEtapa(
      [
        ...banos('tile', (p) => 25 * p + (p % 20 === 0 ? 40 : -40)),
        ...banos('plomeria', (p) => 1800 + (p === 80 ? 120 : p === 40 ? -100 : 30)),
      ],
      new Map([
        ['tile', 'pie2'],
        ['plomeria', 'pie2'],
      ]),
    );
    const tile = r.find((x) => x.etapaId === 'tile')!;
    expect(tile.ajuste!.parteDelTamano).toBeGreaterThan(0.9);
    expect(tile.sugerida).toBeNull();
    expect(tile.porUnidad).toBeGreaterThan(24);
    expect(tile.porUnidad).toBeLessThan(27);
    const plomeria = r.find((x) => x.etapaId === 'plomeria')!;
    expect(plomeria.ajuste!.parteDelTamano).toBeLessThan(0.3);
    expect(plomeria.sugerida).toBe('fijo');
  });

  it('una fija que sí crece con el tamaño se sugiere por su medida; y la que va mejor por pie lineal', () => {
    const r = analizarCostosEtapa(
      [
        ...banos('pintura', (p) => 6 * p),
        // el vanity sigue al largo, no al área: 4, 5, 6, 7, 8 pies lineales con tamaños de baño revueltos
        ...[
          [40, 7],
          [50, 4],
          [60, 8],
          [70, 5],
          [80, 6],
        ].map(([pies2, lineales]) => ({
          tipoEspacioId: 'bano',
          etapaId: 'vanity',
          pies2: pies2!,
          piesLineales: lineales!,
          costo: 300 * lineales!,
        })),
      ],
      new Map([
        ['pintura', 'fijo'],
        ['vanity', 'pie2'],
      ]),
    );
    expect(r.find((x) => x.etapaId === 'pintura')!.sugerida).toBe('pie2');
    const vanity = r.find((x) => x.etapaId === 'vanity')!;
    expect(vanity.sugerida).toBe('pie_lineal');
  });

  it('el costo sugerido: fija, su costo típico; por unidad, con el ajuste o con la mediana por unidad', () => {
    const [tile] = analizarCostosEtapa(
      banos('tile', (p) => 500 + 20 * p),
      new Map([['tile', 'pie2']]),
    );
    expect(costoSugerido(tile!, { pies2: 65, piesLineales: 6 })).toBe(1800);
    const [pocos] = analizarCostosEtapa(
      banos('tile', (p) => 20 * p).slice(0, 2),
      new Map([['tile', 'pie2']]),
    );
    expect(pocos!.ajuste).toBeNull();
    expect(costoSugerido(pocos!, { pies2: 65, piesLineales: 6 })).toBe(1300);
    const [plomeria] = analizarCostosEtapa(
      banos('plomeria', () => 1800),
      new Map([['plomeria', 'fijo']]),
    );
    expect(costoSugerido(plomeria!, { pies2: 120, piesLineales: 0 })).toBe(1800);
    // sin la medida, no se sugiere
    const [vanity] = analizarCostosEtapa(
      banos('vanity', (_, l) => 300 * l),
      new Map([['vanity', 'pie_lineal']]),
    );
    expect(costoSugerido(vanity!, { pies2: 60, piesLineales: 0 })).toBeNull();
  });
});
