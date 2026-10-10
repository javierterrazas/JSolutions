// Los gastos del PM y la revisión del dueño (fase 2, paso 6b; legacy: pmGasto, duRevisarGasto), con los datos de
// supabase/seed.sql: el límite de compra del PM es de $300; en OB-001 Carlos registró una compra de $120 en Home
// Depot, con su recibo, y la oficina una de $2,500 en Ferguson.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import {
  datosParaGasto,
  gastoDeClave,
  gastosEnRevision,
  marcarGastoRevisado,
  registrarGasto,
  type Tx,
} from '../src/index';
import { codigo, como, enAustin, MIEMBROS, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const gasto = (extra: Record<string, unknown> = {}) => ({
  obraId: OBRAS.a1Carlos,
  claveEnvio: randomUUID(),
  monto: 85.5,
  proveedor: ' Home Depot ',
  descripcion: 'Thinset y espaciadores',
  ...extra,
});

async function partidaDelBano(tx: Tx) {
  return (
    await tx<{ id: string; espacio_id: string }[]>`
      select p.id, p.espacio_id from partidas_obra p where p.obra_id = ${OBRAS.a1Carlos} and p.nombre_es = 'Rough de plomería'`
  )[0]!;
}

describe('registrar un gasto', () => {
  it('con la tarjeta de la empresa, a la partida elegida, y el día de la captura', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const p = await partidaDelBano(tx);
      const r = await registrarGasto(
        tx,
        gasto({ partidaId: p.id, categoria: 'herramienta', capturado: '2026-10-08T22:30:00-05:00' }),
        enAustin('2026-10-09', 7),
      );
      expect(r).toMatchObject({ folio: expect.stringMatching(/^GTO-/), enRevision: false, limite: 300 });
      const [g] = await tx`
        select to_char(dia, 'YYYY-MM-DD') as dia, espacio_id, partida_obra_id, categoria, proveedor, monto, metodo_pago,
               origen, revision, creado_por
        from gastos where id = ${r.gastoId}`;
      expect(g).toEqual({
        dia: '2026-10-08',
        espacio_id: p.espacio_id,
        partida_obra_id: p.id,
        categoria: 'herramienta',
        proveedor: 'Home Depot',
        monto: '85.50',
        metodo_pago: 'tarjeta_empresa',
        origen: 'pm',
        revision: null,
        creado_por: MIEMBROS.carlos,
      });
    }));

  it('sin partida va a Generales de obra', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const r = await registrarGasto(tx, gasto());
      const [g] = await tx`
        select e.nombre from gastos g join espacios e on e.id = g.espacio_id where g.id = ${r.gastoId}`;
      expect(g!.nombre).toBe('Generales de obra');
    }));

  it('el reintento con la misma clave recibe el mismo gasto: no se duplica', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const datos = gasto();
      const a = await registrarGasto(tx, datos);
      const b = await registrarGasto(tx, datos);
      expect(b.gastoId).toBe(a.gastoId);
      expect(await gastoDeClave(tx, datos.claveEnvio)).toBe(a.gastoId);
      expect(await gastoDeClave(tx, randomUUID())).toBeNull();
    }));

  it('rechaza lo que no cuadra', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      expect(await codigo(tx, () => registrarGasto(tx, gasto({ proveedor: ' ' })))).toBe('faltan');
      expect(await codigo(tx, () => registrarGasto(tx, gasto({ monto: 0 })))).toBe('monto_invalido');
      expect(await codigo(tx, () => registrarGasto(tx, gasto({ obraId: OBRAS.a2Luis })))).toBe(
        'obra_no_encontrada',
      );
      const [ajena] = await tx<{ id: string }[]>`
        select id from partidas_obra where obra_id <> ${OBRAS.a1Carlos} limit 1`;
      if (ajena)
        expect(await codigo(tx, () => registrarGasto(tx, gasto({ partidaId: ajena.id })))).toBe(
          'partida_de_otra_obra',
        );
    }));
});

describe('arriba del límite: la revisión del dueño', () => {
  it('queda pendiente, el dueño la ve con su obra y su PM, y la marca revisada', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const r = await registrarGasto(tx, gasto({ monto: 450, proveedor: 'Floor & Decor' }));
      expect(r.enRevision).toBe(true);
      expect(await codigo(tx, () => gastosEnRevision(tx))).toBe('solo_dueno');
      expect(await codigo(tx, () => marcarGastoRevisado(tx, { gastoId: r.gastoId }))).toBe('solo_dueno');

      await como(tx, USUARIOS.duenoA);
      const lista = await gastosEnRevision(tx);
      expect(lista).toEqual([
        expect.objectContaining({
          id: r.gastoId,
          monto: 450,
          proveedor: 'Floor & Decor',
          pm: 'Carlos Méndez',
          obra: expect.objectContaining({ folio: 'OB-001' }),
          reciboId: null,
        }),
      ]);
      await marcarGastoRevisado(tx, { gastoId: r.gastoId });
      expect(await gastosEnRevision(tx)).toEqual([]);
      expect(await codigo(tx, () => marcarGastoRevisado(tx, { gastoId: r.gastoId }))).toBe(
        'registro_no_encontrado',
      );
    }));
});

describe('la pantalla de gastos del PM', () => {
  it('trae las partidas sin terminar, el límite, y sus gastos sin recibo; nunca las compras de la oficina', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const r = await registrarGasto(tx, gasto());
      const d = (await datosParaGasto(tx, { obraId: OBRAS.a1Carlos }))!;
      expect(d.limite).toBe(300);
      const partidas = d.espacios.flatMap((e) => e.partidas.map((p) => p.nombre.es));
      expect(partidas).toContain('Rough de plomería');
      expect(partidas).not.toContain('Demolición y retiro de escombro');
      // el del seed ya tiene su recibo; el de la oficina (Ferguson) no lo ve
      expect(d.sinRecibo.map((g) => g.id)).toEqual([r.gastoId]);
      expect([...d.sinRecibo, ...d.recientes].some((g) => g.proveedor === 'Ferguson')).toBe(false);
      // el recién registrado se puede corregir (48 h, con el reloj de la base)
      expect(d.recientes.map((g) => g.id)).toContain(r.gastoId);
      await como(tx, USUARIOS.luis);
      expect(await datosParaGasto(tx, { obraId: OBRAS.a1Carlos })).toBeNull();
    }));
});
