// Los gastos del PM y la revisión del dueño (fase 2, paso 6b; legacy: pmGasto, duRevisarGasto), con los datos de
// supabase/seed.sql: el límite de compra del PM es de $300; en OB-001 Carlos registró una compra de $120 en Home
// Depot, con su recibo, y la oficina una de $2,500 en Ferguson.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import {
  anular,
  corregir,
  datosParaCompra,
  datosParaGasto,
  gastoDeClave,
  gastosEnRevision,
  marcarGastoRevisado,
  registrarCompraOficina,
  registrarGasto,
  seguimientoDeObra,
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
      // los textos tienen tope (D-055)
      expect(await codigo(tx, () => registrarGasto(tx, gasto({ proveedor: 'x'.repeat(201) })))).toBe(
        'datos_invalidos',
      );
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

  it('con la hora del teléfono atrasada, no más atrás que un cierre tardío (D-054)', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const lunes = enAustin('2026-10-12', 9);
      expect(
        await codigo(tx, () => registrarGasto(tx, gasto({ capturado: '2026-10-08T12:00:00-05:00' }), lunes)),
      ).toBe('fuera_de_ventana');
      const r = await registrarGasto(tx, gasto({ capturado: '2026-10-09T12:00:00-05:00' }), lunes);
      const [g] = await tx`select to_char(dia, 'YYYY-MM-DD') as dia from gastos where id = ${r.gastoId}`;
      expect(g).toEqual({ dia: '2026-10-09' });
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

  it('uno que el PM corrige arriba del límite le vuelve a aparecer al dueño (D-054)', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const r = await registrarGasto(tx, gasto({ monto: 10, proveedor: 'Lowes' }));
      expect(r.enRevision).toBe(false);
      const subir = (monto: number) =>
        corregir(tx, {
          tabla: 'gastos',
          registroId: r.gastoId,
          cambios: { monto },
          motivo: 'Era otro ticket',
        });
      // abajo del límite sigue sin revisión
      await subir(250);
      expect((await tx`select revision from gastos where id = ${r.gastoId}`)[0]!.revision).toBeNull();
      await subir(5000);
      expect((await tx`select revision from gastos where id = ${r.gastoId}`)[0]!.revision).toBe('pendiente');

      await como(tx, USUARIOS.duenoA);
      expect(await gastosEnRevision(tx)).toEqual([
        expect.objectContaining({ id: r.gastoId, monto: 5000, proveedor: 'Lowes' }),
      ]);
      // y queda en el rastro de la corrección
      const rastro = await tx`
        select campo, despues from correcciones where registro_id = ${r.gastoId} and campo = 'revision'`;
      expect(rastro).toEqual([{ campo: 'revision', despues: 'pendiente' }]);
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

// D-063: el dueño registra en una obra lo que compró la oficina.
describe('las compras de la oficina', () => {
  const LUNES = enAustin('2026-10-12', 9);
  const compra = (extra: Record<string, unknown> = {}) => ({
    obraId: OBRAS.a1Carlos,
    monto: 340.25,
    proveedor: ' Floor & Decor ',
    descripcion: 'Tile 12x24',
    ...extra,
  });

  it('el dueño la registra en la obra, con su día, cómo se pagó y su partida; cuenta en el seguimiento', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const d = (await datosParaCompra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!;
      expect(d).toMatchObject({ obra: { folio: 'OB-001' }, hoy: '2026-10-12' });
      const rough = d.espacios.flatMap((e) => e.partidas).find((p) => p.nombre.es === 'Rough de plomería')!;
      const antes = (await seguimientoDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.presupuesto.gastado;

      const r = await registrarCompraOficina(
        tx,
        compra({ partidaId: rough.id, dia: '2026-10-09', metodoPago: 'zelle', categoria: 'material' }),
        LUNES,
      );
      expect(r.folio).toMatch(/^GTO-/);
      const [g] = await tx`
        select to_char(dia, 'YYYY-MM-DD') as dia, proveedor, monto, metodo_pago, origen, revision, partida_obra_id,
               creado_por
        from gastos where id = ${r.gastoId}`;
      expect(g).toEqual({
        dia: '2026-10-09',
        proveedor: 'Floor & Decor',
        monto: '340.25',
        metodo_pago: 'zelle',
        origen: 'oficina',
        revision: null,
        partida_obra_id: rough.id,
        creado_por: MIEMBROS.duenoA,
      });
      expect(
        (await seguimientoDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.presupuesto.gastado,
      ).toBeCloseTo(antes + 340.25, 2);

      // sin partida va a Generales de obra; sin día, es de hoy
      const sin = await registrarCompraOficina(tx, compra(), LUNES);
      const [h] = await tx`
        select to_char(g.dia, 'YYYY-MM-DD') as dia, t.es_generales as generales
        from gastos g join espacios e on e.id = g.espacio_id join tipos_espacio t on t.id = e.tipo_espacio_id
        where g.id = ${sin.gastoId}`;
      expect(h).toEqual({ dia: '2026-10-12', generales: true });

      // en una obra que todavía no arranca, la compra aparece en su día a día
      await registrarCompraOficina(tx, compra({ obraId: OBRAS.a2Luis, dia: '2026-10-10' }), LUNES);
      const luis = (await seguimientoDeObra(tx, { obraId: OBRAS.a2Luis }, LUNES))!;
      expect(luis.dias.find((x) => x.dia === '2026-10-10')?.gastos).toContainEqual({
        proveedor: 'Floor & Decor',
        monto: 340.25,
        origen: 'oficina',
      });

      // el PM no la ve
      await como(tx, USUARIOS.carlos);
      expect(await tx`select id from gastos where id = ${r.gastoId}`).toEqual([]);
    }));

  it('la pantalla trae las compras de la obra, de la oficina y del PM; el dueño las corrige y anula (D-068)', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const d = (await datosParaCompra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!;
      expect(d.cerrada).toBe(false);
      const ferguson = d.compras.find((g) => g.proveedor === 'Ferguson')!;
      const depot = d.compras.find((g) => g.proveedor === 'Home Depot')!;
      expect(ferguson).toMatchObject({ origen: 'oficina', monto: 2500, corregible: true });
      expect(depot).toMatchObject({ origen: 'pm', monto: 120, corregible: true });

      // el dueño, sin el límite de 48 horas del PM, y con su motivo en el rastro
      await corregir(
        tx,
        {
          tabla: 'gastos',
          registroId: ferguson.id,
          cambios: { monto: 2400 },
          motivo: 'Descuento de la factura',
        },
        LUNES,
      );
      await anular(tx, { tabla: 'gastos', registroId: depot.id, motivo: 'Se capturó dos veces' }, LUNES);
      const despues = (await datosParaCompra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.compras;
      expect(despues.find((g) => g.id === ferguson.id)?.monto).toBe(2400);
      expect(despues.find((g) => g.id === depot.id)).toBeUndefined();
      const rastro = await tx<{ accion: string; motivo: string }[]>`
        select accion, motivo from correcciones where registro_id in ${tx([ferguson.id, depot.id])}`;
      expect(rastro).toHaveLength(2);
      expect(rastro).toEqual(
        expect.arrayContaining([
          { accion: 'anular', motivo: 'Se capturó dos veces' },
          { accion: 'editar', motivo: 'Descuento de la factura' },
        ]),
      );

      // una obra entregada ya no se corrige
      const entregada = (await datosParaCompra(tx, { obraId: OBRAS.a3Entregada }, LUNES))!;
      expect(entregada.cerrada).toBe(true);
      expect(entregada.compras.every((g) => !g.corregible)).toBe(true);
    }));

  it('rechaza lo que no cuadra; el PM no registra compras de la oficina', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      expect(
        await codigo(tx, () =>
          registrarCompraOficina(tx, compra({ proveedor: ' ', descripcion: '' }), LUNES),
        ),
      ).toBe('faltan');
      expect(await codigo(tx, () => registrarCompraOficina(tx, compra({ monto: 0 }), LUNES))).toBe(
        'monto_invalido',
      );
      expect(await codigo(tx, () => registrarCompraOficina(tx, compra({ dia: '2026-10-13' }), LUNES))).toBe(
        'dia_futuro',
      );
      const [ajena] = await tx<
        { id: string }[]
      >`select id from partidas_obra where obra_id = ${OBRAS.a2Luis} limit 1`;
      expect(
        await codigo(tx, () => registrarCompraOficina(tx, compra({ partidaId: ajena!.id }), LUNES)),
      ).toBe('partida_de_otra_obra');
      await como(tx, USUARIOS.duenoB);
      expect(await codigo(tx, () => registrarCompraOficina(tx, compra(), LUNES))).toBe('obra_no_encontrada');
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => registrarCompraOficina(tx, compra(), LUNES))).toBe('solo_dueno');
      expect(await codigo(tx, () => datosParaCompra(tx, { obraId: OBRAS.a1Carlos }, LUNES))).toBe(
        'solo_dueno',
      );
    }));
});
