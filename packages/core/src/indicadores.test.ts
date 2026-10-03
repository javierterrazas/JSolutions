import { describe, expect, it } from 'vitest';
import { CALENDARIO_LEGACY, CALENDARIO_POR_DEFECTO } from './fechas';
import {
  calcularIndicadores,
  type DatosIndicadores,
  INDICADORES,
  semaforo,
  tasaDeCierre,
} from './indicadores';

const VACIO: DatosIndicadores = {
  obras: [],
  cierres: [],
  cumplimientoSemanaPasada: null,
  avisos: [],
  gastosPM: [],
  ordenesTrabajo: [],
  pagosSub: [],
  inspecciones: [],
  pruebasAgua: [],
  punch: [],
  entregas: [],
  noCalidad: [],
  ordenesCambio: [],
};
const CFG = { slaAvisosHoras: 24, slaOrdenesCambioHoras: 48, horasSinRecibo: 72, margenMinimoOC: 0.35 };

describe('semáforo', () => {
  it('"mayor": verde en la meta, ámbar hasta 10 % abajo', () => {
    expect([
      semaforo(0.95, 0.95, 'mayor'),
      semaforo(0.86, 0.95, 'mayor'),
      semaforo(0.85, 0.95, 'mayor'),
    ]).toEqual(['verde', 'ambar', 'rojo']);
  });
  it('"menor": verde en la meta, ámbar hasta 25 % más medio punto', () => {
    expect([semaforo(0, 0, 'menor'), semaforo(0.5, 0, 'menor'), semaforo(1, 0, 'menor')]).toEqual([
      'verde',
      'ambar',
      'rojo',
    ]);
    expect(semaforo(6.75, 5, 'menor')).toBe('ambar');
  });
});

describe('tasa de cierre del día', () => {
  const obras = [{ id: 'OB-1', enObra: true, inicio: '2026-09-28', contrato: 1 }];
  // hoy lunes 12 de octubre: la última semana sin hoy va del lunes 5 al domingo 11
  const cierres = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'].map((dia) => ({
    obraId: 'OB-1',
    dia,
    conTrabajo: true,
  }));

  it('con el sábado laborable, un sábado sin cierre cuenta en contra', () => {
    expect(tasaDeCierre(obras, cierres, '2026-10-12', CALENDARIO_LEGACY)).toEqual({
      esperados: 5,
      cumplidos: 5,
    });
    expect(tasaDeCierre(obras, cierres, '2026-10-12', CALENDARIO_POR_DEFECTO)).toEqual({
      esperados: 6,
      cumplidos: 5,
    });
  });

  it('no cuenta los días antes del primer día con trabajo, ni obras que no están en obra', () => {
    const tarde = [{ obraId: 'OB-1', dia: '2026-10-09', conTrabajo: true }];
    expect(tasaDeCierre(obras, tarde, '2026-10-12', CALENDARIO_POR_DEFECTO)).toEqual({
      esperados: 2,
      cumplidos: 1,
    });
    expect(
      tasaDeCierre([{ ...obras[0]!, enObra: false }], cierres, '2026-10-12', CALENDARIO_POR_DEFECTO)
        .esperados,
    ).toBe(0);
  });
});

describe('los 19 indicadores', () => {
  const ahora = new Date('2026-10-12T15:00:00Z');

  it('son 19, en orden, y los seis del lunes van marcados', () => {
    const r = calcularIndicadores(VACIO, CFG, ahora, '2026-10-12', CALENDARIO_POR_DEFECTO);
    expect(r.map((x) => x.clave)).toEqual([...INDICADORES]);
    expect(r.filter((x) => x.principal)).toHaveLength(6);
  });

  it('sin datos: valor 0 y semáforo informativo, sin pintar rojo', () => {
    const r = calcularIndicadores(VACIO, CFG, ahora, '2026-10-12', CALENDARIO_POR_DEFECTO);
    expect(r.find((x) => x.clave === 'tasa_cierre_dia')).toMatchObject({
      valor: 0,
      semaforo: 'info',
      sinDatos: true,
    });
    expect(r.find((x) => x.clave === 'presentacion_subs')).toMatchObject({ sinDatos: true });
  });

  it('una meta que cambió la empresa reemplaza la del legacy (D-019)', () => {
    const r = calcularIndicadores(
      VACIO,
      { ...CFG, metas: { punch_por_obra: 3, margen_oc: 0.4 } },
      ahora,
      '2026-10-12',
      CALENDARIO_POR_DEFECTO,
    );
    expect(r.find((x) => x.clave === 'punch_por_obra')!.meta).toBe(3);
    expect(r.find((x) => x.clave === 'margen_oc')!.meta).toBe(0.4);
    expect(r.find((x) => x.clave === 'resenas')!.meta).toBe(0.6);
  });

  it('un aviso abierto pasa a fuera de plazo después de las horas del plazo', () => {
    const avisos = [{ abiertoEn: new Date('2026-10-11T14:00:00Z'), abierto: true, respondidoEn: null }];
    const a = (sla: number) =>
      calcularIndicadores(
        { ...VACIO, avisos },
        { ...CFG, slaAvisosHoras: sla },
        ahora,
        '2026-10-12',
        CALENDARIO_POR_DEFECTO,
      ).find((x) => x.clave === 'avisos_fuera_de_sla')!;
    expect(a(24)).toMatchObject({ valor: 1, semaforo: 'rojo', datos: { slaHoras: 24 } }); // con meta 0, el ámbar llega a 0.5
    expect(a(26).valor).toBe(0);
  });
});
