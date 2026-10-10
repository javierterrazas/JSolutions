// Los avisos del PM y la respuesta del dueño (fase 2, paso 6c; legacy: pmBloqueo, duResponderBloqueo), con los datos
// de supabase/seed.sql: en OB-001 Carlos tiene abierto un aviso por humedad detrás del muro de la regadera.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { avisoDeClave, avisosAbiertos, datosParaAviso, levantarAviso, responderAviso } from '../src/index';
import { codigo, como, MIEMBROS, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const aviso = (extra: Record<string, unknown> = {}) => ({
  obraId: OBRAS.a1Carlos,
  claveEnvio: randomUUID(),
  tipo: 'material' as const,
  descripcion: '  No llegó el tile del piso; la cuadrilla está parada  ',
  detiene: true,
  fotos: 2,
  ...extra,
});

describe('levantar un aviso', () => {
  it('queda abierto, a su nombre, con su folio, y el PM lo ve en su obra', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const r = await levantarAviso(tx, aviso());
      expect(r).toMatchObject({ folio: expect.stringMatching(/^BLQ-/), slaHoras: 24 });
      const [a] = await tx`
        select tipo, descripcion, detiene_avance, estado, creado_por from avisos where id = ${r.avisoId}`;
      expect(a).toEqual({
        tipo: 'material',
        descripcion: 'No llegó el tile del piso; la cuadrilla está parada',
        detiene_avance: true,
        estado: 'abierto',
        creado_por: MIEMBROS.carlos,
      });
      const d = (await datosParaAviso(tx, { obraId: OBRAS.a1Carlos }))!;
      expect(d.avisos[0]).toMatchObject({ id: r.avisoId, respuesta: null });
      expect(d.avisos.length).toBe(2);
    }));

  it('sin decir si detiene, se da por hecho que sí, como el legacy', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const { detiene: _, ...sinDetiene } = aviso();
      const r = await levantarAviso(tx, sinDetiene);
      const [a] = await tx`select detiene_avance from avisos where id = ${r.avisoId}`;
      expect(a!.detiene_avance).toBe(true);
    }));

  it('el reintento con la misma clave recibe el mismo aviso', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const datos = aviso();
      const a = await levantarAviso(tx, datos);
      expect((await levantarAviso(tx, datos)).avisoId).toBe(a.avisoId);
      expect(await avisoDeClave(tx, datos.claveEnvio)).toBe(a.avisoId);
    }));

  it('sin detalle, o en la obra de otro, no', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      expect(await codigo(tx, () => levantarAviso(tx, aviso({ descripcion: 'Falta' })))).toBe(
        'aviso_sin_detalle',
      );
      expect(await codigo(tx, () => levantarAviso(tx, aviso({ obraId: OBRAS.a2Luis })))).toBe(
        'obra_no_encontrada',
      );
    }));
});

describe('la respuesta del dueño', () => {
  it('el dueño ve los abiertos con su obra, su PM y sus horas; contesta y el PM ve la respuesta', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const r = await levantarAviso(tx, aviso());
      expect(await codigo(tx, () => avisosAbiertos(tx))).toBe('solo_dueno');
      expect(
        await codigo(tx, () => responderAviso(tx, { avisoId: r.avisoId, respuesta: 'Ya lo pedí' })),
      ).toBe('solo_dueno');

      await como(tx, USUARIOS.duenoA);
      const abiertos = await avisosAbiertos(tx, new Date(Date.now() + 30 * 3_600_000));
      const suyo = abiertos.find((a) => a.id === r.avisoId)!;
      expect(suyo).toMatchObject({
        pm: 'Carlos Méndez',
        obra: expect.objectContaining({ folio: 'OB-001' }),
        detiene: true,
        fueraDeSla: true,
        fotos: [],
      });
      expect(suyo.horas).toBeGreaterThanOrEqual(29);
      expect(await codigo(tx, () => responderAviso(tx, { avisoId: r.avisoId, respuesta: ' ok ' }))).toBe(
        'respuesta_corta',
      );
      await responderAviso(tx, {
        avisoId: r.avisoId,
        respuesta: 'Llega mañana a las 8; mientras, adelanten el nicho.',
      });
      expect((await avisosAbiertos(tx)).some((a) => a.id === r.avisoId)).toBe(false);
      expect(
        await codigo(tx, () => responderAviso(tx, { avisoId: r.avisoId, respuesta: 'Otra respuesta' })),
      ).toBe('registro_no_encontrado');

      await como(tx, USUARIOS.carlos);
      const d = (await datosParaAviso(tx, { obraId: OBRAS.a1Carlos }))!;
      expect(d.avisos.find((a) => a.id === r.avisoId)).toMatchObject({
        respuesta: 'Llega mañana a las 8; mientras, adelanten el nicho.',
        respondidoEn: expect.any(String),
      });
    }));
});
