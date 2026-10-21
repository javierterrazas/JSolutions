import { describe, expect, it } from 'vitest';
import { feriadosDeEstadosUnidos } from './feriados';

describe('los feriados de Estados Unidos (D-108)', () => {
  it('2026: las fechas que se descansan', () => {
    expect(feriadosDeEstadosUnidos(2026).map((f) => [f.dia, f.es])).toEqual([
      ['2026-01-01', 'Año Nuevo'],
      ['2026-05-25', 'Memorial Day'],
      // el 4 de julio cae en sábado: se descansa el viernes 3
      ['2026-07-03', 'Día de la Independencia (se recorre)'],
      ['2026-09-07', 'Labor Day'],
      ['2026-11-26', 'Día de Acción de Gracias'],
      ['2026-11-27', 'Día después de Acción de Gracias'],
      ['2026-12-24', 'Nochebuena'],
      ['2026-12-25', 'Navidad'],
    ]);
  });

  it('2027: Navidad y el Año Nuevo de 2028 caen en sábado y se descansan los viernes 24 y 31', () => {
    const f = feriadosDeEstadosUnidos(2027);
    expect(f.map((x) => x.dia)).toEqual([
      '2027-01-01',
      '2027-05-31',
      // el 4 de julio cae en domingo: el lunes 5
      '2027-07-05',
      '2027-09-06',
      '2027-11-25',
      '2027-11-26',
      '2027-12-24',
      '2027-12-31',
    ]);
    expect(f.find((x) => x.dia === '2027-12-24')).toMatchObject({ es: 'Navidad (se recorre)' });
    expect(f.find((x) => x.dia === '2027-12-31')).toMatchObject({ es: 'Año Nuevo (se recorre)' });
    // y 2028 no repite su Año Nuevo: ya se descansó en 2027
    expect(feriadosDeEstadosUnidos(2028).some((x) => x.es.startsWith('Año Nuevo'))).toBe(false);
  });
});
