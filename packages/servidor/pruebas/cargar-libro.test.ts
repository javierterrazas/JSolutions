// Cargar el libro del sistema actual en una empresa nueva (D-039), como lo hace el script con el service role:
// en una transacción que se revierte, con la conexión administrativa local.
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  conectarServidor,
  datosDelLibro,
  type DatosDelLibro,
  generarPlantilla,
  leerLibro,
  MARCA_EJEMPLO,
  type Tx,
} from '../src/index';

const admin = conectarServidor('postgresql://postgres:postgres@127.0.0.1:54322/postgres', 2);
afterAll(() => admin.sql.end());

const RUTA = fileURLToPath(new URL('../../../legacy/app/Gestion_Obra_IJM.xlsx', import.meta.url));
const datos = datosDelLibro(leerLibro(RUTA));
// un usuario de Auth de supabase/seed.sql que no es de ninguna empresa
const SIN_EMPRESA = 'c0000000-0000-4000-8000-000000000001';

const REVERTIR = new Error('revertir');
async function comoServiceRole(fn: (tx: Tx, empresa: string) => Promise<void>) {
  try {
    await admin.sql.begin(async (tx) => {
      await tx`set local role service_role`;
      const [e] = await tx<{ id: string }[]>`
        select public.alta_empresa('Empresa del Libro', 'Austin, TX', 'America/Chicago', 'es', ${SIN_EMPRESA},
                                   'Dueño del Libro', 'token-de-prueba-del-libro-0000000000', now() + interval '7 days') as id`;
      await fn(tx, e!.id);
      throw REVERTIR;
    });
  } catch (e) {
    if (e !== REVERTIR) throw e;
  }
}

const cargar = (tx: Tx, empresa: string, d: DatosDelLibro = datos) =>
  tx<{ r: Record<string, number> }[]>`select public.cargar_libro(${empresa}, ${tx.json(d as never)}) as r`;

/** La plantilla estándar con sus renglones de ejemplo como si fueran datos. */
function plantillaLlena(): DatosDelLibro {
  const l = leerLibro(generarPlantilla());
  for (const filas of Object.values(l))
    for (const f of filas)
      if (String(f[0]).startsWith(MARCA_EJEMPLO)) f[0] = String(f[0]).slice(`${MARCA_EJEMPLO} · `.length);
  return datosDelLibro(l);
}

describe('cargar el libro', () => {
  it('carga el catálogo, la configuración, los subcontratistas y la cuadrilla con su tarifa', () =>
    comoServiceRole(async (tx, empresa) => {
      const r = (await cargar(tx, empresa))[0]!.r;
      expect(r).toEqual({
        tipos: 4,
        partidas: 41,
        etapas: 17,
        oficios: datos.oficios.length,
        puntos: 38,
        subcontratistas: 6,
        trabajadores: 4,
        metas: 0,
        feriados: 0,
      });
      // el libro del sistema actual no trae días laborables: quedan los de siempre (D-028)
      const [dl] = await tx`select dias_laborables from configuracion where empresa_id = ${empresa}`;
      expect(dl).toEqual({ dias_laborables: [1, 2, 3, 4, 5, 6] });
      const [c] =
        await tx`select impuesto, limite_compra_pm from configuracion where empresa_id = ${empresa}`;
      expect(c).toEqual({ impuesto: '0.0825', limite_compra_pm: '300.00' });

      // las partidas del baño, con su punto de control, su etapa y, si es de un sub, su oficio
      const bano = await tx`
        select p.nombre_es, p.responsable, o.nombre_es as oficio, h.clave as hito, e.nombre_es as etapa
        from plantillas_partida p join tipos_espacio t on t.id = p.tipo_espacio_id
        left join oficios o on o.id = p.oficio_id left join hitos_calidad h on h.id = p.hito_id
        left join etapas e on e.id = p.etapa_id
        where t.empresa_id = ${empresa} and t.nombre_es = 'Baño' order by p.orden`;
      expect(bano).toHaveLength(16);
      expect(bano.some((p) => p.responsable === 'subcontratista' && p.oficio === 'Plomería')).toBe(true);
      const delLibro = datos.partidas.filter((p) => p.tipo === 'Baño').sort((a, b) => a.orden - b.orden);
      expect(bano.map((p) => [p.nombre_es, p.hito, p.etapa, p.oficio])).toEqual(
        delLibro.map((p) => [p.nombre_es, p.hito, p.etapa, p.oficio]),
      );
      expect(bano.filter((p) => p.hito).map((p) => p.hito)).toEqual(['PC1', 'PC2', 'PC3', 'PC4']);
      expect(bano.every((p) => p.etapa)).toBe(true);

      const [agua] =
        await tx`select clave from hitos_calidad where empresa_id = ${empresa} and exige_prueba_agua`;
      expect(agua).toEqual({ clave: 'PC3' });
      const [angel] = await tx`
        select t.tipo_pago, tt.tarifa, tt.vigente_desde::text from trabajadores t
        join tarifas_trabajador tt on tt.trabajador_id = t.id
        where t.empresa_id = ${empresa} and t.nombre = 'Angel Perez'`;
      expect(angel).toEqual({ tipo_pago: 'dia', tarifa: '220.00', vigente_desde: '2000-01-01' });
    }));

  it('no carga dos veces: una empresa con catálogo se rechaza, y no queda nada a medias', () =>
    comoServiceRole(async (tx, empresa) => {
      await cargar(tx, empresa);
      await expect(tx.savepoint((t) => cargar(t, empresa))).rejects.toThrow('empresa_con_catalogo');
      const [n] = await tx`select count(*)::int as n from plantillas_partida where empresa_id = ${empresa}`;
      expect(n).toEqual({ n: 41 });
    }));

  it('solo el service role lo carga: ni el servidor de la app ni la API', () =>
    comoServiceRole(async (tx, empresa) => {
      for (const rol of ['servidor_app', 'authenticated']) {
        await tx`reset role`;
        await tx`set local role ${tx(rol)}`;
        await expect(
          tx.savepoint((t) => cargar(t, empresa)),
          rol,
        ).rejects.toThrow(/permission denied/);
      }
    }));
});

describe('cargar la plantilla estándar', () => {
  it('guarda además los días laborables, los feriados y los nombres en inglés', () =>
    comoServiceRole(async (tx, empresa) => {
      const d = plantillaLlena();
      const sinSabado = { ...d, diasLaborables: [1, 2, 3, 4, 5] };
      const r = (await cargar(tx, empresa, sinSabado))[0]!.r;
      expect(r).toMatchObject({
        tipos: 2,
        partidas: 2,
        puntos: 1,
        subcontratistas: 1,
        trabajadores: 1,
        feriados: 1,
      });
      const [c] = await tx`select dias_laborables from configuracion where empresa_id = ${empresa}`;
      expect(c).toEqual({ dias_laborables: [1, 2, 3, 4, 5] });
      const [f] =
        await tx`select dia::text, nombre_es, nombre_en, se_trabaja from feriados where empresa_id = ${empresa}`;
      expect(f).toEqual({
        dia: '2026-11-26',
        nombre_es: 'Día de Acción de Gracias',
        nombre_en: 'Thanksgiving Day',
        se_trabaja: false,
      });
      const ingles = await tx`
        select p.nombre_en from plantillas_partida p where p.empresa_id = ${empresa} order by p.nombre_en`;
      expect(ingles.map((x) => x.nombre_en)).toEqual(['Plumbing rough-in', 'Protection and setup']);
      const [pc] = await tx`select texto_en from puntos_control where empresa_id = ${empresa}`;
      expect(pc).toEqual({ texto_en: 'Plumbing pressure test held' });
    }));
});
