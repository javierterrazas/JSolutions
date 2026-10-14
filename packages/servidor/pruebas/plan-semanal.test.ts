// El plan de la semana (D-079), con los datos de supabase/seed.sql: el seed trae congelado el de la semana del 5 de
// octubre (la demolición del baño de OB-001, terminada ese día). "Hoy" es el lunes 12 de octubre de 2026 en Austin.
import { afterAll, describe, expect, it } from 'vitest';
import { congelarPlanSemanal, cumplimientoDelPlan } from '../src/index';
import { codigo, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);

describe('el plan de la semana', () => {
  it('se congela una vez por semana, con lo que el cronograma prevé terminar en las obras en curso', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const n = await congelarPlanSemanal(tx, LUNES);
      expect(n).toBeGreaterThan(0);
      const filas = await tx<{ obra_id: string; fin: string; estado: string }[]>`
        select ps.obra_id, to_char(ps.fin_previsto, 'YYYY-MM-DD') as fin, o.estado
        from plan_semanal ps join obras o on o.id = ps.obra_id where ps.semana = '2026-10-12'`;
      expect(filas).toHaveLength(n);
      for (const f of filas) {
        expect(f.estado).toBe('en_obra');
        expect(f.fin >= '2026-10-12' && f.fin <= '2026-10-18').toBe(true);
      }
      // ya congelado, abrir otra vez no cambia nada, aunque sea otro día de la semana
      expect(await congelarPlanSemanal(tx, enAustin('2026-10-14', 9))).toBe(0);
      const [c] = await tx<
        { n: number }[]
      >`select count(*)::int as n from plan_semanal where semana = '2026-10-12'`;
      expect(c!.n).toBe(n);
    }));

  it('el detalle de la semana pasada: qué se prometió y si se terminó a tiempo; y cuánto lleva esta', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const antes = await cumplimientoDelPlan(tx, LUNES);
      expect(antes).toMatchObject({ lunes: '2026-10-05', domingo: '2026-10-11', estaSemana: 0 });
      expect(antes.partidas).toContainEqual(
        expect.objectContaining({
          obraId: OBRAS.a1Carlos,
          folio: 'OB-001',
          espacio: 'Baño principal',
          finPrevisto: '2026-10-06',
          terminadaEl: '2026-10-05',
          cumplida: true,
        }),
      );
      const n = await congelarPlanSemanal(tx, LUNES);
      expect((await cumplimientoDelPlan(tx, LUNES)).estaSemana).toBe(n);
    }));

  it('solo el dueño o el administrador', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      expect(await codigo(tx, () => congelarPlanSemanal(tx, LUNES))).toBe('solo_dueno');
      expect(await codigo(tx, () => cumplimientoDelPlan(tx, LUNES))).toBe('solo_dueno');
    }));
});
