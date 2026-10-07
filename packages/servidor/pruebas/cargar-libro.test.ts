// Cargar el libro del sistema actual en una empresa nueva (D-039), como lo hace el script con el service role:
// en una transacción que se revierte, con la conexión administrativa local.
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { conectarServidor, datosDelLibro, leerLibro, type Tx } from '../src/index';

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

const cargar = (tx: Tx, empresa: string) =>
  tx<
    { r: Record<string, number> }[]
  >`select public.cargar_libro(${empresa}, ${tx.json(datos as never)}) as r`;

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
      });
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
