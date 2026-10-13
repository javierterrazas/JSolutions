// Las órdenes de cambio (D-067), con los datos de supabase/seed.sql: OB-001 de Carlos tiene una por aprobar
// ("Cambiar tubería galvanizada", 2 días), una autorizada y una facturada, cada una con costo $650 y precio $1,000;
// su contrato es de $24,000 y su enlace del portal tiene un token conocido. El margen mínimo es 35%.
import { afterAll, describe, expect, it } from 'vitest';
import {
  cambiosDeObra,
  crearOrdenCambio,
  portalCliente,
  responderCambioCliente,
  responderCambioDueno,
  seguimientoDeObra,
  sinIdentidad,
  type Tx,
} from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);
const TOKEN = 'enlace-de-prueba-cliente-garcia-2026';
const FIRMA = 'data:image/png;base64,iVBORw0KGgo=';

const nueva = {
  obraId: OBRAS.a1Carlos,
  motivo: 'solicitud_cliente' as const,
  descripcion: 'Repisa de cuarzo en el nicho',
  hallazgo: '2026-10-12',
  costo: 260,
  precio: 400,
  dias: 0,
};

/** La orden por aprobar del seed. */
async function porAprobar(tx: Tx): Promise<string> {
  const [o] = await tx<{ id: string }[]>`
    select id from ordenes_cambio where obra_id = ${OBRAS.a1Carlos} and estado = 'propuesta'`;
  return o!.id;
}

describe('las órdenes de cambio del dueño', () => {
  it('lista las de la obra con su costo, precio, margen y respuesta; suma las autorizadas', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const c = (await cambiosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!;
      expect(c.contrato).toBe(24000);
      expect(c.margenMinimo).toBe(0.35);
      expect(c.autorizado).toBe(2000);
      expect(c.ordenes.map((o) => [o.descripcion, o.estado])).toEqual(
        expect.arrayContaining([
          ['Cambiar tubería galvanizada', 'propuesta'],
          ['Nicho adicional en la regadera', 'autorizada'],
          ['Tile de otra colección', 'facturada'],
        ]),
      );
      const nicho = c.ordenes.find((o) => o.estado === 'autorizada')!;
      expect(nicho).toMatchObject({
        costo: 650,
        precio: 1000,
        margen: 0.35,
        condicion: 'mitad_al_autorizar',
      });
      expect(nicho.respuesta).toMatchObject({
        decision: 'aprobada',
        nombre: 'Cliente de prueba',
        desdePortal: false,
      });
    }));

  it('la emite por aprobar; con margen bajo pide confirmar y sugiere el precio, como el legacy', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      expect(await crearOrdenCambio(tx, { ...nueva, precio: 350 }, LUNES)).toEqual({
        ok: false,
        confirmar: 'margen_bajo',
        margen: 1 - 260 / 350,
        minimo: 0.35,
        sugerido: 400,
      });
      const r = await crearOrdenCambio(tx, nueva, LUNES);
      expect(r).toMatchObject({ ok: true, folio: expect.stringMatching(/^OC-\d{4}$/), margen: 0.35 });
      const forzada = await crearOrdenCambio(tx, { ...nueva, precio: 350, forzar: true }, LUNES);
      expect(forzada.ok).toBe(true);
      const c = (await cambiosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!;
      expect(
        c.ordenes.filter((o) => o.descripcion === nueva.descripcion && o.estado === 'propuesta'),
      ).toHaveLength(2);
    }));

  it('pide lo de siempre; no en una obra entregada ni con el hallazgo en el futuro; el PM no las emite', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      expect(await codigo(tx, () => crearOrdenCambio(tx, { obraId: OBRAS.a1Carlos }, LUNES))).toBe('faltan');
      expect(await codigo(tx, () => crearOrdenCambio(tx, { ...nueva, precio: 0 }, LUNES))).toBe(
        'falta_precio',
      );
      expect(await codigo(tx, () => crearOrdenCambio(tx, { ...nueva, hallazgo: '2026-10-13' }, LUNES))).toBe(
        'hallazgo_futuro',
      );
      expect(
        await codigo(tx, () => crearOrdenCambio(tx, { ...nueva, obraId: OBRAS.a3Entregada }, LUNES)),
      ).toBe('obra_cerrada');
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => crearOrdenCambio(tx, nueva, LUNES))).toBe('solo_dueno');
      expect(await codigo(tx, () => cambiosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))).toBe('solo_dueno');
    }));

  it('el dueño registra la respuesta que le dieron en papel, una sola vez', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const id = await porAprobar(tx);
      expect(
        await codigo(tx, () =>
          responderCambioDueno(tx, { ordenId: id, decision: 'rechazada', nombre: ' ' }, LUNES),
        ),
      ).toBe('falta_nombre');
      await responderCambioDueno(
        tx,
        { ordenId: id, decision: 'rechazada', nombre: 'Ana García', comentario: 'Lo vemos después' },
        LUNES,
      );
      const o = (await cambiosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.ordenes.find(
        (x) => x.id === id,
      )!;
      expect(o.estado).toBe('rechazada');
      expect(o.respuesta).toMatchObject({ decision: 'rechazada', nombre: 'Ana García', desdePortal: false });
      expect(
        await codigo(tx, () =>
          responderCambioDueno(tx, { ordenId: id, decision: 'aprobada', nombre: 'Ana García' }, LUNES),
        ),
      ).toBe('orden_ya_respondida');
    }));
});

describe('el cliente aprueba en su portal', () => {
  it('con su nombre y su firma la autoriza: mueve la entrega comprometida y queda la evidencia', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const id = await porAprobar(tx);
      await sinIdentidad(tx);
      const antes = (await portalCliente(tx, { token: TOKEN }, LUNES))!;
      expect(antes.cambios.ordenes.find((o) => o.id === id)).toMatchObject({
        estado: 'propuesta',
        dias: 2,
        precio: 1000,
        condicion: 'al_autorizar',
        respuesta: null,
      });

      expect(
        await codigo(tx, () =>
          responderCambioCliente(tx, {
            token: TOKEN,
            ordenId: id,
            decision: 'aprobada',
            nombre: 'Ana García',
          }),
        ),
      ).toBe('falta_firma');
      await responderCambioCliente(tx, {
        token: TOKEN,
        ordenId: id,
        decision: 'aprobada',
        nombre: '  Ana García ',
        firma: FIRMA,
        ip: '203.0.113.7',
        navegador: 'Prueba',
      });
      const despues = (await portalCliente(tx, { token: TOKEN }, LUNES))!;
      expect(despues.cambios.ordenes.find((o) => o.id === id)).toMatchObject({
        estado: 'autorizada',
        respuesta: { decision: 'aprobada', nombre: 'Ana García' },
      });
      // los 2 días de la orden mueven la entrega: del 31 de octubre (sábado) al 3 de noviembre (martes)
      expect(despues.obra.entregaComprometida).toBe('2026-11-03');

      await como(tx, USUARIOS.duenoA);
      const o = (await cambiosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.ordenes.find(
        (x) => x.id === id,
      )!;
      expect(o.respuesta).toMatchObject({ desdePortal: true, firma: FIRMA, nombre: 'Ana García' });
      const [r] = await tx<{ ip: string; navegador: string }[]>`
        select ip, navegador from respuestas_cambio where orden_cambio_id = ${id}`;
      expect(r).toEqual({ ip: '203.0.113.7', navegador: 'Prueba' });
      expect((await seguimientoDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.obra.entregaComprometida).toBe(
        '2026-11-03',
      );

      // y ya no se responde otra vez
      await sinIdentidad(tx);
      expect(
        await codigo(tx, () =>
          responderCambioCliente(tx, {
            token: TOKEN,
            ordenId: id,
            decision: 'rechazada',
            nombre: 'Ana García',
          }),
        ),
      ).toBe('orden_ya_respondida');
    }));

  it('no aprobada queda rechazada, sin firma; con otro enlace o uno que no sirve, nada', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const id = await porAprobar(tx);
      await sinIdentidad(tx);
      expect(
        await codigo(tx, () =>
          responderCambioCliente(tx, {
            token: 'enlace-de-prueba-cliente-perez-2026',
            ordenId: id,
            decision: 'aprobada',
            nombre: 'Otro',
            firma: FIRMA,
          }),
        ),
      ).toBe('orden_no_encontrada');
      expect(
        await codigo(tx, () =>
          responderCambioCliente(tx, {
            token: 'un-enlace-que-no-existe-000000',
            ordenId: id,
            decision: 'aprobada',
            nombre: 'Otro',
            firma: FIRMA,
          }),
        ),
      ).toBe('enlace_invalido');
      await responderCambioCliente(tx, {
        token: TOKEN,
        ordenId: id,
        decision: 'rechazada',
        nombre: 'Ana García',
        comentario: 'Mejor no por ahora',
      });
      const p = (await portalCliente(tx, { token: TOKEN }, LUNES))!;
      expect(p.cambios.ordenes.find((o) => o.id === id)).toMatchObject({
        estado: 'rechazada',
        respuesta: { decision: 'rechazada', comentario: 'Mejor no por ahora' },
      });
      // la entrega no se mueve
      expect(p.obra.entregaComprometida).toBe('2026-10-31');
    }));
});
