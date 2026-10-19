// La orden de cambio que sale de un aviso del PM y la que el dueño corrige antes de que el cliente responda (D-103),
// con supabase/seed.sql: en OB-001 Carlos tiene abierto un aviso por humedad detrás del muro (condición oculta), y hay
// una orden por aprobar de $650 de costo y $1,000 de precio. El margen mínimo es 35%.
import { afterAll, describe, expect, it } from 'vitest';
import {
  avisoParaOrden,
  cambiosDeObra,
  crearOrdenCambio,
  datosParaAviso,
  editarOrdenCambio,
  portalCliente,
  responderCambioCliente,
  sinIdentidad,
  type Tx,
} from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);
const TOKEN = 'enlace-de-prueba-cliente-garcia-2026';
const FIRMA = 'data:image/png;base64,iVBORw0KGgo=';

async function avisoDe(tx: Tx, obraId: string): Promise<string> {
  const [a] = await tx<
    { id: string }[]
  >`select id from avisos where obra_id = ${obraId} and estado = 'abierto'`;
  return a!.id;
}

async function porAprobar(tx: Tx): Promise<string> {
  const [o] = await tx<{ id: string }[]>`
    select id from ordenes_cambio where obra_id = ${OBRAS.a1Carlos} and estado = 'propuesta'`;
  return o!.id;
}

const orden = {
  obraId: OBRAS.a1Carlos,
  motivo: 'condicion_oculta' as const,
  descripcion: 'Cambiar el tramo de muro húmedo de la regadera y su barrera de vapor',
  hallazgo: '2026-10-12',
  costo: 650,
  precio: 1000,
  dias: 1,
};

describe('la orden de cambio desde un aviso del PM', () => {
  it('trae lo que escribió el PM, su día y el motivo que le toca', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const id = await avisoDe(tx, OBRAS.a1Carlos);
      expect(await avisoParaOrden(tx, { obraId: OBRAS.a1Carlos, avisoId: id }, LUNES)).toMatchObject({
        id,
        folio: expect.stringMatching(/^BLQ-/),
        tipo: 'condicion_oculta',
        motivo: 'condicion_oculta',
        descripcion: 'Hay humedad detrás del muro de la regadera',
        dia: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        pm: expect.any(String),
        fotos: [],
        abierto: true,
      });
      // de otra obra, nada
      expect(await avisoParaOrden(tx, { obraId: OBRAS.a2Luis, avisoId: id }, LUNES)).toBeNull();
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => avisoParaOrden(tx, { obraId: OBRAS.a1Carlos, avisoId: id }, LUNES))).toBe(
        'solo_dueno',
      );
    }));

  it('emitida, queda ligada al aviso y al PM se le contesta con el folio', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const avisoId = await avisoDe(tx, OBRAS.a1Carlos);
      const r = await crearOrdenCambio(
        tx,
        { ...orden, avisoId, respuestaAviso: 'Se emitió la orden {folio} para que el cliente la apruebe.' },
        LUNES,
      );
      if (!r.ok) throw new Error('no se emitió');
      const o = (await cambiosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.ordenes.find(
        (x) => x.id === r.ordenId,
      )!;
      expect(o.aviso).toMatchObject({
        id: avisoId,
        descripcion: 'Hay humedad detrás del muro de la regadera',
      });

      await como(tx, USUARIOS.carlos);
      const a = (await datosParaAviso(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.avisos.find(
        (x) => x.id === avisoId,
      )!;
      expect(a.respuesta).toBe(`Se emitió la orden ${r.folio} para que el cliente la apruebe.`);
    }));

  it('un aviso ya contestado se liga sin tocar su respuesta; uno de otra obra no', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const avisoId = await avisoDe(tx, OBRAS.a1Carlos);
      await tx`update avisos set estado = 'cerrado', respuesta = 'Ya lo vimos', respondido_en = now()
               where id = ${avisoId}`;
      const r = await crearOrdenCambio(tx, { ...orden, avisoId, respuestaAviso: 'Otra respuesta' }, LUNES);
      expect(r.ok).toBe(true);
      const [a] = await tx<{ respuesta: string }[]>`select respuesta from avisos where id = ${avisoId}`;
      expect(a!.respuesta).toBe('Ya lo vimos');

      const deLuis = await avisoDe(tx, OBRAS.a2Luis);
      expect(await codigo(tx, () => crearOrdenCambio(tx, { ...orden, avisoId: deLuis }, LUNES))).toBe(
        'registro_no_encontrado',
      );
    }));
});

describe('corregir una orden antes de que el cliente responda', () => {
  it('el dueño la describe mejor y ajusta el precio, con las reglas de siempre', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const id = await porAprobar(tx);
      const cambios = {
        ordenId: id,
        motivo: 'condicion_oculta' as const,
        descripcion: 'Cambiar toda la tubería galvanizada del baño por PEX, con sus llaves de paso',
        hallazgo: '2026-10-10',
        costo: 900,
        precio: 1200,
        dias: 3,
        condicion: 'mitad_al_autorizar' as const,
      };
      expect(await editarOrdenCambio(tx, cambios, LUNES)).toMatchObject({
        ok: false,
        confirmar: 'margen_bajo',
      });
      expect(await editarOrdenCambio(tx, { ...cambios, precio: 1400 }, LUNES)).toMatchObject({ ok: true });
      const o = (await cambiosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.ordenes.find(
        (x) => x.id === id,
      )!;
      expect(o).toMatchObject({
        descripcion: cambios.descripcion,
        hallazgo: '2026-10-10',
        costo: 900,
        precio: 1400,
        dias: 3,
        condicion: 'mitad_al_autorizar',
        estado: 'propuesta',
      });
      expect(
        await codigo(tx, () =>
          editarOrdenCambio(tx, { ...cambios, precio: 1400, hallazgo: '2026-10-13' }, LUNES),
        ),
      ).toBe('hallazgo_futuro');

      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => editarOrdenCambio(tx, cambios, LUNES))).toBe('solo_dueno');
    }));

  it('respondida ya no cambia: lo que el cliente firmó es lo que queda', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const [o] = await tx<{ id: string }[]>`
        select id from ordenes_cambio where obra_id = ${OBRAS.a1Carlos} and estado = 'autorizada'`;
      expect(
        await codigo(tx, () =>
          editarOrdenCambio(tx, { ordenId: o!.id, ...orden, descripcion: 'Otra cosa', precio: 2000 }, LUNES),
        ),
      ).toBe('orden_ya_respondida');
    }));

  it('si cambió mientras el cliente la veía, su respuesta no entra y ve la nueva', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const id = await porAprobar(tx);
      await sinIdentidad(tx);
      const vista = (await portalCliente(tx, { token: TOKEN }, LUNES))!.cambios.ordenes.find(
        (x) => x.id === id,
      )!;

      await como(tx, USUARIOS.duenoA);
      await editarOrdenCambio(
        tx,
        { ordenId: id, ...orden, descripcion: 'Cambiar la tubería galvanizada por PEX', precio: 1100 },
        LUNES,
      );

      await sinIdentidad(tx);
      const respuesta = {
        token: TOKEN,
        ordenId: id,
        decision: 'aprobada' as const,
        nombre: 'Ana García',
        firma: FIRMA,
      };
      expect(await codigo(tx, () => responderCambioCliente(tx, { ...respuesta, huella: vista.huella }))).toBe(
        'orden_cambiada',
      );
      const nueva = (await portalCliente(tx, { token: TOKEN }, LUNES))!.cambios.ordenes.find(
        (x) => x.id === id,
      )!;
      expect(nueva).toMatchObject({ estado: 'propuesta', respuesta: null, precio: 1100 });
      expect(nueva.huella).not.toBe(vista.huella);

      await responderCambioCliente(tx, { ...respuesta, huella: nueva.huella });
      expect(
        (await portalCliente(tx, { token: TOKEN }, LUNES))!.cambios.ordenes.find((x) => x.id === id),
      ).toMatchObject({ estado: 'autorizada', descripcion: 'Cambiar la tubería galvanizada por PEX' });
    }));
});
