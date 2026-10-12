// La cuadrilla para el dueño (D-061), con los datos de supabase/seed.sql: Pedro (Ayudante) cobra $22.50 la hora desde
// el 2026-01-01 y ya tiene horas anotadas en un cierre; Juan (Oficial) cobra $220 el día. "Hoy" es el lunes 12 de
// octubre de 2026 en Austin.
import { afterAll, describe, expect, it } from 'vitest';
import {
  altaTrabajador,
  cambiarActivoTrabajador,
  cambiarTarifa,
  cuadrilla,
  datosParaCierre,
  editarTrabajador,
  type Tx,
} from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);
const de = async (tx: Tx, nombre: string) =>
  (await cuadrilla(tx, LUNES)).trabajadores.find((t) => t.nombre === nombre)!;
/** A quién le ofrece el cierre del PM anotar en la cuadrilla. */
const enElCierre = async (tx: Tx) =>
  (await datosParaCierre(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.trabajadores.map((t) => t.nombre);

describe('la cuadrilla del dueño', () => {
  it('ve a cada trabajador con su puesto, cómo cobra y su tarifa; el PM no', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      expect(await de(tx, 'Pedro')).toMatchObject({
        puesto: 'Ayudante',
        tipoPago: 'hora',
        activo: true,
        tarifa: 22.5,
        tarifas: [{ tarifa: 22.5, vigenteDesde: '2026-01-01' }],
        diasTrabajados: expect.any(Number),
      });
      expect((await de(tx, 'Pedro')).diasTrabajados).toBeGreaterThan(0);
      expect(await de(tx, 'Juan')).toMatchObject({ tipoPago: 'dia', tarifa: 220 });
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => cuadrilla(tx, LUNES))).toBe('solo_dueno');
      expect(await codigo(tx, () => altaTrabajador(tx, { nombre: 'X', tipoPago: 'hora', tarifa: 1 }))).toBe(
        'solo_dueno',
      );
    }));

  it('da de alta a un trabajador con su tarifa; el PM lo ve en el cierre, nunca su tarifa', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      expect(await codigo(tx, () => altaTrabajador(tx, {}, LUNES))).toBe('faltan');
      expect(
        await codigo(tx, () => altaTrabajador(tx, { nombre: 'Rosa', tipoPago: 'hora', tarifa: 0 }, LUNES)),
      ).toBe('tarifa_invalida');
      expect(
        await codigo(tx, () =>
          altaTrabajador(tx, { nombre: ' pedro ', tipoPago: 'dia', tarifa: 200 }, LUNES),
        ),
      ).toBe('trabajador_repetido');

      const { trabajadorId } = await altaTrabajador(
        tx,
        { nombre: ' Rosa ', puesto: 'Plomera', tipoPago: 'hora', tarifa: 28, telefono: '512-555-0301' },
        LUNES,
      );
      expect(await de(tx, 'Rosa')).toMatchObject({
        id: trabajadorId,
        puesto: 'Plomera',
        telefono: '512-555-0301',
        tarifa: 28,
        tarifas: [{ tarifa: 28, vigenteDesde: '2026-10-12' }],
        diasTrabajados: 0,
      });
      await como(tx, USUARIOS.carlos);
      expect(await enElCierre(tx)).toContain('Rosa');
      expect(await tx`select * from tarifas_trabajador where trabajador_id = ${trabajadorId}`).toEqual([]);
    }));

  it('cambia nombre, puesto y teléfono; cómo cobra, solo si todavía no tiene días anotados', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const pedro = await de(tx, 'Pedro');
      await editarTrabajador(tx, { trabajadorId: pedro.id, nombre: 'Pedro Luna', puesto: 'Oficial' }, LUNES);
      expect(await de(tx, 'Pedro Luna')).toMatchObject({ puesto: 'Oficial', tipoPago: 'hora' });
      expect(
        await codigo(tx, () =>
          editarTrabajador(tx, { trabajadorId: pedro.id, nombre: 'Pedro Luna', tipoPago: 'dia' }, LUNES),
        ),
      ).toBe('tipo_pago_con_registros');
      expect(
        await codigo(tx, () => editarTrabajador(tx, { trabajadorId: pedro.id, nombre: 'Juan' }, LUNES)),
      ).toBe('trabajador_repetido');

      const { trabajadorId } = await altaTrabajador(
        tx,
        { nombre: 'Rosa', tipoPago: 'hora', tarifa: 28 },
        LUNES,
      );
      await editarTrabajador(tx, { trabajadorId, nombre: 'Rosa', tipoPago: 'dia' }, LUNES);
      expect(await de(tx, 'Rosa')).toMatchObject({ tipoPago: 'dia' });
    }));

  it('el salario cambia desde una fecha: lo trabajado antes se queda con su tarifa; el mismo día se corrige con rastro', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const pedro = await de(tx, 'Pedro');
      await cambiarTarifa(tx, { trabajadorId: pedro.id, tarifa: 25, vigenteDesde: '2026-10-19' }, LUNES);
      expect(await de(tx, 'Pedro')).toMatchObject({
        tarifa: 22.5,
        tarifas: [
          { tarifa: 25, vigenteDesde: '2026-10-19' },
          { tarifa: 22.5, vigenteDesde: '2026-01-01' },
        ],
      });
      expect(
        await codigo(tx, () =>
          cambiarTarifa(tx, { trabajadorId: pedro.id, tarifa: 24, vigenteDesde: '2026-10-01' }, LUNES),
        ),
      ).toBe('tarifa_anterior');
      expect(await codigo(tx, () => cambiarTarifa(tx, { trabajadorId: pedro.id, tarifa: -3 }, LUNES))).toBe(
        'tarifa_invalida',
      );

      // la del mismo día se corrige, y queda en el rastro
      await cambiarTarifa(tx, { trabajadorId: pedro.id, tarifa: 26, vigenteDesde: '2026-10-19' }, LUNES);
      expect((await de(tx, 'Pedro')).tarifas[0]).toEqual({ tarifa: 26, vigenteDesde: '2026-10-19' });
      const [rastro] = await tx`
        select tabla, campo, antes, despues from correcciones where tabla = 'tarifas_trabajador'`;
      expect(rastro).toEqual({ tabla: 'tarifas_trabajador', campo: 'tarifa', antes: '25.00', despues: '26' });
    }));

  it('dado de baja ya no aparece en el cierre del PM; reactivado, vuelve, si su nombre no lo tiene otro', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const juan = await de(tx, 'Juan');
      await cambiarActivoTrabajador(tx, { trabajadorId: juan.id, activo: false }, LUNES);
      expect(await de(tx, 'Juan')).toMatchObject({ activo: false });
      await como(tx, USUARIOS.carlos);
      expect(await enElCierre(tx)).not.toContain('Juan');

      await como(tx, USUARIOS.duenoA);
      const otro = await altaTrabajador(tx, { nombre: 'Juan', tipoPago: 'dia', tarifa: 210 }, LUNES);
      expect(
        await codigo(tx, () => cambiarActivoTrabajador(tx, { trabajadorId: juan.id, activo: true }, LUNES)),
      ).toBe('trabajador_repetido');
      await cambiarActivoTrabajador(tx, { trabajadorId: otro.trabajadorId, activo: false }, LUNES);
      await cambiarActivoTrabajador(tx, { trabajadorId: juan.id, activo: true }, LUNES);
      await como(tx, USUARIOS.carlos);
      expect(await enElCierre(tx)).toContain('Juan');
    }));
});
