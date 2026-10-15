// Las órdenes de cambio ya hechas (D-081), con los datos de supabase/seed.sql: en OB-001 (de Carlos) la orden
// propuesta (OC-11), la autorizada por hacer (OC-12) y la facturada ya hecha (OC-13).
import { afterAll, describe, expect, it } from 'vitest';
import {
  cambiosDeObra,
  inicioDelPm,
  marcarCambioHecho,
  portalCliente,
  sinIdentidad,
  type Tx,
} from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);
const TOKEN = 'enlace-de-prueba-cliente-garcia-2026';

/** Las órdenes de OB-001 por estado (como el dueño, que las ve todas); deja la identidad de `quien`. */
async function ordenes(tx: Tx, quien: string) {
  await como(tx, USUARIOS.duenoA);
  const filas = await tx<{ id: string; estado: string }[]>`
    select id, estado from ordenes_cambio where obra_id = ${OBRAS.a1Carlos}`;
  await como(tx, quien);
  const de = (estado: string) => filas.find((f) => f.estado === estado)!.id;
  return { propuesta: de('propuesta'), autorizada: de('autorizada'), facturada: de('facturada') };
}

describe('las órdenes de cambio hechas', () => {
  it('el PM marca hecha una orden aprobada; sale de las que le faltan; una sola vez', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const oc = await ordenes(tx, USUARIOS.carlos);
      const antes = (await inicioDelPm(tx, LUNES)).cambios.filter((c) => c.obra === 'OB-001');
      expect(antes.map((c) => [c.id, c.hecha !== null])).toEqual([
        [oc.autorizada, false],
        [oc.facturada, true],
      ]);

      const r = await marcarCambioHecho(tx, { ordenId: oc.autorizada, nota: 'Nicho listo' }, LUNES);
      expect(r.obraId).toBe(OBRAS.a1Carlos);
      const despues = (await inicioDelPm(tx, LUNES)).cambios.find((c) => c.id === oc.autorizada)!;
      expect(despues.hecha).not.toBeNull();
      expect(despues.nueva).toBe(false);
      expect(await codigo(tx, () => marcarCambioHecho(tx, { ordenId: oc.autorizada }, LUNES))).toBe(
        'cambio_ya_hecho',
      );
    }));

  it('no se marca una orden que el cliente no ha aprobado, ni la de otra obra', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const oc = await ordenes(tx, USUARIOS.carlos);
      // el PM ni la ve
      expect(await codigo(tx, () => marcarCambioHecho(tx, { ordenId: oc.propuesta }, LUNES))).toBe(
        'orden_no_encontrada',
      );
      // el dueño la ve, pero no está aprobada
      await como(tx, USUARIOS.duenoA);
      expect(await codigo(tx, () => marcarCambioHecho(tx, { ordenId: oc.propuesta }, LUNES))).toBe(
        'cambio_no_autorizado',
      );
      // otro PM no la ve
      await como(tx, USUARIOS.luis);
      expect(await codigo(tx, () => marcarCambioHecho(tx, { ordenId: oc.autorizada }, LUNES))).toBe(
        'orden_no_encontrada',
      );
    }));

  it('el dueño lo ve en las órdenes de la obra (quién y su nota) y el cliente en su portal', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const oc = await ordenes(tx, USUARIOS.carlos);
      await marcarCambioHecho(tx, { ordenId: oc.autorizada, nota: 'Nicho listo' }, LUNES);

      await como(tx, USUARIOS.duenoA);
      const c = (await cambiosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!;
      expect(c.ordenes.find((o) => o.id === oc.autorizada)!.hecho).toMatchObject({
        por: 'Carlos Méndez',
        nota: 'Nicho listo',
        fotos: [],
      });
      expect(c.ordenes.find((o) => o.id === oc.propuesta)!.hecho).toBeNull();

      await sinIdentidad(tx);
      const p = (await portalCliente(tx, { token: TOKEN }, LUNES))!;
      const delCliente = (id: string) => p.cambios.ordenes.find((o) => o.id === id)!;
      expect(delCliente(oc.autorizada).hecho).toMatchObject({ fotos: [] });
      expect(delCliente(oc.facturada).hecho).not.toBeNull();
      expect(delCliente(oc.propuesta).hecho).toBeNull();
    }));
});
