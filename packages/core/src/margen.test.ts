import { describe, expect, it } from 'vitest';
import { margenDe, margenProyectado, precioConMargen } from './margen';

describe('el margen del presupuesto (D-084)', () => {
  it('el precio deja el margen sobre el precio, no sobre el costo', () => {
    expect(precioConMargen(10_000, 0.35)).toBe(15_384.62);
    expect(margenDe(10_000, 15_384.62)).toBeCloseTo(0.35, 4);
    expect(precioConMargen(975, 0.35)).toBe(1500);
    expect(precioConMargen(500, 0)).toBe(500);
    expect(() => precioConMargen(500, 1)).toThrow();
    expect(margenDe(100, 0)).toBeNull();
    expect(margenDe(120, 100)).toBeCloseTo(-0.2, 6);
  });

  it('el margen proyectado: lo gastado o el costo de cada etapa, lo que sea mayor, contra el contrato', () => {
    const etapas = [
      { costo: 1000, gastado: 1200 }, // ya se pasó
      { costo: 2000, gastado: 500 }, // va dentro: cuenta su costo
    ];
    expect(margenProyectado(etapas, 5000)).toBeCloseTo(1 - 3200 / 5000, 6);
    expect(margenProyectado(etapas, 0)).toBeNull();
  });
});
