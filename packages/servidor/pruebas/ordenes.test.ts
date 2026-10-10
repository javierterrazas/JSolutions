// Las órdenes de trabajo para el PM (fase 2, paso 6d; legacy: pmConfirmarOT, pmAprobarOT), con los datos de
// supabase/seed.sql: en OB-001 de Carlos, la orden del rough de plomería (Plomería Rápida) está emitida, y otra ya
// pagada que el PM nunca ve.
import { afterAll, describe, expect, it } from 'vitest';
import { aprobarOrden, confirmarOrden, ordenesDelPm, type Tx } from '../src/index';
import { codigo, como, MIEMBROS, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

async function laEmitida(tx: Tx) {
  return (
    await tx<{ id: string }[]>`
      select id from ordenes_trabajo where obra_id = ${OBRAS.a1Carlos} and estado = 'emitida'`
  )[0]!.id;
}

describe('las órdenes del PM', () => {
  it('trae la que falta confirmar, con su sub, su oficio y su partida; nunca la pagada ni su precio', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const d = (await ordenesDelPm(tx, { obraId: OBRAS.a1Carlos }))!;
      expect(d.porConfirmar).toEqual([
        expect.objectContaining({
          sub: 'Plomería Rápida',
          telefono: '512-555-0200',
          oficio: { es: 'Plomería', en: 'Plumbing' },
          alcance: 'Rough de plomería del baño',
          partida: expect.objectContaining({ es: 'Rough de plomería' }),
          inicio: '2026-10-07',
        }),
      ]);
      expect(d.porAprobar).toEqual([]);
      expect(JSON.stringify(d)).not.toMatch(/precio|monto|Ajuste de presión/);
      await como(tx, USUARIOS.luis);
      expect(await ordenesDelPm(tx, { obraId: OBRAS.a1Carlos })).toBeNull();
    }));

  it('confirmar: queda confirmada con su hora y ya no se pide; dos veces no', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const id = await laEmitida(tx);
      await confirmarOrden(tx, { ordenId: id });
      const [o] =
        await tx`select estado, confirmada_en is not null as confirmada from ordenes_trabajo where id = ${id}`;
      expect(o).toEqual({ estado: 'confirmada', confirmada: true });
      expect((await ordenesDelPm(tx, { obraId: OBRAS.a1Carlos }))!.porConfirmar).toEqual([]);
      expect(await codigo(tx, () => confirmarOrden(tx, { ordenId: id }))).toBe('orden_ya_confirmada');
    }));

  it('aprobar: cuando el sub ya llegó; queda a nombre del PM y sale de la lista', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const id = await laEmitida(tx);
      // que llegó lo marca el cierre del día
      await tx`update ordenes_trabajo set se_presento = true where id = ${id}`;
      expect((await ordenesDelPm(tx, { obraId: OBRAS.a1Carlos }))!.porAprobar.map((o) => o.id)).toEqual([id]);
      await aprobarOrden(tx, { ordenId: id });
      const [o] = await tx`select estado, aprobada_por from ordenes_trabajo where id = ${id}`;
      expect(o).toEqual({ estado: 'aprobada', aprobada_por: MIEMBROS.carlos });
      expect((await ordenesDelPm(tx, { obraId: OBRAS.a1Carlos }))!.porAprobar).toEqual([]);
      expect(await codigo(tx, () => aprobarOrden(tx, { ordenId: id }))).toBe('orden_no_encontrada');
    }));

  it('otro PM no confirma ni aprueba las órdenes de una obra que no es suya', () =>
    probarComo(USUARIOS.luis, async (tx) => {
      await como(tx, USUARIOS.carlos);
      const id = await laEmitida(tx);
      await como(tx, USUARIOS.luis);
      expect(await codigo(tx, () => confirmarOrden(tx, { ordenId: id }))).toBe('orden_no_encontrada');
      expect(await codigo(tx, () => aprobarOrden(tx, { ordenId: id }))).toBe('orden_no_encontrada');
    }));
});
