// El mes simulado del legacy corre y deja datos para la paridad.
import { describe, expect, it } from 'vitest';
import { cambiarRutas, diasSimulados, mesSimulado } from './mesSimulado';

describe('el mes simulado del legacy', () => {
  it('cambia cada ruta fija una sola vez, también si la carpeta de trabajo está en /tmp (Linux)', () => {
    const codigo =
      "require('/tmp/harness.js'); fs.writeFileSync('/tmp/sim/diario.txt'); leer('/home/claude/ijm/App_PM.gs'); x('/tmp')";
    expect(cambiarRutas(codigo, '/tmp/ijm-paridad/abc', '/repo/legacy/')).toBe(
      "require('/tmp/ijm-paridad/abc/harness.js'); fs.writeFileSync('/tmp/ijm-paridad/abc/sim/diario.txt'); " +
        "leer('/repo/legacy/app/App_PM.gs'); x('/tmp/ijm-paridad/abc')",
    );
  });

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
