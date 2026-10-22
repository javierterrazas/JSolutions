// Los feriados de la empresa (D-108): el dueño los da de alta (uno o los de Estados Unidos de un año), marca los que se
// trabajan, y cuentan para el calendario de la sesión.
import { afterAll, describe, expect, it } from 'vitest';
import {
  agregarFeriado,
  agregarFeriadosDeEstadosUnidos,
  cambiarFeriado,
  feriadosDeLaEmpresa,
  leerSesion,
} from '../src/index';
import { codigo, como, enAustin, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const HOY = enAustin('2026-10-21', 9);

describe('los feriados de la empresa', () => {
  it('los de Estados Unidos de un año de un toque, sin repetir; uno propio; el que se trabaja deja de descansarse', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const antes = (await feriadosDeLaEmpresa(tx, HOY)).feriados.length;
      expect((await agregarFeriadosDeEstadosUnidos(tx, { anio: 2026 }, HOY)).agregados).toBe(8 - antes);
      // otra vez: ya estaban
      expect((await agregarFeriadosDeEstadosUnidos(tx, { anio: 2026 }, HOY)).agregados).toBe(0);

      await agregarFeriado(tx, { dia: '2026-12-31', nombre: 'Fin de año' }, HOY);
      expect(await codigo(tx, () => agregarFeriado(tx, { dia: '2026-12-31', nombre: 'Otro' }, HOY))).toBe(
        'feriado_repetido',
      );
      const { feriados } = await feriadosDeLaEmpresa(tx, HOY);
      expect(feriados.find((f) => f.dia === '2026-12-31')).toMatchObject({
        nombre: 'Fin de año',
        seTrabaja: false,
      });

      // la Navidad se descansa; marcada "se trabaja", ya cuenta como laborable
      const navidad = feriados.find((f) => f.dia === '2026-12-25')!;
      expect((await leerSesion(tx, HOY)).calendario.feriados.has('2026-12-25')).toBe(true);
      await cambiarFeriado(tx, { feriadoId: navidad.id, seTrabaja: true }, HOY);
      expect((await leerSesion(tx, HOY)).calendario.feriados.has('2026-12-25')).toBe(false);
    }));

  it('el PM no los cambia', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => agregarFeriadosDeEstadosUnidos(tx, { anio: 2026 }, HOY))).toBe(
        'solo_dueno',
      );
      expect(await codigo(tx, () => feriadosDeLaEmpresa(tx, HOY))).toBe('solo_dueno');
    }));
});
