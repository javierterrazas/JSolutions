// Paso 4: la muralla financiera y el aislamiento entre empresas. Los usuarios reales de Supabase Auth LEEN por la
// API, como lo hará la app; las escrituras se hacen como el servidor (rol servidor_app) a nombre de cada usuario
// (D-026). supabase/seed.sql deja renglones en TODAS las tablas de las dos empresas: si un PM ve cero renglones,
// es porque RLS se los oculta, no porque la tabla esté vacía.
import type { SupabaseClient } from '@supabase/supabase-js';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conexionDePrueba } from '../conexion';
import { comoServidor, enTransaccionRevertida, errorDe } from '../datos';
import {
  clienteAnonimo,
  clienteServicio,
  EMPRESAS,
  entrarComo,
  MIEMBROS,
  OBRAS,
  USERS,
  USUARIOS,
} from '../usuarios';

const { cliente: base } = conexionDePrueba();
afterAll(() => base.end());

// 💲 D-002
const TABLAS_DINERO = [
  'tarifas_trabajador', 'obras_finanzas', 'presupuesto_etapas', 'ordenes_trabajo_precios', 'pagos_sub',
  'ordenes_cambio_montos', 'no_calidad', 'cobros', 'obras_cerradas', 'historico_etapas',
]; // prettier-ignore

// Tablas que el PM no lee completas: las ve por una vista, o no las ve.
const TABLAS_SIN_PM = [
  ...TABLAS_DINERO, 'empresas', 'configuracion', 'metas_indicadores', 'folios', 'plantillas_partida',
  'subcontratistas', 'ordenes_cambio', 'entregas', 'plan_semanal', 'historico_duraciones', 'correcciones',
]; // prettier-ignore

const VISTAS_PM = [
  'empresa_actual_datos', 'configuracion_pm', 'subcontratistas_pm', 'entregas_pm', 'ordenes_cambio_pm',
]; // prettier-ignore

type Renglon = Record<string, unknown>;
type Usuario = keyof typeof USUARIOS;
const sesiones: Partial<Record<Usuario, SupabaseClient>> = {};
const como = (u: Usuario) => sesiones[u]!;

let tablas: string[] = [];
let conObra: Set<string>;

beforeAll(async () => {
  for (const u of ['duenoA', 'pm1A', 'pm2A', 'duenoB', 'pm1B'] as const)
    sesiones[u] = await entrarComo(USUARIOS[u]);
  const r = await base<{ tabla: string }[]>`
    select table_name as tabla from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`;
  tablas = r.map((t) => t.tabla);
  const o = await base<{ tabla: string }[]>`
    select table_name as tabla from information_schema.columns
    where table_schema = 'public' and column_name = 'obra_id'
      and table_name in (select table_name from information_schema.tables
                         where table_schema = 'public' and table_type = 'BASE TABLE')`;
  conObra = new Set(o.map((t) => t.tabla));
});

/** Lo que el usuario lee de una tabla o vista. Un error de permisos cuenta como "no ve nada". */
async function leer(c: SupabaseClient, tabla: string): Promise<Renglon[]> {
  const { data, error } = await c.from(tabla).select('*');
  if (error) {
    if (/permission denied|not find|42501/i.test(error.message + error.code)) return [];
    throw new Error(`${tabla}: ${error.message}`);
  }
  return data as Renglon[];
}

const empresaDe = (tabla: string, r: Renglon) => (tabla === 'empresas' ? r.id : r.empresa_id);
const obraDe = (tabla: string, r: Renglon) => (tabla === 'obras' ? r.id : r.obra_id);

describe('las tablas tienen datos en las dos empresas', () => {
  it('cada tabla tiene renglones de A y de B (salvo el cierre, que solo existe en A)', async () => {
    const vacias: string[] = [];
    for (const t of tablas) {
      const col = t === 'empresas' ? 'id' : 'empresa_id';
      const r = await base.unsafe(`select array_agg(distinct ${col}::text) as e from public.${t}`);
      const empresas = (r[0]?.e ?? []) as string[];
      const esperadas = ['obras_cerradas', 'historico_etapas', 'historico_duraciones'].includes(t)
        ? [EMPRESAS.a]
        : [EMPRESAS.a, EMPRESAS.b];
      if (!esperadas.every((e) => empresas.includes(e))) vacias.push(t);
    }
    expect(vacias).toEqual([]);
  });
});

describe('la muralla financiera', () => {
  it.each(['pm1A', 'pm2A', 'pm1B'] as const)('%s no lee ninguna tabla con dinero', async (u) => {
    const vistas: Record<string, number> = {};
    for (const t of TABLAS_DINERO) vistas[t] = (await leer(como(u), t)).length;
    expect(vistas).toEqual(Object.fromEntries(TABLAS_DINERO.map((t) => [t, 0])));
  });

  it.each(['pm1A', 'pm2A', 'pm1B'] as const)('%s no lee las tablas que no son suyas', async (u) => {
    const vistas: Record<string, number> = {};
    for (const t of TABLAS_SIN_PM) vistas[t] = (await leer(como(u), t)).length;
    expect(vistas).toEqual(Object.fromEntries(TABLAS_SIN_PM.map((t) => [t, 0])));
  });

  it('el dueño sí lee el dinero de su empresa (las tablas no están vacías)', async () => {
    for (const t of TABLAS_DINERO) {
      const r = await leer(como('duenoA'), t);
      expect(r.length, t).toBeGreaterThan(0);
      expect(new Set(r.map((x) => x.empresa_id)), t).toEqual(new Set([EMPRESAS.a]));
    }
  });

  it('a ninguna vista del PM se le escapa una columna de dinero', async () => {
    for (const v of VISTAS_PM) {
      const r = await leer(como('pm1A'), v);
      expect(r.length, v).toBeGreaterThan(0);
      const columnas = Object.keys(r[0]!).join(',');
      expect(columnas, v).not.toMatch(
        /monto|precio|tarifa|costo|contrato|margen|cobr|pago|factur|seguro|licencia/,
      );
    }
  });
});

describe('el PM ve solo sus obras', () => {
  it('Carlos ve su obra en curso, no la de Luis, ni la entregada, ni las de otra empresa', async () => {
    const obras = await leer(como('pm1A'), 'obras');
    expect(obras.map((o) => o.id)).toEqual([OBRAS.a1Carlos]);
  });

  it('en cada tabla de una obra, Carlos ve solo renglones de su obra, y sí ve los suyos', async () => {
    const ajenos: string[] = [];
    const sinVer: string[] = [];
    for (const t of tablas.filter((x) => conObra.has(x) || x === 'obras')) {
      // gastos y avisos van por quién los registró, no por obra: se prueban abajo
      if (TABLAS_SIN_PM.includes(t) || t === 'gastos' || t === 'avisos') continue;
      const r = await leer(como('pm1A'), t);
      if (r.some((x) => obraDe(t, x) !== OBRAS.a1Carlos)) ajenos.push(t);
      if (r.length === 0) sinVer.push(t);
    }
    expect(ajenos).toEqual([]);
    expect(sinVer).toEqual([]);
  });

  it('gastos: solo los que él registró; nunca las compras de la oficina de su obra', async () => {
    const r = await leer(como('pm1A'), 'gastos');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((g) => g.origen === 'pm' && g.creado_por === 'a1000000-0000-4000-8000-000000000002')).toBe(
      true,
    );
  });

  it('avisos: solo los que él levantó (como el legacy, también de obras ya entregadas)', async () => {
    const r = await leer(como('pm1A'), 'avisos');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((a) => a.creado_por === 'a1000000-0000-4000-8000-000000000002')).toBe(true);
    expect(r.some((a) => a.obra_id === OBRAS.a2Luis)).toBe(false);
  });

  it('órdenes de trabajo: nunca las pagadas (D-017)', async () => {
    const r = await leer(como('pm1A'), 'ordenes_trabajo');
    expect(r.map((o) => o.estado)).toEqual(['emitida']);
  });

  it('órdenes de cambio: por la vista, solo autorizadas y facturadas, sin estado ni condición de pago', async () => {
    const r = await leer(como('pm1A'), 'ordenes_cambio_pm');
    expect(r.map((o) => o.descripcion).sort()).toEqual([
      'Nicho adicional en la regadera',
      'Tile de otra colección',
    ]);
    expect(Object.keys(r[0]!).sort()).toEqual(
      ['autorizada_en', 'descripcion', 'dias_impacto', 'empresa_id', 'folio', 'id', 'obra_id'].sort(),
    );
  });

  it('las vistas solo traen lo de su empresa y sus obras', async () => {
    expect((await leer(como('pm1A'), 'empresa_actual_datos')).map((e) => e.id)).toEqual([EMPRESAS.a]);
    expect(Object.keys((await leer(como('pm1A'), 'configuracion_pm'))[0]!).sort()).toEqual(
      ['dias_laborables', 'empresa_id', 'horas_sin_recibo', 'limite_compra_pm', 'sla_bloqueo_horas'].sort(),
    );
    expect((await leer(como('pm1A'), 'entregas_pm')).map((e) => e.obra_id)).toEqual([OBRAS.a1Carlos]);
    expect((await leer(como('pm1A'), 'subcontratistas_pm')).every((s) => s.empresa_id === EMPRESAS.a)).toBe(
      true,
    );
  });

  it('miembros y dispositivos: solo los suyos', async () => {
    expect((await leer(como('pm1A'), 'miembros')).map((m) => m.nombre)).toEqual(['Carlos Méndez']);
    // el PIN está vedado por columna (D-024): se piden solo las columnas permitidas
    const { data } = await como('pm1A').from('dispositivos').select('id, miembro_id, nombre');
    expect(data?.map((d) => d.nombre)).toEqual(['Celular de Carlos Méndez']);
  });
});

describe('ninguna empresa ve nada de otra', () => {
  it.each(['duenoA', 'pm1A', 'duenoB', 'pm1B'] as const)('%s: en ninguna tabla ni vista', async (u) => {
    const propia = u.endsWith('A') ? EMPRESAS.a : EMPRESAS.b;
    const ajenas: string[] = [];
    for (const t of [...tablas, ...VISTAS_PM]) {
      const r = await leer(como(u), t);
      if (r.some((x) => (empresaDe(t, x) ?? propia) !== propia)) ajenas.push(t);
    }
    expect(ajenas).toEqual([]);
  });

  it('sin sesión no se lee nada', async () => {
    const anon = clienteAnonimo();
    const vistas: string[] = [];
    for (const t of [...tablas, ...VISTAS_PM]) if ((await leer(anon, t)).length) vistas.push(t);
    expect(vistas).toEqual([]);
  });
});

describe('las fotos que ve el PM', () => {
  it('nunca los recibos de las compras de la oficina ni las fotos de órdenes de cambio', async () => {
    const r = await leer(como('pm1A'), 'fotos');
    const [oficina] =
      await base`select id from gastos where obra_id = ${OBRAS.a1Carlos} and origen = 'oficina'`;
    expect(r.some((f) => f.ref_tipo === 'orden_cambio')).toBe(false);
    expect(r.some((f) => f.ref_id === oficina!.id)).toBe(false);
  });

  it('sí el recibo de su propio gasto y las fotos de su bitácora', async () => {
    const tipos = new Set((await leer(como('pm1A'), 'fotos')).map((f) => f.ref_tipo));
    expect(tipos).toEqual(new Set(['bitacora', 'gasto']));
  });
});

describe('por la API los usuarios solo leen (D-026)', () => {
  it.each(['pm1A', 'duenoA'] as const)('%s no crea, no edita ni borra en ninguna tabla', async (u) => {
    const abiertas: string[] = [];
    for (const t of tablas) {
      const crear = await como(u).from(t).insert({});
      // una columna que toda tabla tiene, para que la respuesta sea de permisos y no de columna inexistente
      const cambio = t === 'empresas' ? { nombre: 'Cambiada' } : { empresa_id: EMPRESAS.a };
      const editar = await como(u)
        .from(t)
        .update(cambio)
        .eq(t === 'empresas' ? 'id' : 'empresa_id', EMPRESAS.a);
      const borrar = await como(u)
        .from(t)
        .delete()
        .eq(t === 'empresas' ? 'id' : 'empresa_id', EMPRESAS.a);
      for (const [op, r] of [
        ['crear', crear],
        ['editar', editar],
        ['borrar', borrar],
      ] as const) {
        if (!/permission denied/.test(r.error?.message ?? '')) abiertas.push(`${t}: ${op}`);
      }
    }
    expect(abiertas).toEqual([]);
  });

  it('el PM no escribe "correcciones" falsas en la auditoría', async () => {
    const { error } = await como('pm1A').from('correcciones').insert({
      empresa_id: EMPRESAS.a,
      tabla: 'cobros',
      registro_id: OBRAS.a1Carlos,
      accion: 'anular',
      motivo: 'el dueño lo pidió',
      creado_por: MIEMBROS.carlos,
    });
    expect(error?.message).toMatch(/permission denied/);
  });

  it('el PIN no se puede leer, ni el propio ni el de los demás', async () => {
    for (const u of ['pm1A', 'duenoA'] as const) {
      const { error } = await como(u).from('dispositivos').select('pin_hash');
      expect(error?.message, u).toMatch(/permission denied/);
    }
    const { data } = await como('pm1A').from('dispositivos').select('id, nombre, verificado_en');
    expect(data?.length).toBe(1);
  });
});

describe('el servidor escribe a nombre del usuario, y RLS lo sigue protegiendo', () => {
  type Tx = postgres.TransactionSql;

  const cierre = (obra: string, creadoPor: string) => (t: Tx) =>
    t`insert into bitacora (empresa_id, obra_id, dia, creado_por)
      values (${EMPRESAS.a}, ${obra}, '2026-10-09', ${creadoPor})`;

  it('el PM cierra el día en su obra, a su nombre; no en la obra de otro ni a nombre de otro', () =>
    enTransaccionRevertida(base, async (tx) => {
      await comoServidor(tx, USERS.carlos);
      expect(await errorDe(tx, cierre(OBRAS.a1Carlos, MIEMBROS.carlos))).toBeNull();
      expect(await errorDe(tx, cierre(OBRAS.a2Luis, MIEMBROS.carlos))).toMatch(/row-level security/);
      // a nombre de otro: la base pone al autor de la sesión, mande lo que mande el servidor
      const [b] = await tx`insert into bitacora (empresa_id, obra_id, dia, creado_por, creado_en)
                           values (${EMPRESAS.a}, ${OBRAS.a1Carlos}, '2026-10-12', ${MIEMBROS.luis}, '2001-01-01')
                           returning creado_por, creado_en > now() - interval '1 minute' as ahora`;
      expect(b).toEqual({ creado_por: MIEMBROS.carlos, ahora: true });
    }));

  it('el folio lo pone la base: lo que mande el servidor se ignora', () =>
    enTransaccionRevertida(base, async (tx) => {
      await comoServidor(tx, USERS.carlos);
      const [b] = await tx`insert into bitacora (empresa_id, folio, obra_id, dia, creado_por)
                           values (${EMPRESAS.a}, 'BIT-0001', ${OBRAS.a1Carlos}, '2026-10-09', ${MIEMBROS.carlos})
                           returning folio`;
      expect(b!.folio).not.toBe('BIT-0001');
      expect(b!.folio).toMatch(/^BIT-\d{4}$/);
    }));

  it('autor, fecha de creación, empresa y folio no se cambian después', () =>
    enTransaccionRevertida(base, async (tx) => {
      await comoServidor(tx, USERS.carlos);
      const [p] = await tx`select id from punch_list where obra_id = ${OBRAS.a1Carlos}`;
      const id = p!.id as string;
      expect(
        await errorDe(tx, (t) => t`update punch_list set creado_por = ${MIEMBROS.duenoA} where id = ${id}`),
      ).toMatch(/no se puede cambiar|El PM no puede cambiar/);
      expect(await errorDe(tx, (t) => t`update punch_list set folio = 'PUN-0099' where id = ${id}`)).toMatch(
        /no se puede cambiar|El PM no puede cambiar/,
      );
      expect(
        await errorDe(tx, (t) => t`update punch_list set creado_en = '2020-01-01' where id = ${id}`),
      ).toMatch(/no se puede cambiar|El PM no puede cambiar/);
      // lo que sí le toca: cerrarlo
      expect(
        await errorDe(
          tx,
          (t) => t`update punch_list set estado = 'cerrado', cerrado_en = now() where id = ${id}`,
        ),
      ).toBeNull();
    }));

  it('el PM no mueve un punch a la obra de otro, ni con un update sin filtro', () =>
    enTransaccionRevertida(base, async (tx) => {
      await comoServidor(tx, USERS.carlos);
      expect(await errorDe(tx, (t) => t`update punch_list set obra_id = ${OBRAS.a2Luis}`)).toMatch(
        /no puede cambiar obra_id|row-level security/,
      );
    }));

  it('el PM aprueba una orden de trabajo, pero no la lleva a "pagada" ni toca su precio', () =>
    enTransaccionRevertida(base, async (tx) => {
      await comoServidor(tx, USERS.carlos);
      const [ot] =
        await tx`select id from ordenes_trabajo where obra_id = ${OBRAS.a1Carlos} and estado = 'emitida'`;
      const id = ot!.id as string;
      expect(
        await errorDe(tx, (t) => t`update ordenes_trabajo set estado = 'aprobada' where id = ${id}`),
      ).toBeNull();
      expect(
        await errorDe(tx, (t) => t`update ordenes_trabajo set estado = 'pagada' where id = ${id}`),
      ).toMatch(/row-level security/);
      const r =
        await tx`update ordenes_trabajo_precios set precio = 99999 where orden_trabajo_id = ${id} returning 1`;
      expect(r.length).toBe(0);
    }));

  it('el PM no cambia el estado de su obra ni registra compras de la oficina', () =>
    enTransaccionRevertida(base, async (tx) => {
      await comoServidor(tx, USERS.carlos);
      expect(
        (await tx`update obras set estado = 'entregada' where id = ${OBRAS.a1Carlos} returning 1`).length,
      ).toBe(0);
      const [esp] = await tx`select id from espacios where obra_id = ${OBRAS.a1Carlos} limit 1`;
      expect(
        await errorDe(
          tx,
          (
            t,
          ) => t`insert into gastos (empresa_id, obra_id, espacio_id, dia, proveedor, monto, metodo_pago, origen,
                                       creado_por)
                   values (${EMPRESAS.a}, ${OBRAS.a1Carlos}, ${esp!.id}, '2026-10-09', 'Lowes', 5000, 'tarjeta_empresa',
                           'oficina', ${MIEMBROS.carlos})`,
        ),
      ).toMatch(/row-level security/);
    }));

  it('una foto vive en la carpeta de su empresa y obra, y apunta a un registro de esa obra', () =>
    enTransaccionRevertida(base, async (tx) => {
      const [b] = await tx`select id from bitacora where obra_id = ${OBRAS.a1Carlos}`;
      const [deB] = await tx`select id from gastos where empresa_id = ${EMPRESAS.b} limit 1`;
      await comoServidor(tx, USERS.carlos);
      const foto = (ruta: string, tipo: string, ref: string) => (t: Tx) =>
        t`insert into fotos (empresa_id, obra_id, ref_tipo, ref_id, indice, storage_path, creado_por)
          values (${EMPRESAS.a}, ${OBRAS.a1Carlos}, ${tipo}, ${ref}, 7, ${ruta}, ${MIEMBROS.carlos})`;
      const propia = `${EMPRESAS.a}/${OBRAS.a1Carlos}/bitacora/x-7.jpg`;
      expect(
        await errorDe(tx, foto(`${EMPRESAS.b}/${OBRAS.b1}/bitacora/x-7.jpg`, 'bitacora', b!.id)),
      ).toMatch(/ruta/);
      expect(
        await errorDe(tx, foto(`${EMPRESAS.a}/${OBRAS.a1Carlos}/../x-7.jpg`, 'bitacora', b!.id)),
      ).toMatch(/ruta/);
      expect(await errorDe(tx, foto(propia, 'gasto', deB!.id))).toMatch(
        /no corresponde a un registro de su obra/,
      );
      expect(await errorDe(tx, foto(propia, 'bitacora', b!.id))).toBeNull();
    }));

  it('el dueño de A, por el servidor, no crea ni edita nada en B, ni se lleva una obra a B', () =>
    enTransaccionRevertida(base, async (tx) => {
      await comoServidor(tx, USERS.duenoA);
      expect(
        await errorDe(
          tx,
          (t) =>
            t`insert into trabajadores (empresa_id, nombre, tipo_pago) values (${EMPRESAS.b}, 'Intruso', 'hora')`,
        ),
      ).toMatch(/row-level security/);
      expect(
        (await tx`update obras set cliente = 'Cambiado' where id = ${OBRAS.b1} returning 1`).length,
      ).toBe(0);
      expect(
        await errorDe(tx, (t) => t`update obras set empresa_id = ${EMPRESAS.b} where id = ${OBRAS.a1Carlos}`),
      ).toMatch(/no se puede cambiar/);
    }));

  it('nadie borra, ni siquiera el servidor', () =>
    enTransaccionRevertida(base, async (tx) => {
      await comoServidor(tx, USERS.duenoA);
      expect(await errorDe(tx, (t) => t`delete from cobros where empresa_id = ${EMPRESAS.a}`)).toMatch(
        /permission denied/,
      );
    }));
});

describe('las fotos en Storage', () => {
  const marca = Date.now();
  const ruta = (empresa: string, obra: string, ext = 'jpg') => `${empresa}/${obra}/prueba/${marca}.${ext}`;
  const subidas: string[] = [];
  const foto = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });

  async function subir(u: Usuario, path: string, archivo: Blob = foto) {
    const { error } = await como(u).storage.from('fotos').upload(path, archivo);
    if (!error) subidas.push(path);
    return error;
  }

  afterAll(async () => {
    if (subidas.length) await clienteServicio().storage.from('fotos').remove(subidas);
  });

  it('el PM sube una foto a su obra', async () => {
    expect(await subir('pm1A', ruta(EMPRESAS.a, OBRAS.a1Carlos))).toBeNull();
  });

  it('nadie la lee ni la firma directo: los enlaces los da el servidor, de pocos minutos', async () => {
    const p = ruta(EMPRESAS.a, OBRAS.a1Carlos);
    for (const u of ['pm1A', 'duenoA'] as const) {
      expect((await como(u).storage.from('fotos').download(p)).error, u).not.toBeNull();
      expect((await como(u).storage.from('fotos').createSignedUrl(p, 31536000)).error, u).not.toBeNull();
    }
  });

  it('el PM no sube fotos a la obra de otro PM, a una entregada ni a otra empresa', async () => {
    expect(await subir('pm1A', ruta(EMPRESAS.a, OBRAS.a2Luis))).not.toBeNull();
    expect(await subir('pm1A', ruta(EMPRESAS.a, OBRAS.a3CarlosEntregada))).not.toBeNull();
    expect(await subir('pm1A', ruta(EMPRESAS.b, OBRAS.b1))).not.toBeNull();
  });

  it('el dueño de A no sube a la carpeta de B', async () => {
    expect(await subir('duenoA', ruta(EMPRESAS.b, OBRAS.b1, 'png'))).not.toBeNull();
  });

  it('una foto subida no se reemplaza ni se borra', async () => {
    const p = ruta(EMPRESAS.a, OBRAS.a1Carlos);
    expect((await como('pm1A').storage.from('fotos').upload(p, foto, { upsert: true })).error).not.toBeNull();
    await como('pm1A').storage.from('fotos').remove([p]);
    expect((await clienteServicio().storage.from('fotos').download(p)).error).toBeNull();
  });

  it('solo imágenes y PDF', async () => {
    const html = new Blob(['<b>hola</b>'], { type: 'text/html' });
    expect(await subir('pm1A', ruta(EMPRESAS.a, OBRAS.a1Carlos, 'html'), html)).not.toBeNull();
  });
});
