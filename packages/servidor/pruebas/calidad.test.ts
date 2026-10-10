// La inspección y la prueba de inundación (fase 2, paso 6a; adaptadas de legacy/pruebas/prueba_calidad.js), con
// los datos de supabase/seed.sql: en OB-001 de Carlos, el baño tiene la demolición (PC1) terminada e inspeccionada,
// y una prueba de agua sin fugas.
import { afterAll, describe, expect, it } from 'vitest';
import {
  cerrarDia,
  datosParaCalidad,
  datosParaInspeccion,
  iniciarPruebaAgua,
  registrarInspeccion,
  terminarPruebaAgua,
  type Tx,
} from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

async function ids(tx: Tx) {
  const espacio = async (nombre: string) =>
    (
      await tx<
        { id: string }[]
      >`select id from espacios where obra_id = ${OBRAS.a1Carlos} and nombre = ${nombre}`
    )[0]!.id;
  const hito = async (clave: string) =>
    (await tx<{ id: string }[]>`select id from hitos_calidad where clave = ${clave}`)[0]!.id;
  const puntos = async (hitoId: string) =>
    (await tx<{ id: string }[]>`select id from puntos_control where hito_id = ${hitoId} order by orden`).map(
      (p) => p.id,
    );
  const pc1 = await hito('PC1');
  const pc3 = await hito('PC3');
  return {
    bano: await espacio('Baño principal'),
    generales: await espacio('Generales de obra'),
    pc1,
    pc3,
    puntosPc1: await puntos(pc1),
    puntosPc3: await puntos(pc3),
  };
}

describe('la pantalla de calidad', () => {
  it('trae cada espacio con los puntos de control de sus partidas, su última inspección y su prueba de agua', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const d = (await datosParaCalidad(tx, { obraId: OBRAS.a1Carlos }))!;
      expect(d.espacios.map((e) => e.nombre)).toEqual(['Baño principal']);
      const [bano] = d.espacios;
      expect(bano!.hitos).toEqual([
        expect.objectContaining({
          clave: 'PC1',
          enCurso: true,
          ultima: expect.objectContaining({ resultado: 'aprobado' }),
        }),
      ]);
      expect(bano!.prueba).toMatchObject({ resultado: 'sin_fugas' });
    }));

  it('la inspección trae las preguntas del punto de control; otro PM no ve la obra', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const i = await ids(tx);
      const d = (await datosParaInspeccion(tx, {
        obraId: OBRAS.a1Carlos,
        espacioId: i.bano,
        hitoId: i.pc1,
      }))!;
      expect(d.puntos).toEqual([expect.objectContaining({ requiereFoto: true })]);
      expect(d.prueba).toBeNull();
      await como(tx, USUARIOS.luis);
      expect(
        await datosParaInspeccion(tx, { obraId: OBRAS.a1Carlos, espacioId: i.bano, hitoId: i.pc1 }),
      ).toBeNull();
    }));
});

describe('la inspección', () => {
  it('todo lo que aplica cumple: aprobada, con cada respuesta y su texto', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const i = await ids(tx);
      const r = await registrarInspeccion(tx, {
        obraId: OBRAS.a1Carlos,
        espacioId: i.bano,
        hitoId: i.pc1,
        cumple: i.puntosPc1,
        fotos: 2,
      });
      expect(r).toMatchObject({ resultado: 'aprobado', defectos: 0 });
      const resp =
        await tx`select respuesta, texto_es from inspeccion_respuestas where inspeccion_id = ${r.inspeccionId}`;
      expect(resp).toEqual([
        { respuesta: 'cumple', texto_es: 'Estructura visible sin daño por agua ni termita' },
      ]);
    }));

  it('lo que no se marca es defecto; "No aplica" sale del total; sin ninguna que aplique o sin fotos, nada', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const i = await ids(tx);
      const base = { obraId: OBRAS.a1Carlos, espacioId: i.bano, hitoId: i.pc1, fotos: 1 };
      const r = await registrarInspeccion(tx, base);
      expect(r).toMatchObject({ resultado: 'con_defectos', defectos: 1 });
      const [insp] = await tx`select puntos_ok, puntos_total from inspecciones where id = ${r.inspeccionId}`;
      expect(insp).toEqual({ puntos_ok: 0, puntos_total: 1 });
      expect(await codigo(tx, () => registrarInspeccion(tx, { ...base, noAplica: i.puntosPc1 }))).toBe(
        'ninguno_aplica',
      );
      expect(
        await codigo(tx, () => registrarInspeccion(tx, { ...base, cumple: i.puntosPc1, fotos: 0 })),
      ).toBe('inspeccion_sin_foto');
    }));

  it('PC3 no se aprueba sin una prueba de agua sin fugas en ESE espacio', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const i = await ids(tx);
      const pc3 = { obraId: OBRAS.a1Carlos, hitoId: i.pc3, cumple: i.puntosPc3, fotos: 1 };
      expect(await codigo(tx, () => registrarInspeccion(tx, { ...pc3, espacioId: i.generales }))).toBe(
        'falta_prueba_agua',
      );
      expect((await registrarInspeccion(tx, { ...pc3, espacioId: i.bano })).resultado).toBe('aprobado');
      // con defectos sí se registra, aunque no haya prueba
      expect((await registrarInspeccion(tx, { ...pc3, cumple: [], espacioId: i.generales })).resultado).toBe(
        'con_defectos',
      );
    }));

  it('la última inspección manda en el cierre: con defectos, la partida no se termina', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const i = await ids(tx);
      const [demo] = await tx<{ id: string }[]>`
        select id from partidas_obra where espacio_id = ${i.bano} and hito_id = ${i.pc1}`;
      // la demolición se reabre en el avance para poder terminarla otra vez
      await tx`update avance set estado_registro = 'anulado' where partida_obra_id = ${demo!.id}`;
      await registrarInspeccion(tx, { obraId: OBRAS.a1Carlos, espacioId: i.bano, hitoId: i.pc1, fotos: 1 });
      const cierre = {
        obraId: OBRAS.a1Carlos,
        partidas: [demo!.id],
        terminadas: [demo!.id],
        fotosPorSubir: 1,
      };
      expect(await codigo(tx, () => cerrarDia(tx, cierre, enAustin('2026-10-09')))).toBe('falta_inspeccion');
    }));

  it('el dueño no inspecciona; un PM no inspecciona la obra de otro', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const i = await ids(tx);
      const e = { obraId: OBRAS.a1Carlos, espacioId: i.bano, hitoId: i.pc1, cumple: i.puntosPc1, fotos: 1 };
      expect(await codigo(tx, () => registrarInspeccion(tx, e))).toBe('obra_no_encontrada');
      await como(tx, USUARIOS.luis);
      expect(await codigo(tx, () => registrarInspeccion(tx, e))).toBe('obra_no_encontrada');
    }));
});

describe('la prueba de inundación', () => {
  it('arranca con foto, una sola en curso por espacio, y no se cierra antes de 23 horas', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const i = await ids(tx);
      const inicio = { obraId: OBRAS.a1Carlos, espacioId: i.generales };
      expect(await codigo(tx, () => iniciarPruebaAgua(tx, { ...inicio, fotos: 0 }))).toBe('prueba_sin_foto');
      const { pruebaId } = await iniciarPruebaAgua(tx, { ...inicio, fotos: 1 }, enAustin('2026-10-09', 8));
      expect(await codigo(tx, () => iniciarPruebaAgua(tx, { ...inicio, fotos: 1 }))).toBe('prueba_en_curso');

      const fin = { pruebaId, hayFuga: false, fotos: 1 };
      expect(await codigo(tx, () => terminarPruebaAgua(tx, fin, enAustin('2026-10-10', 6)))).toBe(
        'prueba_incompleta',
      );
      expect(
        await codigo(tx, () => terminarPruebaAgua(tx, { ...fin, fotos: 0 }, enAustin('2026-10-10', 9))),
      ).toBe('prueba_sin_foto');
      expect(await terminarPruebaAgua(tx, fin, enAustin('2026-10-10', 9))).toEqual({
        horas: 25,
        resultado: 'sin_fugas',
      });
      // ya sin fugas, PC3 se aprueba en ese espacio
      const d = (await datosParaCalidad(tx, { obraId: OBRAS.a1Carlos }))!;
      expect(d.espacios.length).toBe(1);
      expect(
        (
          await registrarInspeccion(tx, {
            obraId: OBRAS.a1Carlos,
            espacioId: i.generales,
            hitoId: i.pc3,
            cumple: i.puntosPc3,
            fotos: 1,
          })
        ).resultado,
      ).toBe('aprobado');
    }));

  it('con fuga queda registrada, y PC3 sigue sin aprobarse si no hay otra sin fugas', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const i = await ids(tx);
      const { pruebaId } = await iniciarPruebaAgua(
        tx,
        { obraId: OBRAS.a1Carlos, espacioId: i.generales, fotos: 1 },
        enAustin('2026-10-09', 8),
      );
      expect(
        (await terminarPruebaAgua(tx, { pruebaId, hayFuga: true, fotos: 1 }, enAustin('2026-10-10', 9)))
          .resultado,
      ).toBe('con_fuga');
      expect(
        await codigo(tx, () =>
          registrarInspeccion(tx, {
            obraId: OBRAS.a1Carlos,
            espacioId: i.generales,
            hitoId: i.pc3,
            cumple: i.puntosPc3,
            fotos: 1,
          }),
        ),
      ).toBe('falta_prueba_agua');
      // una prueba ya cerrada no se vuelve a cerrar
      expect(
        await codigo(tx, () =>
          terminarPruebaAgua(tx, { pruebaId, hayFuga: false, fotos: 1 }, enAustin('2026-10-11')),
        ),
      ).toBe('prueba_no_encontrada');
    }));
});
