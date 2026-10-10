// La copia para cerrar el día sin señal (fase 2, paso 5c; D-047), con los datos de supabase/seed.sql: Carlos lleva
// OB-001, cerró el lunes 5 de octubre de 2026, y el sub de plomería se espera desde el miércoles 7.
import { afterAll, describe, expect, it } from 'vitest';
import { copiaSinSenal } from '../src/index';
import { enAustin, MIEMBROS, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

describe('la copia para trabajar sin señal', () => {
  it('trae las obras del PM con lo de la pantalla de cierre, sus días cerrados y la zona', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const c = (await copiaSinSenal(tx, enAustin('2026-10-08')))!;
      expect(c).toMatchObject({
        miembro: { id: MIEMBROS.carlos, nombre: expect.any(String) },
        zona: 'America/Chicago',
      });
      expect(c.obras.map((o) => o.datos.obra.id)).toEqual([OBRAS.a1Carlos]);
      const [o] = c.obras;
      expect(o!.cerrados).toContain('2026-10-05');
      expect(o!.datos.espacios.flatMap((e) => e.partidas).length).toBeGreaterThan(0);
      expect(o!.datos.subs).toEqual([
        expect.objectContaining({ alcance: 'Rough de plomería del baño', inicio: '2026-10-07' }),
      ]);
    }));

  it('trae también los subs que empiezan en los próximos días: el teléfono los ofrece cuando les toca', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const c = (await copiaSinSenal(tx, enAustin('2026-10-06')))!;
      expect(c.obras[0]!.datos.subs.map((s) => s.inicio)).toEqual(['2026-10-07']);
    }));

  it('no lleva dinero del negocio', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const texto = JSON.stringify(await copiaSinSenal(tx, enAustin('2026-10-08')));
      for (const palabra of ['monto', 'contrato', 'tarifa', 'precio', 'costo'])
        expect(texto).not.toContain(palabra);
    }));

  it('el dueño no tiene copia: no cierra días', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      expect(await copiaSinSenal(tx, enAustin('2026-10-08'))).toBeNull();
    }));
});
