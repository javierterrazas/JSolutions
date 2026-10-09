import { describe, expect, it } from 'vitest';
import { medidas } from './comprimir';

describe('el tamaño de la foto comprimida', () => {
  it('el lado más largo queda en 1600, con la misma proporción', () => {
    expect(medidas(4032, 3024)).toEqual({ ancho: 1600, alto: 1200 });
    expect(medidas(3024, 4032)).toEqual({ ancho: 1200, alto: 1600 });
  });

  it('una foto chica no se agranda', () => {
    expect(medidas(800, 600)).toEqual({ ancho: 800, alto: 600 });
  });
});
