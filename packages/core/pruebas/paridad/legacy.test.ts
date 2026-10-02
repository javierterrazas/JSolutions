// Prueba de humo de la técnica de paridad: el legacy carga en Node y responde.
// Las pruebas de paridad de cada regla (paso 5) comparan estas mismas funciones contra packages/core.

import { describe, expect, it } from 'vitest';
import { cargarLegacy, diaLocal, funcionLegacy } from './legacy';

describe('el legacy carga en una máquina virtual de Node', () => {
  it('corre en la zona horaria de la empresa piloto', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Chicago');
  });

  it.each(['Dueno', 'PM'] as const)('carga la app %s completa', (app) => {
    const ctx = cargarLegacy(app);
    expect(typeof ctx.calcularCrono_).toBe('function');
    expect(typeof ctx.exigir_).toBe('function');
  });

  it('la app del PM no trae funciones del dueño', () => {
    const ctx = cargarLegacy('PM');
    expect(ctx.duGuardarPresupuesto).toBeUndefined();
    expect(ctx.tarifas_).toBeUndefined();
  });

  it('cuenta días hábiles: del viernes 2 de octubre de 2026, un día hábil después es el lunes 5', () => {
    const ctx = cargarLegacy('Dueno');
    const masHab = funcionLegacy<(d: Date, n: number) => Date>(ctx, 'masHab_');
    expect(diaLocal(masHab(new Date(2026, 9, 2), 1))).toBe('2026-10-05');
  });

  it('un sábado se recorre al lunes', () => {
    const ctx = cargarLegacy('Dueno');
    const hab0 = funcionLegacy<(d: Date) => Date>(ctx, 'hab0_');
    expect(diaLocal(hab0(new Date(2026, 9, 3)))).toBe('2026-10-05');
  });

  it('junta todo lo que falta en un solo mensaje', () => {
    const ctx = cargarLegacy('Dueno');
    const exigir = funcionLegacy<(pares: [unknown, string][]) => void>(ctx, 'exigir_');
    expect(() =>
      exigir([
        ['', 'cliente'],
        ['Austin', 'dirección'],
        [null, 'fecha de entrega'],
      ]),
    ).toThrow('Faltan: cliente, fecha de entrega.');
  });

  it('respeta el "ahora" que le damos', () => {
    const ctx = cargarLegacy('Dueno', { ahora: new Date(2026, 9, 5, 8) });
    expect(vmAhora(ctx)).toBe('2026-10-05');
  });
});

/** Lo que el legacy ve como hoy. */
function vmAhora(ctx: Record<string, unknown>): string {
  const hab0 = funcionLegacy<(d: Date) => Date>(ctx, 'hab0_');
  const D = ctx.Date as DateConstructor;
  return diaLocal(hab0(new D()));
}
