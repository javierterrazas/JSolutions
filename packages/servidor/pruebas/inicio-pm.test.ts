// El inicio del PM (fase 2, paso 3) con los datos de supabase/seed.sql: Carlos lleva OB-001 (en obra desde el lunes
// 5 de octubre de 2026, con su primer cierre ese día) y OB-003 (ya entregada); Luis lleva OB-002 (lista para
// arranque).
import { afterAll, describe, expect, it } from 'vitest';
import { inicioDelPm } from '../src/index';
import { como, EMPRESA_A, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

describe('el inicio del PM', () => {
  it('sus obras sin las entregadas, con su avance ponderado y sus entregas comprometida y prevista', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const r = await inicioDelPm(tx, enAustin('2026-10-08'));
      expect(r.hoy).toBe('2026-10-08');
      expect(r.obras.map((o) => o.folio)).toEqual(['OB-001']);
      const o = r.obras[0]!;
      expect(o).toMatchObject({ cliente: 'Familia García', estado: 'en_obra', cerradoHoy: false });
      expect(o.partidas.terminadas).toBe(1);
      expect(o.avance.pct).toBeGreaterThan(0);
      expect(o.avance.pct).toBeLessThan(1);
      // la entrega estimada (viernes 30) más 1 día de la orden de cambio autorizada: el sábado 31 (D-028)
      expect(o.entregaComprometida).toBe('2026-10-31');
      expect(o.entregaPrevista).not.toBeNull();
    }));

  it('los días que olvidó cerrar: los últimos 2 laborables desde su primer día con trabajo', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const r = await inicioDelPm(tx, enAustin('2026-10-08'));
      expect(r.obras[0]!.diasSinCierre).toEqual(['2026-10-06', '2026-10-07']);
      // la obra que no ha arrancado no tiene días sin cerrar
      await como(tx, USUARIOS.luis);
      const luis = await inicioDelPm(tx, enAustin('2026-10-08'));
      expect(luis.obras.map((x) => [x.folio, x.estado, x.diasSinCierre])).toEqual([
        ['OB-002', 'lista_para_arranque', []],
      ]);
    }));

  it('la racha: el día que cerró cuenta; al día siguiente sin cerrar, todavía no se rompe', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const lunes = await inicioDelPm(tx, enAustin('2026-10-05', 18));
      expect(lunes.racha).toBe(1);
      expect(lunes.obras[0]!.cerradoHoy).toBe(true);
      expect((await inicioDelPm(tx, enAustin('2026-10-06'))).racha).toBe(1);
      expect((await inicioDelPm(tx, enAustin('2026-10-08'))).racha).toBe(0);
    }));

  it('su semana: seis días laborables desde hoy, con las partidas que tocan', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const r = await inicioDelPm(tx, enAustin('2026-10-08'));
      expect(r.semana.map((d) => d.dia)).toEqual([
        '2026-10-08',
        '2026-10-09',
        '2026-10-10',
        '2026-10-12',
        '2026-10-13',
        '2026-10-14',
      ]);
      expect(r.semana.flatMap((d) => d.partidas).every((p) => p.obra === 'OB-001' && p.espacio)).toBe(true);
      expect(r.semana.some((d) => d.partidas.length > 0)).toBe(true);
    }));

  it('lo pendiente: la orden por confirmar, las órdenes de cambio a ejecutar, su aviso abierto y su gasto sin recibo', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const r = await inicioDelPm(tx, enAustin('2026-10-08'));
      // los folios los pone la base (asignar_folio): se revisa lo demás
      // la emitida sin confirmar; la pagada no
      expect(r.porConfirmar).toEqual([
        expect.objectContaining({
          obra: 'OB-001',
          folio: expect.stringMatching(/^OT-/),
          inicio: '2026-10-07',
        }),
      ]);
      // la autorizada y la facturada, no la propuesta; sin montos (D-002)
      expect(r.cambios.map((c) => [c.descripcion, c.dias]).sort()).toEqual([
        ['Nicho adicional en la regadera', 1],
        ['Tile de otra colección', 0],
      ]);
      expect(r.cambios.every((c) => c.nueva)).toBe(true);
      expect(r.cambios.flatMap((c) => Object.keys(c))).not.toContain('precio');
      // sus avisos y sus gastos se ven también de la obra que ya entregó (OB-003), sin su folio (D-025)
      expect(r.avisosAbiertos.map((a) => [a.obra, a.descripcion])).toEqual(
        expect.arrayContaining([
          ['OB-001', 'Hay humedad detrás del muro de la regadera'],
          [null, 'Hay humedad detrás del muro de la regadera'],
        ]),
      );
      expect(r.avisosAbiertos).toHaveLength(2);
      expect(r.respuestas).toEqual([]);
      // sus gastos del seed tienen recibo, también el de la obra entregada, aunque esa foto ya no la pueda ver
      expect(r.sinRecibo).toEqual([]);
      // un gasto suyo sin recibo sí aparece; la compra de la oficina (del dueño) nunca
      const [esp] = await tx<
        { id: string }[]
      >`select id from espacios where obra_id = ${OBRAS.a1Carlos} limit 1`;
      await tx`insert into gastos (empresa_id, obra_id, espacio_id, dia, categoria, proveedor, monto, metodo_pago, origen)
               values (${EMPRESA_A}, ${OBRAS.a1Carlos}, ${esp!.id}, '2026-10-07', 'material', 'Lowes', 85,
                       'tarjeta_empresa', 'pm')`;
      const despues = await inicioDelPm(tx, enAustin('2026-10-08'));
      expect(despues.sinRecibo.map((g) => [g.obra, g.proveedor, g.monto, g.dia])).toEqual([
        ['OB-001', 'Lowes', 85, '2026-10-07'],
      ]);
      // PC1 ya tiene su inspección aprobada: no está pendiente
      expect(r.obras[0]!.inspeccionesPendientes.map((i) => i.hito)).not.toContain('PC1');
    }));

  it('el dueño no es PM de ninguna obra: su inicio de PM viene vacío', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const r = await inicioDelPm(tx, enAustin('2026-10-08'));
      expect(r.obras).toEqual([]);
      expect(r.porConfirmar).toEqual([]);
    }));
});
