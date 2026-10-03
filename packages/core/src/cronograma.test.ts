// El cronograma con el calendario del legacy (traducción de legacy/pruebas/prueba_crono.js) y con el calendario
// real de la empresa: de lunes a sábado y con feriados.
import { describe, expect, it } from 'vitest';
import {
  atraso,
  atrasoPrevisto,
  calcularCronograma,
  cronogramaObra,
  type EspacioCrono,
  fechaComprometida,
  type PartidaCrono,
  proponerEntrega,
} from './cronograma';
import { CALENDARIO_LEGACY, CALENDARIO_POR_DEFECTO, calendario, laborablesEntre, type Dia } from './fechas';

/** Una partida de plantilla: [nombre, días, responsable, paralelo, espera]. */
const p = (
  id: string,
  dias: number,
  responsable: PartidaCrono['responsable'] = 'cuadrilla',
  paralelo = false,
  espera = 0,
): PartidaCrono => ({
  id,
  dias,
  responsable,
  paralelo,
  espera,
  oficioId: responsable === 'subcontratista' ? id : null,
});

// La plantilla de Baño del libro del legacy (Partidas_Catalogo), en su orden.
const BANO: PartidaCrono[] = [
  p('Demolición', 2),
  p('Rough de plomería', 2, 'subcontratista'),
  p('Rough eléctrico', 1, 'subcontratista', true),
  p('Blocking y framing', 1),
  p('Inspección rough-in', 1, 'pm'),
  p('Cementboard y drywall', 1),
  p('Impermeabilización', 2),
  p('Tile', 3, 'subcontratista'),
  p('Plantilla de puerta de vidrio', 1, 'pm'),
  p('Lechada y sellado', 1, 'cuadrilla', true),
  p('Instalación de vanity', 1, 'cuadrilla', true),
  p('Plantilla de countertop', 1, 'pm'),
  p('Pintura primera mano', 1, 'cuadrilla', true),
  p('Instalación de countertop', 1, 'subcontratista', false, 3),
  p('Vidrio y accesorios', 1, 'subcontratista', true, 3),
  p('Plomería final', 1, 'subcontratista'),
];
const CLOSET: PartidaCrono[] = [
  p('Demolición closet', 1),
  p('Reparación de muros', 1),
  p('Pintura', 1),
  p('Estructura', 2),
  p('Puertas y herrajes', 1),
  p('Iluminación', 1, 'subcontratista', true),
];
const GENERALES: PartidaCrono[] = [
  p('Protección', 1),
  p('Permisos', 1, 'pm', true),
  p('Contenedor', 1, 'pm', true),
  p('Limpieza final', 1),
];

const obra = (...espacios: PartidaCrono[][]): EspacioCrono[] => [
  ...espacios.map((partidas, i) => ({ id: 'e' + i, generales: false, partidas })),
  { id: 'g', generales: true, partidas: GENERALES },
];

const fila = (cr: { filas: readonly { partidaId: string; ini: Dia; fin: Dia }[] }, id: string) =>
  cr.filas.find((f) => f.partidaId === id)!;

describe('el plan de un baño que arranca el lunes 5 de octubre (prueba_crono del legacy)', () => {
  const cr = calcularCronograma('2026-10-05', obra(BANO), new Map(), null, CALENDARIO_LEGACY);

  it('demolición: lun 5 – mar 6', () => {
    expect(fila(cr, 'Demolición')).toMatchObject({ ini: '2026-10-05', fin: '2026-10-06' });
  });
  it('roughs en paralelo: el eléctrico arranca con la plomería (mié 7)', () => {
    expect(fila(cr, 'Rough eléctrico').ini).toBe('2026-10-07');
    expect(fila(cr, 'Rough de plomería').fin).toBe('2026-10-08');
  });
  it('framing espera al rough MÁS LARGO: vie 9', () => {
    expect(fila(cr, 'Blocking y framing').ini).toBe('2026-10-09');
  });
  it('tile: vie 16 – mar 20 (brinca el fin de semana)', () => {
    expect(fila(cr, 'Tile')).toMatchObject({ ini: '2026-10-16', fin: '2026-10-20' });
  });
  it('countertop: 3 días hábiles de fabricación después de la plantilla → mié 28', () => {
    expect(fila(cr, 'Instalación de countertop').ini).toBe('2026-10-28');
  });
  it('limpieza final después de todo: vie 30; el baño completo, 20 días hábiles', () => {
    expect(fila(cr, 'Limpieza final').ini).toBe('2026-10-30');
    expect(cr.fin).toBe('2026-10-30');
    expect(laborablesEntre('2026-10-05', cr.fin!, CALENDARIO_LEGACY) + 1).toBe(20);
  });
  it('al dar de alta baño + closet propone entregar el 30 de octubre', () => {
    expect(proponerEntrega('2026-10-05', [BANO, CLOSET], GENERALES, CALENDARIO_LEGACY)).toEqual({
      fecha: '2026-10-30',
      dias: 20,
    });
  });
});

describe('con el calendario de la empresa: también se trabaja el sábado (D-028)', () => {
  const cr = calcularCronograma('2026-10-05', obra(BANO), new Map(), null, CALENDARIO_POR_DEFECTO);

  it('el baño sigue tomando 20 días laborables, pero entrega 3 días antes: mar 27', () => {
    expect(laborablesEntre('2026-10-05', cr.fin!, CALENDARIO_POR_DEFECTO) + 1).toBe(20);
    expect(cr.fin).toBe('2026-10-27');
  });

  it('el framing ya no espera al lunes: la inspección rough-in cae en sábado 10', () => {
    expect(fila(cr, 'Blocking y framing').ini).toBe('2026-10-09');
    expect(fila(cr, 'Inspección rough-in').ini).toBe('2026-10-10');
  });

  it('el domingo nunca es laborable: una partida que lo cruza sigue el lunes', () => {
    const domingos = cr.filas
      .flatMap((f) => [f.ini, f.fin])
      .filter((d) => new Date(d + 'T12:00:00Z').getUTCDay() === 0);
    expect(domingos).toEqual([]);
  });
});

describe('feriados', () => {
  it('un feriado de descanso recorre todo lo que sigue un día laborable', () => {
    const conFeriado = calendario([1, 2, 3, 4, 5], ['2026-10-12']);
    const cr = calcularCronograma('2026-10-05', obra(BANO), new Map(), null, conFeriado);
    expect(cr.fin).toBe('2026-11-02');
    expect(cr.filas.some((f) => f.ini === '2026-10-12' || f.fin === '2026-10-12')).toBe(false);
  });

  it('una obra que arranca en feriado empieza el siguiente laborable', () => {
    const conFeriado = calendario([1, 2, 3, 4, 5, 6], ['2026-10-05']);
    const cr = cronogramaObra('2026-10-05', obra(BANO), [], '2026-10-01', conFeriado);
    expect(cr.filas[0]).toMatchObject({ planIni: '2026-10-06' });
  });
});

describe('la previsión se mueve con la realidad', () => {
  const cal = CALENDARIO_LEGACY;

  it('si la demolición termina un día tarde, todo lo que sigue se recorre un día', () => {
    const cr = cronogramaObra(
      '2026-10-05',
      obra(BANO),
      [
        { partidaId: 'Demolición', estado: 'en_progreso', dia: '2026-10-05' },
        { partidaId: 'Demolición', estado: 'terminada', dia: '2026-10-07' },
      ],
      '2026-10-07',
      cal,
    );
    expect(fila(cr, 'Demolición')).toMatchObject({
      estado: 'terminada',
      fin: '2026-10-07',
      planFin: '2026-10-06',
    });
    expect(fila(cr, 'Rough de plomería')).toMatchObject({ ini: '2026-10-08', planIni: '2026-10-07' });
    expect(cr.prevFin).toBe('2026-11-02');
    expect(cr.planFin).toBe('2026-10-30');
  });

  it('lo pendiente no arranca en el pasado y lo que va en curso no termina antes de hoy', () => {
    const cr = cronogramaObra(
      '2026-10-05',
      obra(BANO),
      [{ partidaId: 'Demolición', estado: 'en_progreso', dia: '2026-10-05' }],
      '2026-10-09',
      cal,
    );
    expect(fila(cr, 'Demolición')).toMatchObject({ estado: 'en_progreso', fin: '2026-10-09' });
    expect(fila(cr, 'Rough de plomería').ini).toBe('2026-10-12');
  });
});

describe('atraso contra la fecha comprometida', () => {
  const cal = CALENDARIO_POR_DEFECTO;
  const comprometida = fechaComprometida('2026-10-30', 2, cal); // 2 días de órdenes de cambio autorizadas

  it('la fecha comprometida suma los días de las órdenes de cambio, en días laborables', () => {
    expect(comprometida).toBe('2026-11-02'); // sáb 31 y lun 2
  });
  it('no hay atraso hasta pasar la fecha, ni después de entregar', () => {
    expect(atraso(comprometida, '2026-11-02', false, cal)).toBe(0);
    expect(atraso(comprometida, '2026-11-04', false, cal)).toBe(2);
    expect(atraso(comprometida, '2026-11-04', true, cal)).toBe(0);
  });
  it('el atraso previsto es lo que la entrega prevista pasa de la comprometida', () => {
    expect(atrasoPrevisto(comprometida, '2026-11-05', cal)).toBe(3);
    expect(atrasoPrevisto(comprometida, '2026-10-29', cal)).toBe(0);
    expect(atrasoPrevisto(comprometida, null, cal)).toBe(0);
  });
});
