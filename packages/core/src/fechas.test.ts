import { describe, expect, it } from 'vitest';
import {
  CALENDARIO_LEGACY,
  CALENDARIO_POR_DEFECTO,
  calendario,
  diaEnZona,
  diaSemana,
  domingoDe,
  esDia,
  esLaborable,
  hoyEn,
  laborablesEntre,
  lunesDe,
  primerLaborable,
  restarLaborables,
  sumarLaborables,
  validarDia,
} from './fechas';

// Octubre de 2026: el 3 es sábado, el 4 domingo, el 5 lunes.
const LUN_VIE = CALENDARIO_LEGACY;
const LUN_SAB = CALENDARIO_POR_DEFECTO;
const CHICAGO = 'America/Chicago';

describe('días de negocio', () => {
  it('son texto AAAA-MM-DD válido, nunca un Date', () => {
    expect(esDia('2026-10-05')).toBe(true);
    expect(esDia('2026-02-30')).toBe(false);
    expect(esDia('2026-10-5')).toBe(false);
    expect(esDia(new Date())).toBe(false);
    expect(() => validarDia('30/10/2026')).toThrow();
  });

  it('saben qué día de la semana son', () => {
    expect(diaSemana('2026-10-05')).toBe(1);
    expect(diaSemana('2026-10-10')).toBe(6);
    expect(diaSemana('2026-10-11')).toBe(7);
    expect(diaSemana('2024-02-29')).toBe(4);
  });

  it('la semana va de lunes a domingo', () => {
    expect(lunesDe('2026-10-08')).toBe('2026-10-05');
    expect(lunesDe('2026-10-11')).toBe('2026-10-05');
    expect(domingoDe('2026-10-05')).toBe('2026-10-11');
  });
});

describe('"hoy" en la zona de la empresa (regla 5)', () => {
  it('a las 11:30 pm de Austin todavía es ese día, aunque en UTC ya sea mañana', () => {
    expect(hoyEn(new Date('2026-10-31T04:30:00Z'), CHICAGO)).toBe('2026-10-30');
  });

  it('el día que termina el horario de verano (1 de noviembre de 2026)', () => {
    expect(diaEnZona(new Date('2026-11-01T06:30:00Z'), CHICAGO)).toBe('2026-11-01'); // 1:30 am, la hora repetida
    expect(diaEnZona(new Date('2026-11-02T05:59:00Z'), CHICAGO)).toBe('2026-11-01'); // 11:59 pm CST
    expect(diaEnZona(new Date('2026-11-02T06:00:00Z'), CHICAGO)).toBe('2026-11-02');
  });

  it('el día que empieza el horario de verano (8 de marzo de 2026)', () => {
    expect(diaEnZona(new Date('2026-03-08T05:59:00Z'), CHICAGO)).toBe('2026-03-07'); // 11:59 pm CST
    expect(diaEnZona(new Date('2026-03-09T04:59:00Z'), CHICAGO)).toBe('2026-03-08'); // 11:59 pm CDT
  });

  it('por qué no se usan Date: "2026-10-30" leído como Date es la medianoche UTC, el 29 en Austin', () => {
    // el error de un día del legacy: aquí la fecha capturada se queda como texto y es ese día local
    expect(diaEnZona(new Date('2026-10-30'), CHICAGO)).toBe('2026-10-29');
    expect(validarDia('2026-10-30')).toBe('2026-10-30');
  });
});

describe('días laborables', () => {
  it('el legacy trabajaba de lunes a viernes; la empresa, de lunes a sábado (D-028)', () => {
    expect(esLaborable('2026-10-10', LUN_VIE)).toBe(false);
    expect(esLaborable('2026-10-10', LUN_SAB)).toBe(true);
    expect(esLaborable('2026-10-11', LUN_SAB)).toBe(false);
  });

  it('el primer laborable: el mismo día si lo es, si no el siguiente', () => {
    expect(primerLaborable('2026-10-10', LUN_VIE)).toBe('2026-10-12');
    expect(primerLaborable('2026-10-10', LUN_SAB)).toBe('2026-10-10');
    expect(primerLaborable('2026-10-11', LUN_SAB)).toBe('2026-10-12');
  });

  it('sumar y restar laborables brinca lo que no se trabaja', () => {
    expect(sumarLaborables('2026-10-09', 1, LUN_VIE)).toBe('2026-10-12');
    expect(sumarLaborables('2026-10-09', 1, LUN_SAB)).toBe('2026-10-10');
    expect(sumarLaborables('2026-10-09', 0, LUN_SAB)).toBe('2026-10-09');
    expect(restarLaborables('2026-10-12', 1, LUN_VIE)).toBe('2026-10-09');
    expect(restarLaborables('2026-10-12', 1, LUN_SAB)).toBe('2026-10-10');
  });

  it('laborables entre dos días: después del primero, hasta el segundo', () => {
    expect(laborablesEntre('2026-10-05', '2026-10-12', LUN_VIE)).toBe(5);
    expect(laborablesEntre('2026-10-05', '2026-10-12', LUN_SAB)).toBe(6);
    expect(laborablesEntre('2026-10-12', '2026-10-05', LUN_SAB)).toBe(0);
  });

  it('un feriado de descanso no es laborable; uno que se trabaja simplemente no se lista', () => {
    const conThanksgiving = calendario([1, 2, 3, 4, 5, 6], ['2026-11-26']);
    expect(esLaborable('2026-11-26', conThanksgiving)).toBe(false);
    expect(sumarLaborables('2026-11-25', 1, conThanksgiving)).toBe('2026-11-27');
    expect(esLaborable('2026-11-26', LUN_SAB)).toBe(true);
  });

  it('un calendario sin días laborables no tiene sentido', () => {
    expect(() => calendario([])).toThrow();
  });
});
