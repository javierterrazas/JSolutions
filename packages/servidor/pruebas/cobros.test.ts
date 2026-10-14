// Los cobros al cliente (D-071), con los datos de supabase/seed.sql: OB-001 de Carlos tiene un contrato de $24,000,
// dos órdenes de cambio autorizadas o facturadas de $1,000 cada una, y un depósito de $7,200 del 1 de octubre.
import { afterAll, describe, expect, it } from 'vitest';
import { anular, cobrosDeObra, corregir, portalCliente, registrarCobro, sinIdentidad } from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);
const TOKEN = 'enlace-de-prueba-cliente-garcia-2026';
const pago = (extra: Record<string, unknown> = {}) => ({
  obraId: OBRAS.a1Carlos,
  concepto: 'hito' as const,
  monto: 6500,
  metodo: 'cheque' as const,
  referencia: ' Cheque 1043 ',
  ...extra,
});

describe('los cobros al cliente', () => {
  it('lo cobrado contra el contrato con los cambios aprobados, y lo que falta', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const c = (await cobrosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!;
      expect(c).toMatchObject({
        contrato: 24000,
        cambios: 2000,
        total: 26000,
        cobrado: 7200,
        porCobrar: 18800,
        cerrada: false,
        entregada: false,
        hoy: '2026-10-12',
      });
      expect(c.cobros).toEqual([
        {
          id: expect.any(String),
          folio: expect.stringMatching(/^COB-\d{4}$/),
          fecha: '2026-10-01',
          concepto: 'deposito',
          monto: 7200,
          metodo: 'zelle',
          referencia: null,
        },
      ]);
    }));

  it('registra un pago (sin fecha, es de hoy); cuenta en lo cobrado y el cliente lo ve en su portal', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const r = await registrarCobro(tx, pago(), LUNES);
      expect(r.folio).toMatch(/^COB-\d{4}$/);
      const c = (await cobrosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!;
      expect(c.cobrado).toBe(13700);
      expect(c.porCobrar).toBe(12300);
      expect(c.cobros[0]).toMatchObject({ fecha: '2026-10-12', concepto: 'hito', referencia: 'Cheque 1043' });

      await sinIdentidad(tx);
      const p = (await portalCliente(tx, { token: TOKEN }, LUNES))!;
      expect(p.pagos.map((x) => [x.fecha, x.concepto, x.monto])).toEqual([
        ['2026-10-12', 'hito', 6500],
        ['2026-10-01', 'deposito', 7200],
      ]);
      // sin el método ni la referencia
      expect(JSON.stringify(p.pagos)).not.toMatch(/cheque|1043|zelle/i);
    }));

  it('se corrige y se anula con motivo; anulado, sale de lo cobrado y del portal', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { cobroId } = await registrarCobro(tx, pago({ fecha: '2026-10-09' }), LUNES);
      await corregir(
        tx,
        { tabla: 'cobros', registroId: cobroId, cambios: { monto: 6000 }, motivo: 'Era otro cheque' },
        LUNES,
      );
      expect((await cobrosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.cobrado).toBe(13200);
      await anular(tx, { tabla: 'cobros', registroId: cobroId, motivo: 'El cheque rebotó' }, LUNES);
      expect((await cobrosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.cobrado).toBe(7200);
      await sinIdentidad(tx);
      expect((await portalCliente(tx, { token: TOKEN }, LUNES))!.pagos).toHaveLength(1);
    }));

  it('rechaza lo que no cuadra; el PM no registra ni ve cobros', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      expect(await codigo(tx, () => registrarCobro(tx, { obraId: OBRAS.a1Carlos }, LUNES))).toBe('faltan');
      expect(await codigo(tx, () => registrarCobro(tx, pago({ monto: 0 }), LUNES))).toBe('monto_invalido');
      expect(await codigo(tx, () => registrarCobro(tx, pago({ fecha: '2026-10-13' }), LUNES))).toBe(
        'dia_futuro',
      );
      expect(
        await codigo(tx, () =>
          registrarCobro(tx, pago({ obraId: 'a2000000-0000-4000-8000-000000000099' }), LUNES),
        ),
      ).toBe('obra_no_encontrada');
      // OB-003 ya tiene su cierre financiero: ahí ya no se cobra
      expect((await cobrosDeObra(tx, { obraId: OBRAS.a3Entregada }, LUNES))!).toMatchObject({
        entregada: true,
        cerrada: true,
      });
      expect(
        await codigo(tx, () =>
          registrarCobro(tx, pago({ obraId: OBRAS.a3Entregada, concepto: 'liquidacion' }), LUNES),
        ),
      ).toBe('obra_cerrada');
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => registrarCobro(tx, pago(), LUNES))).toBe('solo_dueno');
      expect(await codigo(tx, () => cobrosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))).toBe('solo_dueno');
      expect(await tx`select id from cobros`).toHaveLength(0);
    }));
});
