// Los subcontratos de una obra (D-074), con los datos de supabase/seed.sql: en OB-001, Plomería Rápida (en regla) tiene
// una orden emitida de $2,000 ("Rough de plomería del baño") con un anticipo de $500, y otra de $300 ya pagada.
import { afterAll, describe, expect, it } from 'vitest';
import {
  anular,
  cancelarOrdenTrabajo,
  emitirOrdenTrabajo,
  registrarPagoSub,
  reprogramarOrdenTrabajo,
  subcontratosDeObra,
  type Tx,
} from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);

async function datos(tx: Tx) {
  const d = (await subcontratosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!;
  const rough = d.ordenes.find((o) => o.alcance === 'Rough de plomería del baño')!;
  const partida = d.espacios.flatMap((e) => e.partidas).find((p) => p.nombre.es === 'Rough de plomería')!;
  const sub = d.subs.find((x) => x.nombre === 'Plomería Rápida')!;
  return { d, rough, partida, sub };
}

const orden = (subId: string, partidaId: string, extra: Record<string, unknown> = {}) => ({
  obraId: OBRAS.a1Carlos,
  subId,
  partidaId,
  alcance: 'Instalar el WC y el lavabo',
  inicio: '2026-10-20',
  fin: '2026-10-21',
  precio: 450,
  ...extra,
});

describe('los subcontratos de una obra', () => {
  it('cada orden con su sub, su partida, su precio, lo pagado y su saldo; los totales de la obra', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { d, rough } = await datos(tx);
      expect(d).toMatchObject({ comprometido: 2300, pagado: 800, saldo: 1500, cerrada: false });
      expect(rough).toMatchObject({
        estado: 'emitida',
        confirmada: false,
        aprobada: false,
        precio: 2000,
        pagado: 500,
        saldo: 1500,
        sub: { nombre: 'Plomería Rápida' },
        espacio: 'Baño principal',
      });
      expect(rough.pagos).toEqual([expect.objectContaining({ concepto: 'anticipo', monto: 500 })]);
    }));

  it('emite una orden con precio cerrado; si al sub le faltan papeles, pide confirmar', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { sub, partida } = await datos(tx);
      const r = await emitirOrdenTrabajo(tx, orden(sub.id, partida.id), LUNES);
      expect(r).toMatchObject({ ok: true, folio: expect.stringMatching(/^OT-\d{4}$/) });
      expect((await datos(tx)).d.comprometido).toBe(2750);

      await tx`update subcontratistas set seguro_vence = '2026-09-30' where id = ${sub.id}`;
      expect(await emitirOrdenTrabajo(tx, orden(sub.id, partida.id), LUNES)).toEqual({
        ok: false,
        confirmar: 'papeles',
        avisos: [{ codigo: 'seguro_vencido', dia: '2026-09-30' }],
      });
      expect(
        (await emitirOrdenTrabajo(tx, orden(sub.id, partida.id, { confirmado: ['papeles'] }), LUNES)).ok,
      ).toBe(true);
    }));

  it('rechaza lo que no cuadra; no a un sub de baja ni en una obra entregada; el PM no emite', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { sub, partida } = await datos(tx);
      expect(await codigo(tx, () => emitirOrdenTrabajo(tx, { obraId: OBRAS.a1Carlos }, LUNES))).toBe(
        'faltan',
      );
      expect(
        await codigo(tx, () => emitirOrdenTrabajo(tx, orden(sub.id, partida.id, { precio: 0 }), LUNES)),
      ).toBe('precio_cerrado');
      expect(
        await codigo(tx, () =>
          emitirOrdenTrabajo(tx, orden(sub.id, partida.id, { fin: '2026-10-19' }), LUNES),
        ),
      ).toBe('fin_antes_del_inicio');
      const [ajena] = await tx<
        { id: string }[]
      >`select id from partidas_obra where obra_id = ${OBRAS.a2Luis} limit 1`;
      expect(await codigo(tx, () => emitirOrdenTrabajo(tx, orden(sub.id, ajena!.id), LUNES))).toBe(
        'partida_de_otra_obra',
      );
      expect(
        await codigo(tx, () =>
          emitirOrdenTrabajo(tx, { ...orden(sub.id, partida.id), obraId: OBRAS.a3Entregada }, LUNES),
        ),
      ).toBe('obra_cerrada');
      await tx`update subcontratistas set activo = false where id = ${sub.id}`;
      expect(await codigo(tx, () => emitirOrdenTrabajo(tx, orden(sub.id, partida.id), LUNES))).toBe(
        'sub_no_activo',
      );
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => emitirOrdenTrabajo(tx, orden(sub.id, partida.id), LUNES))).toBe(
        'solo_dueno',
      );
      expect(await codigo(tx, () => subcontratosDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))).toBe(
        'solo_dueno',
      );
    }));

  it('el pago, contra su orden, con los avisos del legacy; liquidada, la orden queda pagada', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { rough } = await datos(tx);
      const pago = (extra: Record<string, unknown>) => ({
        ordenId: rough.id,
        metodo: 'cheque' as const,
        ...extra,
      });
      // la liquidación sin que el PM haya aprobado el trabajo: confirmar
      expect(await registrarPagoSub(tx, pago({ concepto: 'liquidacion', monto: 1500 }), LUNES)).toEqual({
        ok: false,
        confirmar: 'sin_aprobar',
      });
      // pagar de más: confirmar, con el total
      expect(await registrarPagoSub(tx, pago({ concepto: 'parcial', monto: 1600 }), LUNES)).toEqual({
        ok: false,
        confirmar: 'sobrepago',
        total: 2100,
      });
      const parcial = await registrarPagoSub(tx, pago({ concepto: 'parcial', monto: 700 }), LUNES);
      expect(parcial).toMatchObject({ ok: true, saldo: 800, folio: expect.stringMatching(/^PAG-/) });
      const fin = await registrarPagoSub(
        tx,
        pago({ concepto: 'liquidacion', monto: 800, confirmado: ['sin_aprobar'] }),
        LUNES,
      );
      expect(fin).toMatchObject({ ok: true, saldo: 0 });
      let r = (await datos(tx)).rough;
      expect(r).toMatchObject({ estado: 'pagada', pagado: 2000, saldo: 0 });

      // anulado el último pago, la orden regresa de pagada
      await anular(
        tx,
        { tabla: 'pagos_sub', registroId: fin.ok ? fin.pagoId : '', motivo: 'Cheque cancelado' },
        LUNES,
      );
      r = (await datos(tx)).rough;
      // a donde estaba: el PM no la había confirmado ni aprobado
      expect(r.estado).toBe('emitida');
      expect(r.saldo).toBe(800);
    }));

  it('cancela una orden sin pagos; no una con pagos', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { rough, sub, partida } = await datos(tx);
      expect(await codigo(tx, () => cancelarOrdenTrabajo(tx, { ordenId: rough.id }, LUNES))).toBe(
        'orden_con_pagos',
      );
      const r = await emitirOrdenTrabajo(tx, orden(sub.id, partida.id), LUNES);
      if (!r.ok) throw new Error('no se emitió');
      await cancelarOrdenTrabajo(tx, { ordenId: r.ordenId }, LUNES);
      const d = (await datos(tx)).d;
      expect(d.ordenes.find((o) => o.id === r.ordenId)?.estado).toBe('cancelada');
      expect(d.comprometido).toBe(2300);
      expect(
        await codigo(tx, () =>
          registrarPagoSub(tx, { ordenId: r.ordenId, concepto: 'parcial', monto: 10 }, LUNES),
        ),
      ).toBe('orden_cancelada');
    }));

  it('reprograma una orden cuando el sub no llegó: cuenta la falta y la regresa a emitida, con rastro', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { rough } = await datos(tx);
      // confirmada por el sub, y el cierre del PM marcó que no llegó
      await tx`update ordenes_trabajo set estado = 'confirmada', confirmada_en = now(), se_presento = false
               where id = ${rough.id}`;
      const r = await reprogramarOrdenTrabajo(
        tx,
        { ordenId: rough.id, inicio: '2026-10-15', motivo: 'Se le cruzó otra obra' },
        LUNES,
      );
      expect(r).toEqual({ faltas: 1, falto: true });
      const o = (await datos(tx)).rough;
      expect(o).toMatchObject({
        inicio: '2026-10-15',
        fin: '2026-10-15',
        estado: 'emitida',
        confirmada: false,
        sePresento: null,
        faltas: 1,
      });
      const rastro = await tx<{ campo: string; antes: string; despues: string; motivo: string }[]>`
        select campo, antes, despues, motivo from correcciones where registro_id = ${rough.id} order by campo desc`;
      expect(rastro).toEqual([
        {
          campo: 'inicio_programado',
          antes: '2026-10-07',
          despues: '2026-10-15',
          motivo: 'Se le cruzó otra obra (el sub no llegó)',
        },
        {
          campo: 'fin_programado',
          antes: '2026-10-08',
          despues: '2026-10-15',
          motivo: 'Se le cruzó otra obra (el sub no llegó)',
        },
      ]);

      // sin falta: solo mueve las fechas
      expect(
        await reprogramarOrdenTrabajo(
          tx,
          { ordenId: rough.id, inicio: '2026-10-19', fin: '2026-10-20', motivo: 'El cliente pidió otro día' },
          LUNES,
        ),
      ).toEqual({ faltas: 1, falto: false });
    }));

  it('pide fecha y motivo; no una orden aprobada, pagada o cancelada; el PM no reprograma', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { d, rough } = await datos(tx);
      const pagada = d.ordenes.find((o) => o.estado === 'pagada')!;
      const r = (extra: Record<string, unknown>) =>
        codigo(tx, () =>
          reprogramarOrdenTrabajo(
            tx,
            { ordenId: rough.id, inicio: '2026-10-15', motivo: 'Lluvia fuerte', ...extra },
            LUNES,
          ),
        );
      expect(await r({ inicio: null })).toBe('faltan');
      expect(await r({ motivo: 'no' })).toBe('falta_motivo');
      expect(await r({ fin: '2026-10-14' })).toBe('fin_antes_del_inicio');
      expect(await r({ inicio: '2026-10-07', fin: '2026-10-08' })).toBe('sin_cambios');
      expect(await r({ ordenId: pagada.id })).toBe('orden_no_reprogramable');
      await como(tx, USUARIOS.carlos);
      expect(await r({})).toBe('solo_dueno');
    }));
});
