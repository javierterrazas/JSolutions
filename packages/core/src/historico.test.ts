import { describe, expect, it } from 'vitest';
import { gananciaPorDia, type ObraCerrada, ordenarObrasCerradas, resumenHistorico } from './historico';

const obra = (n: number, mes: string, tipo: string, margen: number, dias: number): ObraCerrada => ({
  obraId: `o${n}`,
  mes,
  tipo,
  dias,
  contrato: 10_000,
  costo: 10_000 * (1 - margen),
  cobrado: 10_000,
  noCalidad: 0,
  margen,
  desviacion: 0.1 * n,
  costoPie: 100,
  ventaPie: 150,
});

describe('el histórico de obras cerradas (D-087)', () => {
  // de la más reciente a la más vieja
  const obras = [
    obra(1, '2026-12', 'Baño', 0.4, 20),
    obra(2, '2026-12', 'Cocina', 0.3, 30),
    obra(3, '2026-11', 'Baño', 0.35, 22),
    obra(4, '2026-10', 'Baño', 0.25, 28),
    obra(5, '2026-10', 'Cocina', 0.2, 35),
    obra(6, '2026-09', 'Baño', 0.3, 25),
  ];
  const r = resumenHistorico(obras);

  it('promedios del total, por mes (lo más reciente primero) y por tipo (lo más común primero)', () => {
    expect(r.total.n).toBe(6);
    expect(r.total.margen).toBeCloseTo((0.4 + 0.3 + 0.35 + 0.25 + 0.2 + 0.3) / 6, 6);
    expect(r.porMes.map((g) => [g.clave, g.n])).toEqual([
      ['2026-12', 2],
      ['2026-11', 1],
      ['2026-10', 2],
      ['2026-09', 1],
    ]);
    expect(r.porTipo.map((g) => [g.clave, g.n])).toEqual([
      ['Baño', 4],
      ['Cocina', 2],
    ]);
    expect(r.porTipo[0]!.contrato).toBe(40_000);
  });

  it('la tendencia: las últimas 3 contra las 3 anteriores; sin 6 obras, no hay', () => {
    expect(r.tendencia.margen).toBeCloseTo((0.4 + 0.3 + 0.35) / 3 - (0.25 + 0.2 + 0.3) / 3, 6);
    expect(r.tendencia.dias).toBeCloseTo(24 - 29.333333, 4);
    expect(resumenHistorico(obras.slice(0, 3)).tendencia).toEqual({
      margen: null,
      desviacion: null,
      dias: null,
    });
  });
});

describe('qué obras convienen (D-107)', () => {
  // A: 40% en 60 días; B: 30% en 15 días; C: 35% en 30 días, entregada 5 días tarde
  const a = { ...obra(1, '2026-09', 'Baño', 0.4, 60), atraso: 0 };
  const b = { ...obra(2, '2026-09', 'Baño', 0.3, 15), atraso: null };
  const c = { ...obra(3, '2026-08', 'Cocina', 0.35, 30), atraso: 5 };

  it('la ganancia por día: la obra corta con menos margen deja más', () => {
    expect(gananciaPorDia(a)).toBeCloseTo(4000 / 60);
    expect(gananciaPorDia(b)).toBeCloseTo(3000 / 15);
    expect(gananciaPorDia({ contrato: 100, costo: 50, dias: 0 })).toBeNull();
    // la del grupo es la ganancia de todas entre todos sus días, no el promedio de cada una
    expect(resumenHistorico([a, b]).total.gananciaDia).toBeCloseTo(7000 / 75);
  });

  it('el ranking, de la mejor a la peor; lo que no tiene el dato va al final', () => {
    const folios = (xs: { obraId: string }[]) => xs.map((x) => x.obraId);
    expect(folios(ordenarObrasCerradas([a, b, c], 'ganancia_dia'))).toEqual(['o2', 'o3', 'o1']);
    expect(folios(ordenarObrasCerradas([a, b, c], 'margen'))).toEqual(['o1', 'o3', 'o2']);
    expect(folios(ordenarObrasCerradas([a, b, c], 'ganancia'))).toEqual(['o1', 'o3', 'o2']);
    expect(folios(ordenarObrasCerradas([a, b, c], 'dias'))).toEqual(['o2', 'o3', 'o1']);
    expect(folios(ordenarObrasCerradas([a, b, c], 'atraso'))).toEqual(['o1', 'o3', 'o2']);
  });
});
