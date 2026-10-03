// El mes simulado del legacy corre y deja datos para la paridad.
import { describe, expect, it } from 'vitest';
import { diasSimulados, mesSimulado } from './mesSimulado';

describe('el mes simulado del legacy', () => {
  it('corre y deja obras, avance y cierres de día', () => {
    const libro = mesSimulado();
    expect(libro.Proyectos!.length - 1).toBeGreaterThanOrEqual(4);
    expect(libro.Avance!.length - 1).toBeGreaterThan(20);
    expect(libro.Bitacora!.length - 1).toBeGreaterThan(20);
    expect(libro.Bitacora![1]![1]).toBeInstanceOf(Date);
  }, 600_000);

  it('guarda el estado de las hojas al terminar cada día, con obras a medias', () => {
    const dias = diasSimulados();
    expect(dias.size).toBeGreaterThanOrEqual(25);
    const aMedio = [...dias.values()].some((l) => l.Proyectos!.slice(1).some((p) => p[9] === 'En obra'));
    expect(aMedio).toBe(true);
  }, 600_000);
});
