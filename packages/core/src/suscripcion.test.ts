import { describe, expect, it } from 'vitest';
import { finDeGracia, siguienteVencimiento, sumarMeses } from './suscripcion';

describe('la suscripción', () => {
  it('sumar meses respeta el fin de mes y el cambio de año', () => {
    expect(sumarMeses('2026-10-14', 1)).toBe('2026-11-14');
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(sumarMeses('2028-01-31', 1)).toBe('2028-02-29');
    expect(sumarMeses('2026-12-15', 1)).toBe('2027-01-15');
    expect(sumarMeses('2026-10-14', 12)).toBe('2027-10-14');
  });

  it('un pago cubre desde el vencimiento si no ha pasado, o desde hoy si ya venció', () => {
    expect(siguienteVencimiento('2026-10-31', '2026-10-14', 'mensual')).toBe('2026-11-30');
    expect(siguienteVencimiento('2026-10-01', '2026-10-14', 'mensual')).toBe('2026-11-14');
    expect(siguienteVencimiento(null, '2026-10-14', 'anual')).toBe('2027-10-14');
  });

  it('la gracia dura 7 días después de vencer', () => {
    expect(finDeGracia('2026-10-31')).toBe('2026-11-07');
  });
});
