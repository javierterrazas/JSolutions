import { describe, expect, it } from 'vitest';
import { type DatosDesempeno, desempeno, type MetricaPM, METRICAS_PM } from './desempeno';
import { CALENDARIO_POR_DEFECTO } from './fechas';

const VACIO: DatosDesempeno = {
  obras: [],
  cierres: [],
  gastos: [],
  plan: [],
  inspecciones: [],
  punch: [],
  pruebas: [],
  noCalidad: [],
};

// el miércoles 21 de octubre de 2026; el periodo, desde el lunes 5 (lunes a sábado laborables)
const HOY = '2026-10-21';
const DESDE = '2026-10-05';
const obra = (id: string, extra: Partial<DatosDesempeno['obras'][number]> = {}) => ({
  id,
  enCurso: true,
  inicio: '2026-10-05',
  entregada: null,
  atraso: 0,
  presupuestoEnRojo: false,
  ...extra,
});
const de = (ms: ReturnType<typeof desempeno>, k: MetricaPM) => ms.find((m) => m.clave === k)!;

describe('el desempeño de un manager', () => {
  it('trae las diez métricas, sin datos y sin semáforo si no tiene obras', () => {
    const ms = desempeno(VACIO, new Set(), DESDE, HOY, CALENDARIO_POR_DEFECTO);
    expect(ms.map((m) => m.clave)).toEqual([...METRICAS_PM]);
    expect(ms.every((m) => m.valor === null && m.semaforo === 'info')).toBe(true);
  });

  it('el cierre a tiempo cuenta cada día laborable desde el arranque hasta ayer: a tiempo, tarde u olvidado', () => {
    // del 5 al 20 de octubre hay 14 laborables; 10 a tiempo, 2 tarde y 2 olvidados
    const dias = [5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 19, 20].map(
      (n) => `2026-10-${String(n).padStart(2, '0')}`,
    );
    const d: DatosDesempeno = {
      ...VACIO,
      obras: [obra('a')],
      cierres: dias.slice(0, 12).map((dia, i) => ({ obraId: 'a', dia, tardio: i >= 10, segundos: null })),
    };
    const m = de(desempeno(d, new Set(['a']), DESDE, HOY, CALENDARIO_POR_DEFECTO), 'cierre_a_tiempo');
    expect(m.datos).toEqual({ esperados: 14, aTiempo: 10, tardios: 2, olvidados: 2 });
    expect(m.valor).toBeCloseTo(10 / 14);
    expect(m.semaforo).toBe('rojo');
    // la de otro PM no cuenta
    expect(
      de(desempeno(d, new Set(['b']), DESDE, HOY, CALENDARIO_POR_DEFECTO), 'cierre_a_tiempo').valor,
    ).toBeNull();
  });

  it('con pocos datos se muestra el número pero no se califica', () => {
    const d: DatosDesempeno = {
      ...VACIO,
      obras: [obra('a', { inicio: '2026-10-19' })],
      cierres: [{ obraId: 'a', dia: '2026-10-19', tardio: true, segundos: 200 }],
    };
    const ms = desempeno(d, new Set(['a']), DESDE, HOY, CALENDARIO_POR_DEFECTO);
    expect(de(ms, 'cierre_a_tiempo')).toMatchObject({ valor: 0, pocosDatos: true, semaforo: 'info' });
    expect(de(ms, 'segundos_cierre')).toMatchObject({ valor: 200, pocosDatos: true, semaforo: 'info' });
  });

  it('tiempo de cierre (mediana), recibos, atraso y presupuesto', () => {
    const d: DatosDesempeno = {
      ...VACIO,
      obras: [obra('a', { atraso: 4, presupuestoEnRojo: true }), obra('b', { atraso: -2 })],
      cierres: [40, 50, 55, 70, 300].map((segundos, i) => ({
        obraId: 'a',
        dia: `2026-10-0${5 + i}`,
        tardio: false,
        segundos,
      })),
      gastos: [true, true, true, false].map((conRecibo) => ({ obraId: 'b', dia: '2026-10-08', conRecibo })),
    };
    const ms = desempeno(d, new Set(['a', 'b']), DESDE, HOY, CALENDARIO_POR_DEFECTO);
    expect(de(ms, 'segundos_cierre')).toMatchObject({ valor: 55, semaforo: 'verde' });
    expect(de(ms, 'gastos_con_recibo')).toMatchObject({ valor: 0.75, datos: { gastos: 4, sinRecibo: 1 } });
    // una va 4 días tarde y la otra adelantada: el adelanto no compensa
    expect(de(ms, 'atraso')).toMatchObject({ valor: 2, datos: { obras: 2, tarde: 1 } });
    expect(de(ms, 'presupuesto_en_rojo')).toMatchObject({ valor: 0.5, datos: { obras: 2, enRojo: 1 } });
  });

  it('el plan semanal cuenta solo las semanas ya terminadas', () => {
    const plan = (semana: string, hecho: boolean) => ({ obraId: 'a', semana, hecho });
    const d: DatosDesempeno = {
      ...VACIO,
      obras: [obra('a')],
      plan: [
        ...[true, true, true, false].map((h) => plan('2026-10-05', h)),
        ...[true, true].map((h) => plan('2026-10-12', h)),
        // la de esta semana todavía no cuenta
        plan('2026-10-19', false),
      ],
    };
    expect(
      de(desempeno(d, new Set(['a']), DESDE, HOY, CALENDARIO_POR_DEFECTO), 'cumplimiento_semanal'),
    ).toMatchObject({ valor: 5 / 6, datos: { plan: 6, hechas: 5 } });
  });

  it('calidad: la primera inspección de cada punto, el punch a tiempo, las fugas y los retrabajos', () => {
    const insp = (espacioId: string, hitoId: string, dia: string, aprobada: boolean) => ({
      obraId: 'a',
      espacioId,
      hitoId,
      dia,
      aprobada,
    });
    const d: DatosDesempeno = {
      ...VACIO,
      obras: [obra('a')],
      inspecciones: [
        insp('bano', 'pc1', '2026-10-06', false),
        // la reinspección aprobada no cambia que la primera falló
        insp('bano', 'pc1', '2026-10-07', true),
        insp('bano', 'pc2', '2026-10-09', true),
        insp('cocina', 'pc1', '2026-10-10', true),
        // la de antes del periodo no cuenta
        insp('cocina', 'pc2', '2026-09-30', false),
      ],
      punch: [
        { obraId: 'a', compromiso: '2026-10-10', cerradoEl: '2026-10-09' },
        { obraId: 'a', compromiso: '2026-10-10', cerradoEl: '2026-10-12' },
        { obraId: 'a', compromiso: '2026-10-15', cerradoEl: '2026-10-15' },
        { obraId: 'a', compromiso: '2026-10-16', cerradoEl: null },
      ],
      pruebas: [
        { obraId: 'a', dia: '2026-10-08', conFuga: true },
        { obraId: 'a', dia: '2026-10-09', conFuga: false },
      ],
      noCalidad: [{ obraId: 'a', dia: '2026-10-14', costo: 350 }],
    };
    const ms = desempeno(d, new Set(['a']), DESDE, HOY, CALENDARIO_POR_DEFECTO);
    expect(de(ms, 'inspecciones_a_la_primera')).toMatchObject({
      valor: 2 / 3,
      datos: { inspecciones: 3, aprobadas: 2 },
      semaforo: 'rojo',
    });
    expect(de(ms, 'punch_a_tiempo')).toMatchObject({
      valor: 2 / 3,
      datos: { cerrados: 3, aTiempo: 2, vencidos: 1 },
    });
    expect(de(ms, 'pruebas_con_fuga')).toMatchObject({ valor: 1, datos: { pruebas: 2 }, semaforo: 'rojo' });
    expect(de(ms, 'retrabajos')).toMatchObject({ valor: 1, datos: { costo: 350 } });
  });
});
