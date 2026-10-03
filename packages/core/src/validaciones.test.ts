// Validaciones y calidad con el calendario real de la empresa y los casos que los datos del legacy no cubren.
import { describe, expect, it } from 'vitest';
import { calificarInspeccion, cerrarPruebaAgua, exigirInspecciones, puntosConFoto } from './calidad';
import { ErrorDeNegocio } from './errores';
import { CALENDARIO_LEGACY, CALENDARIO_POR_DEFECTO, calendario } from './fechas';
import {
  diaDeCaptura,
  exigir,
  validarAltaObra,
  validarCierreDia,
  validarCierreTardioPM,
  validarCuadrilla,
} from './validaciones';

const error = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    // un fallo que no es de negocio rompe la prueba: no se compara
    if (!(e instanceof ErrorDeNegocio)) throw e;
    return { codigo: e.codigo, ...(e.datos ? { datos: e.datos } : {}) };
  }
};

describe('datos obligatorios', () => {
  it('todo lo que falta en un solo error, en orden', () => {
    expect(
      error(() =>
        exigir([
          ['', 'cliente'],
          ['Austin', 'direccion'],
          [null, 'fecha_entrega'],
          ['  ', 'pm'],
        ]),
      ),
    ).toEqual({
      codigo: 'faltan',
      datos: { campos: ['cliente', 'fecha_entrega', 'pm'] },
    });
    expect(
      error(() =>
        exigir([
          [0, 'cantidad'],
          [false, 'casilla'],
        ]),
      ),
    ).toBeNull();
  });
});

describe('cuadrilla', () => {
  const trabajadores = [
    { id: 'pedro', tipoPago: 'hora' as const },
    { id: 'juan', tipoPago: 'dia' as const },
  ];
  const registros = [
    { id: 'r1', trabajadorId: 'pedro', obraId: 'OB-1', dia: '2026-10-10', cantidad: 10 },
    { id: 'r2', trabajadorId: 'juan', obraId: 'OB-1', dia: '2026-10-10', cantidad: 0.5 },
  ];

  it('por hora: hasta 16 sumando obras, el sábado también', () => {
    expect(
      error(() =>
        validarCuadrilla([{ trabajadorId: 'pedro', cantidad: 6 }], '2026-10-10', trabajadores, registros),
      ),
    ).toBeNull();
    expect(
      error(() =>
        validarCuadrilla([{ trabajadorId: 'pedro', cantidad: 7 }], '2026-10-10', trabajadores, registros),
      ),
    ).toEqual({
      codigo: 'cuadrilla_pasa_16_horas',
      datos: { trabajador: 'pedro', dia: '2026-10-10', ya: 10, total: 17, obras: ['OB-1'] },
    });
  });

  it('por día: medio o completo, y no más de un día sumando obras; el mismo trabajador dos veces se suma', () => {
    expect(
      error(() => validarCuadrilla([{ trabajadorId: 'juan', cantidad: 8 }], '2026-10-12', trabajadores, []))
        ?.codigo,
    ).toBe('cuadrilla_dia_o_medio');
    expect(
      error(() =>
        validarCuadrilla([{ trabajadorId: 'juan', cantidad: 0.5 }], '2026-10-10', trabajadores, registros),
      ),
    ).toBeNull();
    expect(
      error(() =>
        validarCuadrilla(
          [
            { trabajadorId: 'juan', cantidad: 0.5 },
            { trabajadorId: 'juan', cantidad: 0.5 },
          ],
          '2026-10-10',
          trabajadores,
          registros,
        ),
      ),
    ).toMatchObject({ codigo: 'cuadrilla_pasa_un_dia' });
  });
});

describe('el día de una captura, en la zona de la empresa', () => {
  const ahora = new Date('2026-10-14T05:30:00Z'); // 00:30 del 14 en Austin

  it('capturado sin señal a las 11:45 pm y enviado después de medianoche: es del día anterior', () => {
    expect(diaDeCaptura('2026-10-14T04:45:00Z', ahora, 'America/Chicago')).toBe('2026-10-13');
  });
  it('sin fecha, inválida, futura o de hace más de 7 días: es hoy', () => {
    for (const c of [null, 'no', '2026-10-15T12:00:00Z', '2026-10-06T00:00:00Z']) {
      expect(diaDeCaptura(c, ahora, 'America/Chicago')).toBe('2026-10-14');
    }
  });
});

describe('cierre tardío del PM', () => {
  it('el lunes puede cerrar el sábado y el viernes (lunes a sábado); con el legacy, viernes y jueves', () => {
    const nada = new Set<string>();
    expect(
      error(() => validarCierreTardioPM('2026-10-10', '2026-10-12', nada, CALENDARIO_POR_DEFECTO)),
    ).toBeNull();
    expect(
      error(() => validarCierreTardioPM('2026-10-09', '2026-10-12', nada, CALENDARIO_POR_DEFECTO)),
    ).toBeNull();
    expect(
      error(() => validarCierreTardioPM('2026-10-08', '2026-10-12', nada, CALENDARIO_POR_DEFECTO))?.codigo,
    ).toBe('fuera_de_ventana');
    expect(
      error(() => validarCierreTardioPM('2026-10-08', '2026-10-12', nada, CALENDARIO_LEGACY)),
    ).toBeNull();
  });

  it('un feriado de descanso no gasta la ventana', () => {
    const conFeriado = calendario([1, 2, 3, 4, 5, 6], ['2026-10-10']);
    expect(error(() => validarCierreTardioPM('2026-10-08', '2026-10-12', new Set(), conFeriado))).toBeNull();
  });

  it('una vez por día', () => {
    expect(
      error(() =>
        validarCierreTardioPM('2026-10-10', '2026-10-12', new Set(['2026-10-10']), CALENDARIO_POR_DEFECTO),
      )?.codigo,
    ).toBe('dia_ya_cerrado');
  });
});

describe('cierre del día', () => {
  const base = {
    sinTrabajo: false,
    obraSinPresupuesto: false,
    fotos: 0,
    fotosPorSubir: 3,
    partidas: ['tile'],
    ordenesReportadas: [],
    ordenesDeLaObra: new Set<string>(),
  };
  it('compromete las fotos que subirá después, hasta 10', () => {
    expect(validarCierreDia(base).fotosComprometidas).toBe(3);
    expect(validarCierreDia({ ...base, fotosPorSubir: 40 }).fotosComprometidas).toBe(10);
  });
  it('un día sin trabajo pide un motivo de la lista y no compromete fotos', () => {
    expect(
      validarCierreDia({ ...base, sinTrabajo: true, motivo: 'clima', partidas: [] }).fotosComprometidas,
    ).toBe(0);
    expect(error(() => validarCierreDia({ ...base, sinTrabajo: true, motivo: 'flojera' }))?.codigo).toBe(
      'falta_motivo_sin_trabajo',
    );
  });
});

describe('alta de obra', () => {
  const ctx = {
    pmsActivos: new Set(['carlos']),
    obrasActivas: [{ id: 'OB-7', cliente: 'Familia Ruiz', direccion: '12 Oak St' }],
  };
  const datos = {
    cliente: 'familia  ruiz',
    telefono: '(512) 555-0100',
    direccion: '12 OAK ST',
    pmId: 'carlos',
    inicio: '2026-11-02',
    finEstimada: '2026-12-11',
    contrato: 1,
    espacios: [{ tipo: 'Baño', pies2: 40 }],
  };
  it('el mismo cliente en la misma dirección pide confirmar; confirmado, pasa', () => {
    expect(validarAltaObra(datos, ctx)).toEqual({ ok: false, confirmar: 'obra_duplicada', obraId: 'OB-7' });
    expect(validarAltaObra({ ...datos, confirmado: ['obra_duplicada'] }, ctx)).toMatchObject({ ok: true });
  });
});

describe('calidad', () => {
  const puntos = [
    { id: 'p1', requiereFoto: true },
    { id: 'p2', requiereFoto: false },
    { id: 'p3', requiereFoto: true },
  ];
  it('"No aplica" sale del total; la foto se pide solo en los puntos críticos que aplican', () => {
    expect(
      calificarInspeccion({
        puntos,
        cumple: ['p1', 'p2'],
        noAplica: ['p3'],
        fotos: 1,
        exigePruebaAgua: false,
        pruebaAguaSinFugas: false,
      }),
    ).toEqual({ resultado: 'aprobado', puntosOk: 2, puntosTotal: 2, defectos: [], noAplica: ['p3'] });
    expect(puntosConFoto(puntos, ['p3'])).toEqual(['p1']);
  });

  it('PC3: con defectos se registra aunque no haya prueba de agua; aprobada, no', () => {
    const pc3 = { puntos, noAplica: [], fotos: 1, exigePruebaAgua: true, pruebaAguaSinFugas: false };
    expect(calificarInspeccion({ ...pc3, cumple: ['p1'] }).resultado).toBe('con_defectos');
    expect(error(() => calificarInspeccion({ ...pc3, cumple: ['p1', 'p2', 'p3'] }))?.codigo).toBe(
      'falta_prueba_agua',
    );
  });

  it('manda la última inspección de cada punto en cada espacio', () => {
    const inspecciones = [
      {
        espacioId: 'bano',
        hitoId: 'PC2',
        resultado: 'aprobado' as const,
        realizadaEn: '2026-10-08T10:00:00Z',
      },
      {
        espacioId: 'bano',
        hitoId: 'PC2',
        resultado: 'con_defectos' as const,
        realizadaEn: '2026-10-09T10:00:00Z',
      },
      {
        espacioId: 'cocina',
        hitoId: 'PC2',
        resultado: 'aprobado' as const,
        realizadaEn: '2026-10-09T11:00:00Z',
      },
    ];
    expect(
      error(() =>
        exigirInspecciones([{ partidaId: 'framing', espacioId: 'cocina', hitoId: 'PC2' }], inspecciones),
      ),
    ).toBeNull();
    expect(
      error(() =>
        exigirInspecciones([{ partidaId: 'framing', espacioId: 'bano', hitoId: 'PC2' }], inspecciones),
      ),
    ).toEqual({
      codigo: 'falta_inspeccion',
      datos: { partida: 'framing', espacio: 'bano', hito: 'PC2' },
    });
  });

  it('la prueba de inundación necesita 23 horas, redondeadas a un decimal', () => {
    const inicio = new Date('2026-10-12T13:00:00Z');
    expect(cerrarPruebaAgua(inicio, new Date('2026-10-13T12:00:00Z'), 1)).toBe(23);
    expect(error(() => cerrarPruebaAgua(inicio, new Date('2026-10-13T11:56:00Z'), 1))).toEqual({
      codigo: 'prueba_incompleta',
      datos: { horas: 22.9 },
    });
  });
});
