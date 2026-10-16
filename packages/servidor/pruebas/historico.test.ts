// El histórico de las obras cerradas (D-087), con los datos de supabase/seed.sql: OB-003 de IJM se cerró el
// 2026-08-28 (contrato final $25,000, costo $15,600, 45 ft²) y la demolición de su baño costó $36/ft². Las reglas de
// los promedios se prueban en @ijm/core (historico.test.ts); aquí, que llegue bien lo que se lee de la base.
import { afterAll, describe, expect, it } from 'vitest';
import { cerrarObra, historicoDeObras } from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);

describe('el histórico de obras', () => {
  it('cada obra cerrada con sus números, sus promedios y el costo por unidad de cada etapa', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const h = await historicoDeObras(tx, LUNES);
      expect(h.obras).toHaveLength(1);
      expect(h.obras[0]).toMatchObject({
        folio: 'OB-003',
        tipo: 'Baño',
        mes: '2026-08',
        dias: 25,
        contrato: 25000,
        costo: 15600,
        margen: 0.376,
        resena: false,
      });
      expect(h.obras[0]!.costoPie).toBeCloseTo(15600 / 45, 6);
      expect(h.resumen.total.n).toBe(1);
      expect(h.resumen.porTipo.map((g) => g.clave)).toEqual(['Baño']);
      expect(h.porUnidad).toEqual([
        expect.objectContaining({
          tipoEspacio: { es: 'Baño', en: 'Bathroom' },
          etapa: expect.objectContaining({ es: 'Demolición' }),
          unidad: 'pie2',
          n: 1,
          promedio: 36,
        }),
      ]);

      // otra obra cerrada: va primero, y su demolición entra al promedio por unidad
      await cerrarObra(tx, { obraId: OBRAS.a1Carlos, fechaEntrega: '2026-10-12', forzar: true }, LUNES);
      const h2 = await historicoDeObras(tx, LUNES);
      expect(h2.obras.map((o) => o.folio)).toEqual(['OB-001', 'OB-003']);
      expect(h2.resumen.porMes.map((g) => g.clave)).toEqual(['2026-10', '2026-08']);
      const demolicion = h2.porUnidad.find((x) => x.etapa?.es === 'Demolición')!;
      expect(demolicion.n).toBe(2);
    }));

  it('cada empresa ve el suyo; el PM no lo ve', () =>
    probarComo(USUARIOS.duenoB, async (tx) => {
      expect((await historicoDeObras(tx, LUNES)).obras).toEqual([]);
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => historicoDeObras(tx, LUNES))).toBe('solo_dueno');
    }));
});
