// El histórico de las obras cerradas (D-087), con los datos de supabase/seed.sql: OB-003 de IJM se cerró el
// 2026-08-28 (contrato final $25,000, costo $15,600, 45 ft²) y la demolición de su baño costó $36/ft². Las reglas de
// los promedios se prueban en @ijm/core (historico.test.ts); aquí, que llegue bien lo que se lee de la base.
import { afterAll, describe, expect, it } from 'vitest';
import { analisisDeObraCerrada, cerrarObra, historicoDeObras } from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);

describe('el histórico de obras', () => {
  it('cada obra cerrada con sus números, sus promedios y lo que cuesta cada etapa', () =>
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
      // con una sola obra no se sabe qué parte es fija (D-095): solo su costo por unidad
      expect(h.costos).toEqual([
        expect.objectContaining({
          tipoEspacio: { es: 'Baño', en: 'Bathroom' },
          etapa: expect.objectContaining({ es: 'Demolición' }),
          unidad: 'pie2',
          n: 1,
          porUnidad: 36,
          ajuste: null,
          sugerida: null,
        }),
      ]);

      // otra obra cerrada: va primero, y su demolición entra a lo que cuesta la etapa
      await cerrarObra(tx, { obraId: OBRAS.a1Carlos, fechaEntrega: '2026-10-12', forzar: true }, LUNES);
      const h2 = await historicoDeObras(tx, LUNES);
      expect(h2.obras.map((o) => o.folio)).toEqual(['OB-001', 'OB-003']);
      expect(h2.resumen.porMes.map((g) => g.clave)).toEqual(['2026-10', '2026-08']);
      const demolicion = h2.costos.find((x) => x.etapa?.es === 'Demolición')!;
      expect(demolicion.n).toBe(2);
    }));

  it('la ganancia por día y el atraso de cada obra, y dónde se fue su margen (D-107)', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const [o] = (await historicoDeObras(tx, LUNES)).obras;
      // $25,000 − $15,600 en 25 días
      expect(o).toMatchObject({ ganancia: 9400, gananciaDia: 376 });
      expect(o!.atraso).toBe(
        Math.round((Date.parse(`${o!.entrega}T12:00Z`) - Date.parse(`${o!.comprometida}T12:00Z`)) / 864e5),
      );

      const a = (await analisisDeObraCerrada(tx, { obraId: o!.obraId }, LUNES))!;
      expect(a.obra.folio).toBe('OB-003');
      expect(a.diasPlaneados).toBeGreaterThan(0);
      expect(a.etapas.length).toBeGreaterThan(0);
      // la etapa que más se pasó va primero
      const exceso = a.etapas.map((e) => e.real - e.presupuestado);
      expect(exceso).toEqual([...exceso].sort((x, y) => y - x));

      // una obra que no está cerrada no tiene análisis
      expect(await analisisDeObraCerrada(tx, { obraId: OBRAS.a1Carlos }, LUNES)).toBeNull();
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => analisisDeObraCerrada(tx, { obraId: o!.obraId }, LUNES))).toBe(
        'solo_dueno',
      );
    }));

  it('cada empresa ve el suyo; el PM no lo ve', () =>
    probarComo(USUARIOS.duenoB, async (tx) => {
      expect((await historicoDeObras(tx, LUNES)).obras).toEqual([]);
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => historicoDeObras(tx, LUNES))).toBe('solo_dueno');
    }));
});
