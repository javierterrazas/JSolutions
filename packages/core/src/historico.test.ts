import { describe, expect, it } from 'vitest';
import { type ObraCerrada, resumenHistorico } from './historico';

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
