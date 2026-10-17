// Los retrabajos, las garantías y el seguimiento después de la entrega (D-090), con supabase/seed.sql: OB-001 va en
// obra; OB-003 ya se entregó (el 2026-10-30, con garantía hasta el 2027-10-30).
import { afterAll, describe, expect, it } from 'vitest';
import {
  cerrarGarantia,
  marcarPosventa,
  pendientesDePosventa,
  posventaDeObra,
  registrarNoCalidad,
  retrabajosDeObra,
} from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);

describe('retrabajos y garantías', () => {
  it('un retrabajo nace cerrado con su costo y sus días; una garantía, abierta, y solo en una obra entregada', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const r = await registrarNoCalidad(
        tx,
        {
          obraId: OBRAS.a1Carlos,
          tipo: 'retrabajo',
          causa: 'error_instalacion',
          costo: 240,
          diasPerdidos: 1,
          descripcion: 'Repetir el sellado de la regadera',
        },
        LUNES,
      );
      expect(r.folio).toMatch(/^NC-\d{4}$/);
      expect(
        await codigo(tx, () =>
          registrarNoCalidad(
            tx,
            { obraId: OBRAS.a1Carlos, tipo: 'garantia', descripcion: 'Gotea la llave' },
            LUNES,
          ),
        ),
      ).toBe('garantia_sin_entrega');

      const g = await registrarNoCalidad(
        tx,
        {
          obraId: OBRAS.a3Entregada,
          tipo: 'garantia',
          causa: 'material_defectuoso',
          descripcion: 'Se despegó una pieza de tile',
          diasPerdidos: 5,
        },
        LUNES,
      );
      const lista = (await retrabajosDeObra(tx, { obraId: OBRAS.a3Entregada }, LUNES))!;
      expect(lista.registros.find((x) => x.id === g.id)).toMatchObject({
        tipo: 'garantia',
        abierto: true,
        costo: 0,
        diasPerdidos: 0,
      });

      await cerrarGarantia(tx, { noCalidadId: g.id, costo: 180 }, LUNES);
      const [n] = await tx`select estado, costo from no_calidad where id = ${g.id}`;
      expect(n).toEqual({ estado: 'cerrado', costo: '180.00' });
      expect(await codigo(tx, () => cerrarGarantia(tx, { noCalidadId: g.id, costo: 0 }, LUNES))).toBe(
        'ya_cerrado',
      );
      expect(
        await codigo(tx, () =>
          registrarNoCalidad(tx, { obraId: OBRAS.a1Carlos, tipo: 'retrabajo', descripcion: 'x' }, LUNES),
        ),
      ).toBe('falta_descripcion');
    }));

  it('después de la entrega: los pasos se marcan, y lo pendiente sale en el inicio del dueño', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const p = (await posventaDeObra(tx, { obraId: OBRAS.a3Entregada }, LUNES))!;
      expect(p).toMatchObject({ fechaEntrega: '2026-10-30', garantiaVence: '2027-10-30' });
      expect(p.pasos.resena_recibida).toBe(false);

      // a la semana de entregar, sin reseña
      const semana = enAustin('2026-11-06', 9);
      expect((await pendientesDePosventa(tx, semana)).sinResena.map((x) => x.folio)).toEqual(['OB-003']);
      await marcarPosventa(tx, { obraId: OBRAS.a3Entregada, paso: 'resena_recibida', hecho: true }, semana);
      expect((await posventaDeObra(tx, { obraId: OBRAS.a3Entregada }, semana))!.pasos.resena_recibida).toBe(
        true,
      );
      expect((await pendientesDePosventa(tx, semana)).sinResena).toEqual([]);

      // un mes antes de que venza la garantía: la visita de los 11 meses
      const mes11 = enAustin('2027-10-01', 9);
      expect((await pendientesDePosventa(tx, mes11)).visitas.map((x) => x.folio)).toEqual(['OB-003']);
    }));

  it('el PM no lo ve', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => retrabajosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))).toBe(
        'solo_dueno',
      );
      expect(await codigo(tx, () => pendientesDePosventa(tx, LUNES))).toBe('solo_dueno');
    }));
});
