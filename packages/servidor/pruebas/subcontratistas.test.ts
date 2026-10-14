// Los subcontratistas de la empresa (D-073), con los datos de supabase/seed.sql: "Plomería Rápida", plomero (oficio
// que requiere licencia), con seguro hasta el 30 de junio de 2027, licencia M-12345 y W-9, y una orden de trabajo
// abierta en OB-001. "Hoy" es el lunes 12 de octubre de 2026.
import { afterAll, describe, expect, it } from 'vitest';
import { cambiarActivoSub, guardarSubcontratista, subcontratistas, type Tx } from '../src/index';
import { codigo, como, enAustin, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);

async function oficio(tx: Tx, nombre: string): Promise<string> {
  const [o] = await tx<{ id: string }[]>`select id from oficios where nombre_es = ${nombre}`;
  return o!.id;
}

describe('los subcontratistas de la empresa', () => {
  it('la lista trae cada uno con su oficio, sus papeles y sus órdenes abiertas', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const l = await subcontratistas(tx, LUNES);
      expect(l.hoy).toBe('2026-10-12');
      expect(l.oficios.length).toBeGreaterThan(0);
      const plomeria = l.subcontratistas.find((x) => x.nombre === 'Plomería Rápida')!;
      expect(plomeria).toMatchObject({
        telefono: '512-555-0200',
        seguroVence: '2027-06-30',
        licencia: 'M-12345',
        w9: true,
        activo: true,
        avisos: [],
        oficio: { requiereLicencia: true },
      });
      expect(plomeria.ordenesAbiertas).toBeGreaterThan(0);
    }));

  it('da de alta uno nuevo y avisa lo que le falta en papeles; lo edita', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const plomeria = await oficio(tx, 'Plomería');
      const r = await guardarSubcontratista(
        tx,
        { nombre: ' Drenajes del Sur ', oficioId: plomeria, telefono: '512-555-0300' },
        LUNES,
      );
      expect(r.avisos).toEqual([{ codigo: 'sin_seguro' }, { codigo: 'sin_licencia' }]);
      const editado = await guardarSubcontratista(
        tx,
        {
          subId: r.subId,
          nombre: 'Drenajes del Sur',
          oficioId: plomeria,
          telefono: '512-555-0300',
          seguroVence: '2026-11-01',
          licencia: 'M-777',
          w9: true,
        },
        LUNES,
      );
      expect(editado.avisos).toEqual([{ codigo: 'seguro_por_vencer', dia: '2026-11-01' }]);
      const l = await subcontratistas(tx, LUNES);
      expect(l.subcontratistas.find((x) => x.id === r.subId)).toMatchObject({
        nombre: 'Drenajes del Sur',
        licencia: 'M-777',
        w9: true,
        ordenesAbiertas: 0,
      });
    }));

  it('pide nombre, oficio y teléfono; no repite el nombre; el PM no los gestiona', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const plomeria = await oficio(tx, 'Plomería');
      expect(await codigo(tx, () => guardarSubcontratista(tx, { nombre: ' ' }, LUNES))).toBe('faltan');
      expect(
        await codigo(tx, () =>
          guardarSubcontratista(tx, { nombre: 'plomería rápida ', oficioId: plomeria, telefono: '1' }, LUNES),
        ),
      ).toBe('sub_repetido');
      expect(
        await codigo(tx, () =>
          guardarSubcontratista(
            tx,
            { nombre: 'Otro', oficioId: 'a2000000-0000-4000-8000-000000000099', telefono: '1' },
            LUNES,
          ),
        ),
      ).toBe('oficio_inexistente');
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => subcontratistas(tx, LUNES))).toBe('solo_dueno');
      expect(
        await codigo(tx, () =>
          guardarSubcontratista(tx, { nombre: 'Otro', oficioId: plomeria, telefono: '1' }, LUNES),
        ),
      ).toBe('solo_dueno');
    }));

  it('de baja, dice cuántas órdenes abiertas le quedan; se reactiva', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const sub = (await subcontratistas(tx, LUNES)).subcontratistas.find(
        (x) => x.nombre === 'Plomería Rápida',
      )!;
      const r = await cambiarActivoSub(tx, { subId: sub.id, activo: false }, LUNES);
      expect(r.abiertas).toBe(sub.ordenesAbiertas);
      let l = await subcontratistas(tx, LUNES);
      expect(l.subcontratistas.find((x) => x.id === sub.id)?.activo).toBe(false);
      await cambiarActivoSub(tx, { subId: sub.id, activo: true }, LUNES);
      l = await subcontratistas(tx, LUNES);
      expect(l.subcontratistas.find((x) => x.id === sub.id)?.activo).toBe(true);
    }));
});
