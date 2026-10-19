// Los indicadores de la empresa (D-075), con los datos de supabase/seed.sql de IJM: en cada obra del seed, órdenes de
// trabajo por $2,300 con $800 pagados (una liquidación sin aprobación del PM), y órdenes de cambio de costo $650 y
// precio $1,000.
// Las reglas tienen paridad con el legacy en @ijm/core; aquí se revisa que lo que se lee de la base llegue bien.
import { INDICADORES } from '@ijm/core';
import { afterAll, describe, expect, it } from 'vitest';
import { indicadoresDeLaEmpresa } from '../src/index';
import { codigo, como, enAustin, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);

describe('los indicadores de la empresa', () => {
  it('los 19, en su orden, con lo que se lee de la base; solo los de su empresa', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const r = await indicadoresDeLaEmpresa(tx, LUNES);
      expect(r.hoy).toBe('2026-10-12');
      expect(r.indicadores.map((i) => i.clave)).toEqual([...INDICADORES]);
      const de = (k: string) => r.indicadores.find((i) => i.clave === k)!;
      // de toda la empresa: lo comprometido con los subs menos lo pagado, como lo suma la base
      const [b] = await tx<{ saldo: string; sin_aprobar: number }[]>`
        select (select coalesce(sum(p.precio), 0) from ordenes_trabajo ot
                join ordenes_trabajo_precios p on p.orden_trabajo_id = ot.id where ot.estado <> 'cancelada')
             - (select coalesce(sum(monto), 0) from pagos_sub where estado = 'vigente') as saldo,
               (select count(*)::int from pagos_sub ps join ordenes_trabajo ot on ot.id = ps.orden_trabajo_id
                where ps.estado = 'vigente' and ps.concepto = 'liquidacion' and ot.aprobada_en is null) as sin_aprobar`;
      expect(de('saldo_subcontratistas')).toMatchObject({
        valor: Number(b!.saldo),
        formato: 'dinero',
        principal: true,
      });
      expect(de('saldo_subcontratistas').valor).toBeGreaterThan(0);
      expect(de('pagos_sin_aprobacion').valor).toBe(b!.sin_aprobar);
      expect(de('margen_oc').valor).toBeCloseTo(0.35, 5);
      expect(de('margen_oc').meta).toBe(0.35);
      // el plan congelado de la semana pasada (el seed trae uno) contra lo que se terminó
      const [plan] = await tx<{ n: number }[]>`
        select count(*)::int as n from plan_semanal where semana = '2026-10-05'`;
      expect(plan!.n).toBeGreaterThan(0);
      expect(de('cumplimiento_semanal').sinDatos).toBe(false);
      expect(de('cumplimiento_semanal').valor).toBeGreaterThanOrEqual(0);
      expect(de('cumplimiento_semanal').valor).toBeLessThanOrEqual(1);
      expect(r.obrasEnCurso).toBeGreaterThan(0);
      // qué obras están detrás del saldo con los subs, con su folio y su cliente (D-099); suman lo del indicador
      const saldo = r.detalle.saldo_subcontratistas!;
      expect(saldo.map((x) => x.folio)).toContain('OB-001');
      expect(saldo.find((x) => x.folio === 'OB-001')).toMatchObject({ cliente: expect.any(String) });
      expect(saldo.reduce((a, x) => a + x.monto!, 0)).toBeCloseTo(Number(b!.saldo), 2);
    }));

  it('con la meta que la empresa cambió', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await tx`
        insert into metas_indicadores (empresa_id, indicador, meta)
        values ('e000000a-0000-4000-8000-000000000000', 'punch_por_obra', 3)
        on conflict (empresa_id, indicador) do update set meta = 3`;
      const r = await indicadoresDeLaEmpresa(tx, LUNES);
      expect(r.indicadores.find((i) => i.clave === 'punch_por_obra')?.meta).toBe(3);
    }));

  it('el PM no los ve', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => indicadoresDeLaEmpresa(tx, LUNES))).toBe('solo_dueno');
    }));
});
