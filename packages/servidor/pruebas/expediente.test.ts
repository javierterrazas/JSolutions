// Lo que el expediente de una obra (D-102) lee aparte, con supabase/seed.sql: en OB-001, el PC1 del baño aprobado, una
// prueba de agua sin fugas y un detalle del punch abierto.
import { afterAll, describe, expect, it } from 'vitest';
import { calidadDeLaObra, seguimientoDeObra } from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);

describe('el expediente de una obra', () => {
  it('las inspecciones, las pruebas de agua y el punch list', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const c = (await calidadDeLaObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!;
      expect(c.inspecciones).toEqual([
        expect.objectContaining({
          clave: 'PC1',
          resultado: 'aprobado',
          espacio: 'Baño principal',
          defectos: [],
        }),
      ]);
      expect(c.pruebas).toEqual([expect.objectContaining({ resultado: 'sin_fugas' })]);
      expect(c.punch).toEqual([
        expect.objectContaining({
          item: 'Silicón disparejo en el vanity',
          abierto: true,
          compromiso: '2026-10-30',
        }),
      ]);
    }));

  it('el día a día completo, no solo los últimos 14 días', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const todos = (await seguimientoDeObra(tx, { obraId: OBRAS.a1Carlos, todos: true }, LUNES))!;
      expect(todos.hayMasDias).toBe(false);
      expect(todos.dias.length).toBeGreaterThanOrEqual(
        (await seguimientoDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.dias.length,
      );
    }));

  it('el PM no lo ve', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => calidadDeLaObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))).toBe(
        'solo_dueno',
      );
    }));
});
