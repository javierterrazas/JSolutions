// Avance, partidas y etapas: los casos que los datos del legacy no ejercitan.
import { describe, expect, it } from 'vitest';
import { avanceDeObra, avancePonderado, estadoDePartida, pesoValido } from './avance';
import { ErrorDeNegocio } from './errores';
import {
  type Cargo,
  costosPorEtapa,
  costosUnitarios,
  type EspacioEtapas,
  etapasDeEspacio,
  montoSugerido,
  normalizarPresupuesto,
  presupuestoCompleto,
  presupuestoDesdePartidas,
  tarifaDelDia,
} from './etapas';
import { agregarPartida, copiarPlantilla, validarQuitarPartida } from './partidas';

const codigo = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof ErrorDeNegocio ? e.codigo : String(e);
  }
};

describe('avance ponderado', () => {
  it('pesa por complejidad: la parte terminada y la parte en curso', () => {
    expect(
      avancePonderado([
        { peso: 1, estado: 'terminada' },
        { peso: 3, estado: 'en_progreso' },
        { peso: 6, estado: 'sin_iniciar' },
      ]),
    ).toEqual({ pct: 0.1, curso: 0.3 });
  });

  it('una partida sin peso válido pesa 1', () => {
    expect([pesoValido(0), pesoValido(null), pesoValido(-2), pesoValido(2.5)]).toEqual([1, 1, 1, 2.5]);
    const obra = avanceDeObra(
      [
        {
          id: 'bano',
          generales: false,
          partidas: [
            { id: 'a', peso: 0 },
            { id: 'b', peso: 3 },
          ],
        },
      ],
      [{ partidaId: 'a', estado: 'terminada', dia: '2026-10-05' }],
    );
    expect(obra.pct).toBe(0.25);
  });

  it('una partida está terminada si alguna vez se marcó terminada', () => {
    expect(estadoDePartida([{ estado: 'terminada' }, { estado: 'en_progreso' }])).toBe('terminada');
    expect(estadoDePartida([])).toBe('sin_iniciar');
  });

  it('sin partidas no hay avance', () => {
    expect(avancePonderado([])).toEqual({ pct: 0, curso: 0 });
  });
});

describe('partidas de una obra', () => {
  it('la copia de la plantilla pone los valores de omisión', () => {
    const [p] = copiarPlantilla([{ orden: 3, nombre: ' Retoque ', peso: 0, dias: 0, espera: -1 }]);
    expect(p).toMatchObject({
      orden: 3,
      nombre: 'Retoque',
      peso: 1,
      dias: 1,
      espera: 0,
      responsable: 'cuadrilla',
    });
  });

  it('agregar va al final y no repite nombre (sin importar mayúsculas), salvo uno ya quitado', () => {
    const existentes = [
      { nombre: 'Tile', orden: 1, activa: true },
      { nombre: 'Vidrio', orden: 7, activa: false },
    ];
    expect(agregarPartida(existentes, { nombre: 'Nicho' }, new Set()).orden).toBe(8);
    expect(codigo(() => agregarPartida(existentes, { nombre: 'TILE' }, new Set()))).toBe('partida_repetida');
    expect(codigo(() => agregarPartida(existentes, { nombre: 'vidrio' }, new Set()))).toBeNull();
    expect(codigo(() => agregarPartida(existentes, { nombre: 'Nicho' }, new Set(), true))).toBe(
      'obra_cerrada',
    );
  });

  it('quitar pide motivo y que la partida no tenga uso', () => {
    const sinUso = { avance: 0, manoDeObra: 0, ordenesVigentes: 0 };
    expect(codigo(() => validarQuitarPartida(sinUso, 'El cliente no quiso vidrio'))).toBeNull();
    expect(codigo(() => validarQuitarPartida(sinUso, '  '))).toBe('falta_motivo');
    expect(codigo(() => validarQuitarPartida({ ...sinUso, avance: 1 }, 'x'))).toBe('partida_en_uso');
  });
});

// Un baño de 50 pies² con dos etapas (demolición y tile) y una partida sin etapa; y Generales.
const BANO: EspacioEtapas = {
  id: 'bano',
  generales: false,
  tipoEspacioId: 'tipo-bano',
  pies2: 50,
  partidas: [
    { id: 'demo', etapaId: 'demolicion' },
    { id: 'tile', etapaId: 'tile' },
    { id: 'lechada', etapaId: 'tile' },
    { id: 'retoque', etapaId: null },
  ],
};
const GEN: EspacioEtapas = {
  id: 'gen',
  generales: true,
  tipoEspacioId: 'tipo-gen',
  pies2: 0,
  partidas: [{ id: 'limpieza', etapaId: 'generales' }],
};

describe('presupuesto por etapa', () => {
  it('las etapas de un espacio, en el orden de su primera partida; sin etapa = "Otras partidas"', () => {
    expect(etapasDeEspacio(BANO)).toEqual([
      { etapaId: 'demolicion', partidas: ['demo'] },
      { etapaId: 'tile', partidas: ['tile', 'lechada'] },
      { etapaId: null, partidas: ['retoque'] },
    ]);
  });

  it('suma líneas repetidas, quita ceros, y rechaza negativos o etapas que no son del espacio', () => {
    expect(
      normalizarPresupuesto(
        [BANO],
        [
          { espacioId: 'bano', etapaId: 'tile', monto: 1000 },
          { espacioId: 'bano', etapaId: 'tile', monto: 200 },
          { espacioId: 'bano', etapaId: 'demolicion', monto: 0 },
        ],
      ),
    ).toEqual([{ espacioId: 'bano', etapaId: 'tile', monto: 1200 }]);
    expect(
      codigo(() => normalizarPresupuesto([BANO], [{ espacioId: 'bano', etapaId: 'tile', monto: -1 }])),
    ).toBe('monto_negativo');
    expect(
      codigo(() => normalizarPresupuesto([BANO], [{ espacioId: 'bano', etapaId: 'pintura', monto: 5 }])),
    ).toBe('etapa_no_es_del_espacio');
  });

  it('el formato antiguo por partida se suma a su etapa (D-004)', () => {
    expect(
      presupuestoDesdePartidas(
        [BANO],
        [
          { espacioId: 'bano', partidaId: 'tile', monto: 800 },
          { espacioId: 'bano', partidaId: 'lechada', monto: 150 },
          { espacioId: 'bano', partidaId: 'ya-no-existe', monto: 50 },
        ],
      ),
    ).toEqual([
      { espacioId: 'bano', etapaId: 'tile', monto: 950 },
      { espacioId: 'bano', etapaId: null, monto: 50 },
    ]);
  });

  it('completo: cada espacio, menos Generales, con al menos una etapa con monto', () => {
    expect(
      presupuestoCompleto([BANO, GEN], [{ espacioId: 'gen', etapaId: 'generales', monto: 300 }]),
    ).toEqual({
      completo: false,
      faltan: ['bano'],
    });
    expect(
      presupuestoCompleto([BANO, GEN], [{ espacioId: 'bano', etapaId: 'tile', monto: 1 }]).completo,
    ).toBe(true);
    expect(presupuestoCompleto([GEN], []).completo).toBe(false);
  });
});

describe('costos reales por etapa', () => {
  it('la tarifa de la cuadrilla es la vigente el día que trabajó (D-031)', () => {
    const tarifas = [
      { trabajadorId: 'pedro', tarifa: 20, vigenteDesde: '2026-01-01' },
      { trabajadorId: 'pedro', tarifa: 24, vigenteDesde: '2026-10-15' },
    ];
    expect(tarifaDelDia(tarifas, 'pedro', '2026-10-14')).toBe(20);
    expect(tarifaDelDia(tarifas, 'pedro', '2026-10-15')).toBe(24);
    expect(tarifaDelDia(tarifas, 'pedro', '2025-12-31')).toBe(0);
    expect(tarifaDelDia(tarifas, 'juan', '2026-10-15')).toBe(0);
  });

  it('suma los tres cubos por etapa contra su presupuesto, con desvío y costo por pie²', () => {
    const cargos: Cargo[] = [
      { espacioId: 'bano', partidaId: 'tile', cubo: 'material', monto: 600 },
      { espacioId: 'bano', partidaId: 'lechada', cubo: 'cuadrilla', monto: 160 },
      { espacioId: 'bano', partidaId: 'tile', cubo: 'sub', monto: 2000 },
      { espacioId: 'bano', partidaId: null, cubo: 'material', monto: 40 },
      { espacioId: 'gen', partidaId: 'limpieza', cubo: 'cuadrilla', monto: 100 },
    ];
    const r = costosPorEtapa([BANO, GEN], cargos, [{ espacioId: 'bano', etapaId: 'tile', monto: 2400 }]);
    const tile = r.find((x) => x.etapaId === 'tile')!;
    expect(tile).toMatchObject({ material: 600, cuadrilla: 160, sub: 2000, total: 2760, presupuesto: 2400 });
    expect(tile.desvio).toBeCloseTo(0.15);
    expect(tile.unitario).toBeCloseTo(55.2);
    expect(tile.partidas).toEqual([
      { partidaId: 'tile', total: 2600 },
      { partidaId: 'lechada', total: 160 },
    ]);
    // sin partida: "Otras partidas" de su espacio; Generales sin costo por pie²
    expect(r.find((x) => x.espacioId === 'bano' && x.etapaId === null)!.total).toBe(40);
    expect(r.find((x) => x.espacioId === 'gen')!.unitario).toBeNull();
    // demolición no costó ni tiene presupuesto: no aparece
    expect(r.some((x) => x.etapaId === 'demolicion')).toBe(false);
  });
});

describe('costos unitarios históricos', () => {
  const cargos: Cargo[] = [
    { espacioId: 'bano', partidaId: 'demo', cubo: 'cuadrilla', monto: 500 },
    { espacioId: 'bano', partidaId: 'tile', cubo: 'sub', monto: 3000 },
  ];
  const obra = (id: string, cerrada: boolean, terminadas: string[]) => ({
    id,
    cerrada,
    espacios: [BANO, GEN],
    presupuesto: [{ espacioId: 'bano', etapaId: 'tile', monto: 2500 }],
    cargos,
    terminadas: new Set(terminadas),
  });

  it('una etapa entra cuando todas sus partidas están terminadas, o la obra ya cerró', () => {
    const r = costosUnitarios([obra('en-curso', false, ['demo', 'tile'])]);
    expect(r.map((u) => u.etapaId)).toEqual(['demolicion']); // a tile le falta la lechada
    const cerrada = costosUnitarios([obra('cerrada', true, [])]);
    expect(cerrada.find((u) => u.etapaId === 'tile')).toMatchObject({
      n: 1,
      promedio: 60,
      promedioPresupuesto: 50,
    });
  });

  it('promedio, mínimo y máximo entre obras; Generales no cuenta', () => {
    const otra = {
      ...obra('b', true, []),
      cargos: [{ espacioId: 'bano', partidaId: 'tile', cubo: 'sub' as const, monto: 4000 }],
    };
    const tile = costosUnitarios([obra('a', true, []), otra]).find((u) => u.etapaId === 'tile')!;
    expect(tile).toMatchObject({ n: 2, promedio: 70, minimo: 60, maximo: 80 });
    expect(costosUnitarios([obra('a', true, [])]).some((u) => u.tipoEspacioId === 'tipo-gen')).toBe(false);
    expect(montoSugerido(tile.promedio, 45)).toBe(3150);
  });
});
