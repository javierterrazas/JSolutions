// Corregir y anular con rastro (adaptadas de legacy/pruebas/prueba_escritura.js y prueba_pordia.js): el PM lo suyo
// en 48 h; el dueño sin límite salvo obras cerradas; siempre con motivo y con su renglón en correcciones.
import { afterAll, describe, expect, it } from 'vitest';
import { anular, anularCierre, cerrarDia, corregir, type Tx } from '../src/index';
import { codigo, como, enAustin, MIEMBROS, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 18);

/** Un cierre del día de hoy de Carlos, con 8 horas de Pedro. Devuelve sus registros. */
async function cierreDeCarlos(tx: Tx) {
  const rough = (
    await tx<{ id: string }[]>`select id from partidas_obra where obra_id = ${OBRAS.a1Carlos} and orden = 2`
  )[0]!.id;
  const pedro = (await tx<{ id: string }[]>`select id from trabajadores where nombre = 'Pedro'`)[0]!.id;
  const r = await cerrarDia(
    tx,
    {
      obraId: OBRAS.a1Carlos,
      partidas: [rough],
      fotosPorSubir: 1,
      cuadrilla: [{ trabajadorId: pedro, cantidad: 8 }],
    },
    LUNES,
  );
  const [mo] = await tx<{ id: string }[]>`select id from mano_obra where bitacora_id = ${r.bitacoraId}`;
  return { bitacoraId: r.bitacoraId, manoObraId: mo!.id };
}
const rastro = (tx: Tx, id: string) =>
  tx`select accion, campo, antes, despues, motivo, creado_por from correcciones where registro_id = ${id} order by campo`;

describe('correcciones del PM', () => {
  it('corrige sus horas con motivo, y queda el rastro', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const c = await cierreDeCarlos(tx);
      expect(
        await corregir(tx, {
          tabla: 'mano_obra',
          registroId: c.manoObraId,
          cambios: { cantidad: 6 },
          motivo: 'Se fue a mediodía',
        }),
      ).toEqual({ cambios: 1 });
      expect((await tx`select cantidad from mano_obra where id = ${c.manoObraId}`)[0]!.cantidad).toBe('6.00');
      // el PM no lee la auditoría; el dueño sí
      expect(await rastro(tx, c.manoObraId)).toEqual([]);
      await como(tx, USUARIOS.duenoA);
      expect(await rastro(tx, c.manoObraId)).toEqual([
        {
          accion: 'editar',
          campo: 'cantidad',
          antes: '8.00',
          despues: '6',
          motivo: 'Se fue a mediodía',
          creado_por: MIEMBROS.carlos,
        },
      ]);
    }));

  it('sin motivo, sin cambios, pasando de 16 horas o un campo que no se edita: rechazado', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const c = await cierreDeCarlos(tx);
      const corr = (cambios: Record<string, unknown>, motivo = 'Corrección de prueba') =>
        corregir(tx, { tabla: 'mano_obra', registroId: c.manoObraId, cambios, motivo });
      expect(await codigo(tx, () => corr({ cantidad: 6 }, 'no'))).toBe('falta_motivo');
      expect(await codigo(tx, () => corr({ cantidad: 8 }))).toBe('sin_cambios');
      expect(await codigo(tx, () => corr({ trabajador_id: MIEMBROS.luis }))).toBe('sin_cambios');
      expect(await codigo(tx, () => corr({ cantidad: 17 }))).toBe('cuadrilla_pasa_16_horas');
    }));

  it('después de 48 horas se lo pide al dueño; cobros y pagos no son del PM', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const c = await cierreDeCarlos(tx);
      const despues = new Date(Date.now() + 49 * 3_600_000);
      expect(
        await codigo(tx, () =>
          corregir(
            tx,
            { tabla: 'mano_obra', registroId: c.manoObraId, cambios: { cantidad: 6 }, motivo: 'Tarde' },
            despues,
          ),
        ),
      ).toBe('fuera_de_48_horas');
      expect(
        await codigo(tx, () =>
          anular(tx, { tabla: 'cobros', registroId: c.manoObraId, motivo: 'No me toca' }),
        ),
      ).toBe('tabla_no_corregible');
      // el dueño sí puede, sin límite de tiempo
      await como(tx, USUARIOS.duenoA);
      expect(
        await corregir(
          tx,
          {
            tabla: 'mano_obra',
            registroId: c.manoObraId,
            cambios: { cantidad: 6 },
            motivo: 'El PM me avisó',
          },
          despues,
        ),
      ).toEqual({ cambios: 1 });
    }));

  it('anular deja el registro (fuera de los cálculos) con su rastro; anular otra vez no hace nada', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const c = await cierreDeCarlos(tx);
      expect(
        await anular(tx, { tabla: 'mano_obra', registroId: c.manoObraId, motivo: 'Se capturó dos veces' }),
      ).toEqual({ yaEstaba: false });
      expect((await tx`select estado from mano_obra where id = ${c.manoObraId}`)[0]!.estado).toBe('anulado');
      expect(await anular(tx, { tabla: 'mano_obra', registroId: c.manoObraId, motivo: 'Otra vez' })).toEqual({
        yaEstaba: true,
      });
      expect(
        await codigo(tx, () =>
          corregir(tx, {
            tabla: 'mano_obra',
            registroId: c.manoObraId,
            cambios: { cantidad: 4 },
            motivo: 'Ya anulado',
          }),
        ),
      ).toBe('ya_anulado');
    }));

  it('anular un cierre anula su bitácora, su avance y su cuadrilla', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const c = await cierreDeCarlos(tx);
      expect(
        await anularCierre(tx, { bitacoraId: c.bitacoraId, motivo: 'Cerré la obra equivocada' }),
      ).toEqual({ registros: 3 });
      const vigentes = await tx`
        select (select count(*)::int from bitacora where id = ${c.bitacoraId} and estado = 'vigente') +
               (select count(*)::int from mano_obra where bitacora_id = ${c.bitacoraId} and estado = 'vigente') +
               (select count(*)::int from avance where bitacora_id = ${c.bitacoraId} and estado_registro = 'vigente') as n`;
      expect(vigentes[0]!.n).toBe(0);
    }));
});

describe('correcciones del dueño', () => {
  it('corrige un cobro con rastro; anular un pago regresa la orden de "pagada" a "aprobada"', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const [cobro] = await tx<{ id: string }[]>`select id from cobros where obra_id = ${OBRAS.a1Carlos}`;
      await corregir(tx, {
        tabla: 'cobros',
        registroId: cobro!.id,
        cambios: { monto: 7000, referencia: 'ZELLE-1' },
        motivo: 'Monto real del depósito',
      });
      expect((await rastro(tx, cobro!.id)).map((r) => r.campo)).toEqual(['monto', 'referencia']);
      const [pago] = await tx<{ id: string; ot: string }[]>`
        select p.id, p.orden_trabajo_id as ot from pagos_sub p join ordenes_trabajo o on o.id = p.orden_trabajo_id
        where p.obra_id = ${OBRAS.a1Carlos} and o.estado = 'pagada'`;
      await anular(tx, { tabla: 'pagos_sub', registroId: pago!.id, motivo: 'El cheque rebotó' });
      expect((await tx`select estado from ordenes_trabajo where id = ${pago!.ot}`)[0]!.estado).toBe(
        'aprobada',
      );
    }));

  it('en una obra cerrada no se corrige nada', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const [cobro] = await tx<{ id: string }[]>`select id from cobros where obra_id = ${OBRAS.a3Entregada}`;
      expect(
        await codigo(tx, () =>
          corregir(tx, {
            tabla: 'cobros',
            registroId: cobro!.id,
            cambios: { monto: 1 },
            motivo: 'Histórico',
          }),
        ),
      ).toBe('obra_cerrada');
    }));
});
