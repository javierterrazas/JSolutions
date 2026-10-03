import { describe, expect, it } from 'vitest';
import type { Cronograma, CronogramaObra, FilaCrono } from './cronograma';
import { CALENDARIO_LEGACY, CALENDARIO_POR_DEFECTO } from './fechas';
import {
  cumplimientoSemanal,
  diasSinCierre,
  estaSemana,
  type OrdenSemana,
  planDeLaSemana,
  semanaDelPM,
} from './semana';

const LUN_SAB = CALENDARIO_POR_DEFECTO;

const fila = (partidaId: string, ini: string, fin: string, extra: Partial<FilaCrono> = {}): FilaCrono => ({
  partidaId,
  espacioId: 'bano',
  responsable: 'cuadrilla',
  oficioId: null,
  dias: 1,
  espera: 0,
  ini,
  fin,
  estado: 'sin_iniciar',
  ...extra,
});

const orden = (id: string, extra: Partial<OrdenSemana>): OrdenSemana => ({
  id,
  obraId: 'OB-1',
  subId: 'tile-sa',
  partidaId: 'tile',
  estado: 'emitida',
  inicio: null,
  fin: null,
  ...extra,
});

describe('"Esta semana" del dueño', () => {
  const cr: Cronograma = {
    fin: '2026-10-20',
    filas: [fila('tile', '2026-10-14', '2026-10-16', { responsable: 'subcontratista', oficioId: 'tile' })],
  };

  it('una partida de un sub que arranca en los próximos 5 días laborables y no tiene orden, con un sub sugerido', () => {
    const r = estaSemana(
      [{ id: 'OB-1', cronograma: cr }],
      [],
      [{ id: 'tile-sa', oficioId: 'tile', activo: true }],
      '2026-10-09',
      LUN_SAB,
    );
    expect(r.porProgramar).toEqual([
      {
        obraId: 'OB-1',
        espacioId: 'bano',
        partidaId: 'tile',
        inicio: '2026-10-14',
        fin: '2026-10-16',
        subSugerido: 'tile-sa',
      },
    ]);
  });

  it('el sábado cuenta: el viernes 9 con lunes a sábado ve hasta el jue 15; con lunes a viernes, hasta el vie 16', () => {
    const lejos: Cronograma = {
      fin: '2026-10-16',
      filas: [fila('tile', '2026-10-16', '2026-10-16', { responsable: 'subcontratista', oficioId: 'tile' })],
    };
    expect(
      estaSemana([{ id: 'OB-1', cronograma: lejos }], [], [], '2026-10-09', LUN_SAB).porProgramar,
    ).toHaveLength(0);
    expect(
      estaSemana([{ id: 'OB-1', cronograma: lejos }], [], [], '2026-10-09', CALENDARIO_LEGACY).porProgramar,
    ).toHaveLength(1);
  });

  it('con orden vigente ya no está por programar; una cancelada no cuenta', () => {
    const subs = [{ id: 'tile-sa', oficioId: 'tile', activo: true }];
    const vigente = estaSemana(
      [{ id: 'OB-1', cronograma: cr }],
      [orden('OT-1', {})],
      subs,
      '2026-10-09',
      LUN_SAB,
    );
    const cancelada = estaSemana(
      [{ id: 'OB-1', cronograma: cr }],
      [orden('OT-1', { estado: 'cancelada' })],
      subs,
      '2026-10-09',
      LUN_SAB,
    );
    expect(vigente.porProgramar).toHaveLength(0);
    expect(cancelada.porProgramar).toHaveLength(1);
  });

  it('el sub sugerido es uno activo del MISMO oficio (D-021)', () => {
    const subs = [
      { id: 'inactivo', oficioId: 'tile', activo: false },
      { id: 'plomero', oficioId: 'plomeria', activo: true },
    ];
    expect(
      estaSemana([{ id: 'OB-1', cronograma: cr }], [], subs, '2026-10-09', LUN_SAB).porProgramar[0]!
        .subSugerido,
    ).toBeNull();
  });

  it('confirmaciones faltantes en los próximos 2 días laborables, y choques del mismo sub en dos obras', () => {
    const r = estaSemana(
      [],
      [
        orden('OT-1', { inicio: '2026-10-10', fin: '2026-10-13' }),
        orden('OT-2', { obraId: 'OB-2', estado: 'confirmada', inicio: '2026-10-13', fin: '2026-10-14' }),
      ],
      [],
      '2026-10-09',
      LUN_SAB,
    );
    expect(r.sinConfirmar.map((o) => o.id)).toEqual(['OT-1']);
    expect(r.choques).toEqual([{ subId: 'tile-sa', obras: ['OB-1', 'OB-2'], dia: '2026-10-13' }]);
  });
});

describe('cumplimiento semanal del plan', () => {
  it('se congela lo previsto para la semana, sábado incluido', () => {
    const cr: Cronograma = {
      fin: '2026-10-17',
      filas: [
        fila('a', '2026-10-12', '2026-10-13'),
        fila('b', '2026-10-17', '2026-10-17'),
        fila('c', '2026-10-19', '2026-10-19'),
      ],
    };
    expect(planDeLaSemana(cr, '2026-10-12', LUN_SAB).map((p) => p.partidaId)).toEqual(['a', 'b']);
  });

  it('lo terminado el sábado cuenta para la semana', () => {
    const plan = [{ partidaId: 'a' }, { partidaId: 'b' }];
    const real = new Map([
      ['a', { ini: '2026-10-12', fin: '2026-10-13' }],
      ['b', { ini: '2026-10-17', fin: '2026-10-17' }],
    ]);
    expect(cumplimientoSemanal(plan, real, '2026-10-12', LUN_SAB)).toEqual({ plan: 2, hecho: 2, ppc: 1 });
    expect(cumplimientoSemanal([], real, '2026-10-12', LUN_SAB)).toBeNull();
  });
});

describe('la semana del PM y sus días sin cierre', () => {
  it('muestra los días laborables que se pidan, con el sábado', () => {
    const cr: CronogramaObra = {
      planFin: '2026-10-12',
      prevFin: '2026-10-12',
      filas: [{ ...fila('tile', '2026-10-09', '2026-10-12'), planIni: '2026-10-09', planFin: '2026-10-12' }],
    };
    const s = semanaDelPM(cr, [orden('OT-1', { inicio: '2026-10-10' })], '2026-10-09', LUN_SAB, 6);
    expect(s.dias.map((d) => d.dia)).toEqual([
      '2026-10-09',
      '2026-10-10',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
    ]);
    expect(s.dias[1]).toEqual({ dia: '2026-10-10', partidas: ['tile'], llegan: ['OT-1'] });
  });

  it('el lunes, los días que se le olvidó cerrar son el sábado y el viernes (no el jueves)', () => {
    const cierres = [{ dia: '2026-10-05', conTrabajo: true }];
    expect(diasSinCierre(cierres, true, '2026-10-12', LUN_SAB)).toEqual(['2026-10-09', '2026-10-10']);
    expect(diasSinCierre(cierres, true, '2026-10-12', CALENDARIO_LEGACY)).toEqual([
      '2026-10-08',
      '2026-10-09',
    ]);
  });

  it('solo en obras en curso, y no antes del primer día con trabajo', () => {
    expect(diasSinCierre([{ dia: '2026-10-05', conTrabajo: true }], false, '2026-10-12', LUN_SAB)).toEqual(
      [],
    );
    expect(diasSinCierre([{ dia: '2026-10-10', conTrabajo: true }], true, '2026-10-12', LUN_SAB)).toEqual([]);
  });
});
