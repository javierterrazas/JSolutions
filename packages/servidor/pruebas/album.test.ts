// El álbum de fotos de una obra (fase 2, paso 6f; legacy: pmAlbum), con los datos de supabase/seed.sql: OB-001 tiene
// la foto del cierre del 5 de octubre, el recibo de la compra de Carlos en Home Depot, el de la compra de la oficina en
// Ferguson y fotos de órdenes de cambio.
import { afterAll, describe, expect, it } from 'vitest';
import { albumDeObra } from '../src/index';
import { como, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

describe('el álbum de la obra', () => {
  it('el PM ve las fotos de su obra por registro; nunca las de la oficina ni las de órdenes de cambio', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const a = (await albumDeObra(tx, { obraId: OBRAS.a1Carlos }))!;
      expect(a.obra.folio).toBe('OB-001');
      expect(a.registros.map((r) => r.tipo).sort()).toEqual(['bitacora', 'gasto']);
      expect(a.registros.find((r) => r.tipo === 'bitacora')).toMatchObject({
        folio: 'BIT-0001',
        dia: '2026-10-05',
        fotos: [expect.any(String)],
      });
      expect(a.registros.find((r) => r.tipo === 'gasto')).toMatchObject({ detalle: 'Home Depot' });
      expect(a.hayMas).toBe(false);
    }));

  it('el dueño ve todas, también las de la oficina y las de órdenes de cambio', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const a = (await albumDeObra(tx, { obraId: OBRAS.a1Carlos }))!;
      expect(
        a.registros
          .filter((r) => r.tipo === 'gasto')
          .map((r) => r.detalle)
          .sort(),
      ).toEqual(['Ferguson', 'Home Depot']);
      expect(a.registros.some((r) => r.tipo === 'orden_cambio')).toBe(true);
    }));

  it('otro PM no ve el álbum de una obra que no es suya; una página vacía no tiene más', () =>
    probarComo(USUARIOS.luis, async (tx) => {
      expect(await albumDeObra(tx, { obraId: OBRAS.a1Carlos })).toBeNull();
      await como(tx, USUARIOS.carlos);
      expect(await albumDeObra(tx, { obraId: OBRAS.a1Carlos, pagina: 5 })).toMatchObject({
        registros: [],
        hayMas: false,
      });
    }));
});
