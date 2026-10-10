// Partidas de un tipo de obra nuevo, en blanco (legacy: duCrearTipo).
import { describe, expect, it } from 'vitest';
import { ErrorDeNegocio } from './errores';
import { partidasDeTipoNuevo } from './partidas';

describe('partidas de un tipo de obra nuevo', () => {
  it('una por renglón, en orden, sin vacíos ni repetidas, con los valores de omisión', () => {
    const r = partidasDeTipoNuevo(['  Desbaste ', '', 'Sellador', 'desbaste'], 40);
    expect(r).toEqual([
      {
        orden: 1,
        nombre: 'Desbaste',
        hitoId: null,
        peso: 20,
        dias: 1,
        responsable: 'cuadrilla',
        oficioId: null,
        paralelo: false,
        espera: 0,
        etapaId: null,
      },
      expect.objectContaining({ orden: 2, nombre: 'Sellador', peso: 20 }),
    ]);
  });

  it('el tamaño se reparte parejo y redondeado; sin tamaño, 50; nunca menos de 1', () => {
    expect(partidasDeTipoNuevo(['a', 'b', 'c'], 40).map((p) => p.peso)).toEqual([13, 13, 13]);
    expect(partidasDeTipoNuevo(['a', 'b'], null).map((p) => p.peso)).toEqual([25, 25]);
    expect(partidasDeTipoNuevo(['a', 'b', 'c'], 1).map((p) => p.peso)).toEqual([1, 1, 1]);
  });

  it('sin ninguna partida: tipo_sin_partidas', () => {
    expect(() => partidasDeTipoNuevo([' ', ''])).toThrow(new ErrorDeNegocio('tipo_sin_partidas'));
  });
});
