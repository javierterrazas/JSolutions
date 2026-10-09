// Cerrar el día (adaptadas de legacy/pruebas/prueba_escritura.js, prueba_tardio.js y prueba_pordia.js), a nombre
// de los PMs de prueba, contra la base local. "Hoy" es el lunes 12 de octubre de 2026 en Austin.
import { afterAll, describe, expect, it } from 'vitest';
import {
  cerrarDia,
  cierreDeClave,
  cierreParaCorregir,
  corregirCierre,
  crearObra,
  guardarPresupuesto,
  type Tx,
} from '../src/index';
import { codigo, como, EMPRESA_A, enAustin, MIEMBROS, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 18);

async function datosDe(tx: Tx, obraId: string) {
  const partidas = await tx<{ id: string; nombre: string; espacio: string }[]>`
    select id, nombre_es as nombre, espacio_id as espacio from partidas_obra where obra_id = ${obraId} order by orden`;
  const ordenes = await tx<
    { id: string; estado: string }[]
  >`select id, estado from ordenes_trabajo where obra_id = ${obraId}`;
  const pedro = (await tx<{ id: string }[]>`select id from trabajadores where nombre = 'Pedro'`)[0]!.id;
  const juan = (await tx<{ id: string }[]>`select id from trabajadores where nombre = 'Juan'`)[0]!.id;
  const p = (n: string) => partidas.find((x) => x.nombre.startsWith(n))!;
  return { demolicion: p('Demolición'), rough: p('Rough'), ordenes, pedro, juan };
}

describe('cerrar el día', () => {
  it('escribe bitácora, partidas, sub que llegó, avance y cuadrilla, todo a nombre del PM', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const d = await datosDe(tx, OBRAS.a1Carlos);
      const ot = d.ordenes.find((o) => o.estado === 'emitida')!;
      const r = await cerrarDia(
        tx,
        {
          obraId: OBRAS.a1Carlos,
          partidas: [d.rough.id],
          cuadrilla: [{ trabajadorId: d.pedro, cantidad: 8 }],
          subs: [{ ordenTrabajoId: ot.id, llego: true }],
          fotosPorSubir: 2,
          incidencia: 'Llegó el plomero a las 9',
        },
        LUNES,
      );
      expect(r).toMatchObject({ dia: '2026-10-12', tardio: false, fotosComprometidas: 2, cuadrilla: 8 });
      expect(r.folio).toMatch(/^BIT-\d{4}$/);
      const [b] =
        await tx`select dia::text, tardio, fotos_comprometidas, creado_por, incidencia from bitacora where id = ${r.bitacoraId}`;
      expect(b).toEqual({
        dia: '2026-10-12',
        tardio: false,
        fotos_comprometidas: 2,
        creado_por: MIEMBROS.carlos,
        incidencia: 'Llegó el plomero a las 9',
      });
      const [av] =
        await tx`select estado, dia::text, creado_por from avance where bitacora_id = ${r.bitacoraId}`;
      expect(av).toEqual({ estado: 'en_progreso', dia: '2026-10-12', creado_por: MIEMBROS.carlos });
      const [mo] =
        await tx`select partida_obra_id, espacio_id, cantidad from mano_obra where bitacora_id = ${r.bitacoraId}`;
      expect(mo).toEqual({ partida_obra_id: d.rough.id, espacio_id: d.rough.espacio, cantidad: '8.00' });
      const [o] = await tx`select estado, se_presento from ordenes_trabajo where id = ${ot.id}`;
      expect(o).toEqual({ estado: 'confirmada', se_presento: true });
    }));

  it('un solo cierre por obra y día', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const d = await datosDe(tx, OBRAS.a1Carlos);
      const cierre = { obraId: OBRAS.a1Carlos, partidas: [d.rough.id], fotosPorSubir: 1 };
      await cerrarDia(tx, cierre, LUNES);
      expect(await codigo(tx, () => cerrarDia(tx, cierre, LUNES))).toBe('dia_ya_cerrado');
    }));

  it('el reintento de un cierre con su clave de envío recibe el mismo cierre, sin duplicar nada (D-042)', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const d = await datosDe(tx, OBRAS.a1Carlos);
      const clave = '7b0c3f7e-1a2b-4c3d-8e9f-001122334455';
      const cierre = {
        obraId: OBRAS.a1Carlos,
        partidas: [d.rough.id],
        cuadrilla: [{ trabajadorId: d.pedro, cantidad: 8 }],
        fotosPorSubir: 2,
        claveEnvio: clave,
      };
      const primero = await cerrarDia(tx, cierre, LUNES);
      // la señal se cortó antes de la respuesta: el teléfono lo manda otra vez, y hasta al día siguiente
      const otraVez = await cerrarDia(tx, cierre, enAustin('2026-10-13', 7));
      expect(otraVez).toEqual(primero);
      expect(await cierreDeClave(tx, clave)).toBe(primero.bitacoraId);
      const [n] = await tx`
        select (select count(*)::int from bitacora where obra_id = ${OBRAS.a1Carlos} and dia = '2026-10-12') as cierres,
               (select count(*)::int from mano_obra where bitacora_id = ${primero.bitacoraId}) as cuadrilla`;
      expect(n).toEqual({ cierres: 1, cuadrilla: 1 });
      // otro cierre del mismo día, con otra clave, sí es un segundo cierre: se rechaza
      expect(
        await codigo(tx, () =>
          cerrarDia(tx, { ...cierre, claveEnvio: '7b0c3f7e-1a2b-4c3d-8e9f-001122334466' }, LUNES),
        ),
      ).toBe('dia_ya_cerrado');
      expect(await cierreDeClave(tx, '7b0c3f7e-1a2b-4c3d-8e9f-001122334477')).toBeNull();
    }));

  it('un día sin trabajo se reporta con su motivo, sin partidas ni fotos', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const r = await cerrarDia(tx, { obraId: OBRAS.a1Carlos, sinTrabajo: true, motivo: 'clima' }, LUNES);
      const [b] =
        await tx`select sin_trabajo, motivo_sin_trabajo, fotos_comprometidas from bitacora where id = ${r.bitacoraId}`;
      expect(b).toEqual({ sin_trabajo: true, motivo_sin_trabajo: 'clima', fotos_comprometidas: 0 });
    }));

  it('lo que falta o no es de la obra se rechaza, y no queda nada a medias', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const d = await datosDe(tx, OBRAS.a1Carlos);
      const antes = (await tx`select count(*)::int as n from bitacora`)[0]!.n;
      const base = { obraId: OBRAS.a1Carlos, partidas: [d.rough.id], fotosPorSubir: 1 };
      expect(await codigo(tx, () => cerrarDia(tx, { ...base, fotosPorSubir: 0 }, LUNES))).toBe('falta_foto');
      expect(await codigo(tx, () => cerrarDia(tx, { ...base, partidas: [] }, LUNES))).toBe('faltan_partidas');
      expect(await codigo(tx, () => cerrarDia(tx, { ...base, sinTrabajo: true }, LUNES))).toBe(
        'falta_motivo_sin_trabajo',
      );
      await como(tx, USUARIOS.luis);
      const deLuis = await datosDe(tx, OBRAS.a2Luis);
      await como(tx, USUARIOS.carlos);
      expect(
        await codigo(tx, () =>
          cerrarDia(tx, { ...base, subs: [{ ordenTrabajoId: deLuis.ordenes[0]!.id, llego: true }] }, LUNES),
        ),
      ).toBe('orden_de_otra_obra');
      expect(await codigo(tx, () => cerrarDia(tx, { ...base, partidas: [deLuis.rough.id] }, LUNES))).toBe(
        'partida_de_otra_obra',
      );
      expect(
        await codigo(tx, () =>
          cerrarDia(tx, { ...base, cuadrilla: [{ trabajadorId: d.juan, cantidad: 8 }] }, LUNES),
        ),
      ).toBe('cuadrilla_dia_o_medio');
      expect((await tx`select count(*)::int as n from bitacora`)[0]!.n).toBe(antes);
    }));

  it('el PM solo cierra sus obras, y solo el PM cierra el día', () =>
    probarComo(USUARIOS.luis, async (tx) => {
      expect(
        await codigo(tx, () =>
          cerrarDia(tx, { obraId: OBRAS.a1Carlos, sinTrabajo: true, motivo: 'clima' }, LUNES),
        ),
      ).toBe('obra_no_encontrada');
      await como(tx, USUARIOS.duenoA);
      expect(
        await codigo(tx, () =>
          cerrarDia(tx, { obraId: OBRAS.a1Carlos, sinTrabajo: true, motivo: 'clima' }, LUNES),
        ),
      ).toBe('solo_pm');
    }));
});

describe('el día y el cierre tardío', () => {
  it('el lunes puede cerrar tarde el sábado y el viernes (lunes a sábado), no el jueves', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const d = await datosDe(tx, OBRAS.a1Carlos);
      const tarde = (dia: string) => ({
        obraId: OBRAS.a1Carlos,
        tardio: dia,
        partidas: [d.rough.id],
        fotosPorSubir: 1,
      });
      const sab = await cerrarDia(tx, tarde('2026-10-10'), LUNES);
      expect(sab).toMatchObject({ dia: '2026-10-10', tardio: true });
      expect((await tx`select tardio from bitacora where id = ${sab.bitacoraId}`)[0]!.tardio).toBe(true);
      expect((await cerrarDia(tx, tarde('2026-10-09'), LUNES)).dia).toBe('2026-10-09');
      expect(await codigo(tx, () => cerrarDia(tx, tarde('2026-10-08'), LUNES))).toBe('fuera_de_ventana');
      expect(await codigo(tx, () => cerrarDia(tx, tarde('2026-10-10'), LUNES))).toBe('dia_ya_cerrado');
    }));

  it('capturado sin señal a las 11:30 pm y enviado después de medianoche: es del día anterior', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const d = await datosDe(tx, OBRAS.a1Carlos);
      const r = await cerrarDia(
        tx,
        {
          obraId: OBRAS.a1Carlos,
          partidas: [d.rough.id],
          fotosPorSubir: 1,
          capturado: '2026-10-12T23:30:00-05:00',
        },
        new Date('2026-10-13T00:30:00-05:00'),
      );
      expect(r.dia).toBe('2026-10-12');
    }));
});

describe('calidad y cuadrilla al cerrar', () => {
  it('terminar una partida con punto de control exige su inspección aprobada en ese espacio', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      // una obra nueva de Carlos, con presupuesto, sin ninguna inspección
      const tipo = (await tx<{ id: string }[]>`select id from tipos_espacio where nombre_es = 'Baño'`)[0]!.id;
      const r = await crearObra(tx, {
        cliente: 'Calidad', telefono: '5125550188', direccion: '1 Calidad', pmId: MIEMBROS.carlos,
        inicio: '2026-10-05', finEstimada: '2026-11-06', contrato: 1, espacios: [{ tipoEspacioId: tipo, pies2: 40 }],
      }); // prettier-ignore
      if (!r.ok) throw new Error('no se creó');
      await como(tx, USUARIOS.carlos);
      const d = await datosDe(tx, r.obraId);
      const cierre = {
        obraId: r.obraId,
        partidas: [d.demolicion.id],
        terminadas: [d.demolicion.id],
        fotosPorSubir: 1,
      };
      expect(await codigo(tx, () => cerrarDia(tx, cierre, LUNES))).toBe('obra_sin_presupuesto');
      await como(tx, USUARIOS.duenoA);
      const etapas = await tx<{ e: string; t: string | null }[]>`
        select distinct espacio_id as e, etapa_id as t from partidas_obra where obra_id = ${r.obraId}`;
      await guardarPresupuesto(tx, {
        obraId: r.obraId,
        lineas: etapas.map((x) => ({ espacioId: x.e, etapaId: x.t, monto: 100 })),
      });
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => cerrarDia(tx, cierre, LUNES))).toBe('falta_inspeccion');
      // sin terminarla, sí: y la obra arranca con su primer día de trabajo
      await cerrarDia(tx, { ...cierre, terminadas: [] }, LUNES);
      await como(tx, USUARIOS.duenoA);
      expect((await tx`select estado from obras where id = ${r.obraId}`)[0]!.estado).toBe('en_obra');
    }));

  it('16 horas sumando obras, aunque la otra sea de otro PM que este no puede ver', () =>
    probarComo(USUARIOS.luis, async (tx) => {
      const deLuis = await datosDe(tx, OBRAS.a2Luis);
      await cerrarDia(
        tx,
        {
          obraId: OBRAS.a2Luis,
          partidas: [deLuis.rough.id],
          fotosPorSubir: 1,
          cuadrilla: [{ trabajadorId: deLuis.pedro, cantidad: 10 }],
        },
        LUNES,
      );
      await como(tx, USUARIOS.carlos);
      const d = await datosDe(tx, OBRAS.a1Carlos);
      // Carlos no ve la obra de Luis ni sus horas...
      expect((await tx`select count(*)::int as n from mano_obra where obra_id = ${OBRAS.a2Luis}`)[0]!.n).toBe(
        0,
      );
      // ...pero el tope sí las cuenta
      const base = { obraId: OBRAS.a1Carlos, partidas: [d.rough.id], fotosPorSubir: 1 };
      expect(
        await codigo(tx, () =>
          cerrarDia(tx, { ...base, cuadrilla: [{ trabajadorId: d.pedro, cantidad: 7 }] }, LUNES),
        ),
      ).toBe('cuadrilla_pasa_16_horas');
      expect(
        (await cerrarDia(tx, { ...base, cuadrilla: [{ trabajadorId: d.pedro, cantidad: 6 }] }, LUNES))
          .cuadrilla,
      ).toBe(6);
    }));
});

// Con el reloj de verdad: la base pone la hora de creación de cada cierre con now(), y las 48 h se cuentan desde ahí.
describe('corregir un cierre (D-044)', () => {
  const AHORA = new Date();
  const DESPUES = new Date(AHORA.getTime() + 2 * 3600 * 1000);
  const EN_TRES_DIAS = new Date(AHORA.getTime() + 72 * 3600 * 1000);
  /** Un cierre del lunes con su foto ya registrada (el archivo es de prueba). */
  async function cierreConFoto(tx: Tx) {
    const d = await datosDe(tx, OBRAS.a1Carlos);
    const r = await cerrarDia(
      tx,
      {
        obraId: OBRAS.a1Carlos,
        partidas: [d.rough.id],
        cuadrilla: [{ trabajadorId: d.pedro, cantidad: 8 }],
        fotosPorSubir: 1,
      },
      AHORA,
    );
    await tx`insert into fotos (empresa_id, obra_id, ref_tipo, ref_id, indice, storage_path)
             values (${EMPRESA_A}, ${OBRAS.a1Carlos}, 'bitacora', ${r.bitacoraId}, 1,
                     ${`${EMPRESA_A}/${OBRAS.a1Carlos}/bitacora/prueba-correccion.jpg`})`;
    return { d, r };
  }

  it('anula el cierre con su motivo y lo vuelve a cerrar el mismo día; la foto ya subida cuenta sin moverse', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const { d, r } = await cierreConFoto(tx);
      const antes = await cierreParaCorregir(tx, { obraId: OBRAS.a1Carlos, dia: r.dia }, AHORA);
      expect(antes).toMatchObject({
        bitacoraId: r.bitacoraId,
        corregible: true,
        partidas: [d.rough.id],
        cuadrilla: [{ trabajadorId: d.pedro, cantidad: 8 }],
        fotos: 1,
      });

      const nuevo = await corregirCierre(
        tx,
        {
          bitacoraId: r.bitacoraId,
          motivo: 'Faltó anotar a Juan',
          partidas: [d.rough.id],
          cuadrilla: [
            { trabajadorId: d.pedro, cantidad: 6 },
            { trabajadorId: d.juan, cantidad: 1 },
          ],
          fotosPorSubir: 1,
        },
        DESPUES,
      );
      expect(nuevo).toMatchObject({ dia: r.dia, fotosComprometidas: 1 });
      const [viejo] = await tx`select estado from bitacora where id = ${r.bitacoraId}`;
      expect(viejo).toEqual({ estado: 'anulado' });
      const [b] = await tx`select estado, corrige_a, dia::text from bitacora where id = ${nuevo.bitacoraId}`;
      expect(b).toEqual({ estado: 'vigente', corrige_a: r.bitacoraId, dia: r.dia });
      const cuadrilla = await tx`
        select trabajador_id, cantidad, estado from mano_obra where bitacora_id in (${r.bitacoraId}, ${nuevo.bitacoraId})
        order by estado, cantidad`;
      expect(cuadrilla.map((c) => [c.estado, c.cantidad])).toEqual([
        ['vigente', '1.00'],
        ['vigente', '6.00'],
        ['anulado', '8.00'],
      ]);
      const despues = await cierreParaCorregir(tx, { obraId: OBRAS.a1Carlos, dia: r.dia }, AHORA);
      expect(despues).toMatchObject({ bitacoraId: nuevo.bitacoraId, fotos: 1 });
      // el rastro lo lee el dueño: el PM no ve correcciones
      await como(tx, USUARIOS.duenoA);
      const [rastro] = await tx`
        select accion, motivo from correcciones where tabla = 'bitacora' and registro_id = ${r.bitacoraId}`;
      expect(rastro).toEqual({ accion: 'anular', motivo: 'Faltó anotar a Juan' });
    }));

  it('sin una foto subida ni nueva, la corrección pide foto como cualquier cierre', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const d = await datosDe(tx, OBRAS.a1Carlos);
      const r = await cerrarDia(
        tx,
        { obraId: OBRAS.a1Carlos, partidas: [d.rough.id], fotosPorSubir: 1 },
        AHORA,
      );
      expect(
        await codigo(tx, () =>
          corregirCierre(
            tx,
            { bitacoraId: r.bitacoraId, motivo: 'Se me olvidó una partida', partidas: [d.rough.id] },
            AHORA,
          ),
        ),
      ).toBe('falta_foto');
    }));

  it('después de 48 horas ya no lo corrige el PM; el de otro PM ni lo encuentra', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const { d, r } = await cierreConFoto(tx);
      const jueves = EN_TRES_DIAS;
      expect((await cierreParaCorregir(tx, { obraId: OBRAS.a1Carlos, dia: r.dia }, jueves))?.corregible).toBe(
        false,
      );
      const correccion = { bitacoraId: r.bitacoraId, motivo: 'tarde', partidas: [d.rough.id] };
      expect(await codigo(tx, () => corregirCierre(tx, correccion, jueves))).toBe('fuera_de_48_horas');
      await como(tx, USUARIOS.luis);
      expect(await codigo(tx, () => corregirCierre(tx, correccion, AHORA))).toBe('registro_no_encontrado');
    }));
});
