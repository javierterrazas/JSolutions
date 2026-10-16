// El cierre de una obra (D-085), con los datos de supabase/seed.sql: OB-001 de Carlos va en obra, con contrato de
// $24,000, órdenes de cambio de $1,000 (una propuesta, una autorizada y una facturada), $7,200 cobrados, $5,100 de
// costo (material $2,620, cuadrilla $180 y subcontratos $2,300) y $975 de costo presupuestado en la demolición, que
// ya se terminó. OB-003 ya está entregada y cerrada.
import { afterAll, describe, expect, it } from 'vitest';
import { cerrarObra, revisionDeCierre } from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);

describe('el cierre de una obra', () => {
  it('la revisión: los números finales y lo que falta, lo grave primero', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const r = (await revisionDeCierre(tx, { obraId: OBRAS.a1Carlos }, LUNES))!;
      expect(r.cerrada).toBeNull();
      expect(r.numeros).toMatchObject({
        contratoOriginal: 24000,
        montoOC: 2000,
        contratoFinal: 26000,
        presupuestado: 975,
        cuadrilla: 180,
        subcontratos: 2300,
        cobrado: 7200,
      });
      expect(r.numeros.costo).toBeCloseTo(5100, 2);
      expect(r.numeros.margen).toBeCloseTo((26000 - 5100) / 26000, 6);
      expect(r.numeros.desviacion).toBeCloseTo((5100 - 975) / 975, 6);
      const de = (c: string) => r.avisos.find((a) => a.codigo === c);
      expect(de('falta_cobrar')).toEqual({
        gravedad: 'alto',
        codigo: 'falta_cobrar',
        datos: { monto: 18800 },
      });
      expect(de('oc_sin_responder')?.datos).toEqual({ n: 1 });
      expect(de('oc_sin_facturar')?.datos).toEqual({ n: 1 });
      expect(de('partidas_sin_terminar')?.gravedad).toBe('alto');
      expect(de('subs_por_pagar')?.gravedad).toBe('medio');
      // lo grave va primero
      const orden = r.avisos.map((a) => a.gravedad);
      expect(orden.indexOf('medio')).toBeGreaterThan(orden.lastIndexOf('alto'));
    }));

  it('con algo grave pide confirmar; confirmado, guarda la entrega, el resumen y el histórico', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const entrada = { obraId: OBRAS.a1Carlos, fechaEntrega: '2026-10-12', garantiaMeses: 12 };
      const sinConfirmar = await cerrarObra(tx, entrada, LUNES);
      expect(sinConfirmar).toMatchObject({ ok: false, confirmar: 'avisos' });
      expect((await tx`select 1 from obras_cerradas where obra_id = ${OBRAS.a1Carlos}`).length).toBe(0);

      const r = await cerrarObra(tx, { ...entrada, forzar: true }, LUNES);
      expect(r).toMatchObject({ ok: true, dias: 7 });

      const [o] = await tx`select estado, to_char(fecha_fin_real, 'YYYY-MM-DD') as fin from obras
                           where id = ${OBRAS.a1Carlos}`;
      expect(o).toEqual({ estado: 'entregada', fin: '2026-10-12' });
      const [e] = await tx`select to_char(fecha_entrega, 'YYYY-MM-DD') as fecha, garantia_meses,
                                  to_char(garantia_vence, 'YYYY-MM-DD') as vence
                           from entregas where obra_id = ${OBRAS.a1Carlos}`;
      expect(e).toEqual({ fecha: '2026-10-12', garantia_meses: 12, vence: '2027-10-12' });
      const [c] =
        await tx`select dias_ciclo, contrato_final, costo_total, presupuestado, cobrado from obras_cerradas
                           where obra_id = ${OBRAS.a1Carlos}`;
      expect(c).toEqual({
        dias_ciclo: 7,
        contrato_final: '26000.00',
        costo_total: '5100.00',
        presupuestado: '975.00',
        cobrado: '7200.00',
      });

      // la demolición del baño: $975 presupuestados, $180 reales, por pie²
      const etapas = await tx<
        { presupuestado: string; costo_real: string; pies2: string; costo_por_pie2: string | null }[]
      >`
        select h.presupuestado, h.costo_real, h.pies2, h.costo_por_pie2 from historico_etapas h
        join etapas et on et.id = h.etapa_id
        where h.obra_id = ${OBRAS.a1Carlos} and et.nombre_es = 'Demolición'`;
      expect(etapas).toHaveLength(1);
      expect(etapas[0]!.presupuestado).toBe('975.00');
      expect(etapas[0]!.costo_real).toBe('180.00');
      expect(Number(etapas[0]!.costo_por_pie2)).toBeCloseTo(180 / Number(etapas[0]!.pies2), 4);
      // la demolición se terminó el mismo día que empezó: un día real
      const duraciones = await tx<{ dias_reales: number }[]>`
        select dias_reales from historico_duraciones where obra_id = ${OBRAS.a1Carlos}`;
      expect(duraciones).toEqual([{ dias_reales: 1 }]);

      // cerrada, no se cierra otra vez y la revisión lo dice
      expect(await codigo(tx, () => cerrarObra(tx, { ...entrada, forzar: true }, LUNES))).toBe(
        'obra_ya_cerrada',
      );
      expect((await revisionDeCierre(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.cerrada).toMatchObject({
        fechaEntrega: '2026-10-12',
      });
    }));

  it('no con una fecha que no ha llegado ni antes del arranque; el PM no cierra', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const base = { obraId: OBRAS.a1Carlos, forzar: true };
      expect(await codigo(tx, () => cerrarObra(tx, { ...base, fechaEntrega: '2026-10-13' }, LUNES))).toBe(
        'fecha_futura',
      );
      expect(await codigo(tx, () => cerrarObra(tx, { ...base, fechaEntrega: '2026-09-01' }, LUNES))).toBe(
        'entrega_antes_del_inicio',
      );
      expect(
        await codigo(tx, () =>
          cerrarObra(tx, { obraId: OBRAS.a3Entregada, fechaEntrega: '2026-10-12' }, LUNES),
        ),
      ).toBe('obra_ya_cerrada');
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => revisionDeCierre(tx, { obraId: OBRAS.a1Carlos }, LUNES))).toBe(
        'solo_dueno',
      );
    }));
});
