// Paso 4: la muralla financiera y el aislamiento entre empresas, con usuarios reales de Supabase Auth que leen y
// escriben por la API, como lo hará la app. supabase/seed.sql deja renglones en TODAS las tablas de las dos
// empresas: si un PM ve cero renglones, es porque RLS se los oculta, no porque la tabla esté vacía.
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conexionDePrueba } from '../conexion';
import { clienteAnonimo, clienteServicio, EMPRESAS, entrarComo, OBRAS, USUARIOS } from '../usuarios';

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
      ['empresa_id', 'horas_sin_recibo', 'limite_compra_pm', 'sla_bloqueo_horas'].sort(),
    );
    expect((await leer(como('pm1A'), 'entregas_pm')).map((e) => e.obra_id)).toEqual([OBRAS.a1Carlos]);
    expect((await leer(como('pm1A'), 'subcontratistas_pm')).every((s) => s.empresa_id === EMPRESAS.a)).toBe(
      true,
    );
  });

  it('miembros y dispositivos: solo los suyos', async () => {
    expect((await leer(como('pm1A'), 'miembros')).map((m) => m.nombre)).toEqual(['Carlos Méndez']);
    expect((await leer(como('pm1A'), 'dispositivos')).map((d) => d.nombre)).toEqual([
      'Celular de Carlos Méndez',
    ]);
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

describe('nadie modifica lo que no le corresponde', () => {
  const estadoObra = async (id: string) => (await base`select estado from obras where id = ${id}`)[0]!.estado;

  it('el PM no cambia el estado de su obra', async () => {
    await como('pm1A').from('obras').update({ estado: 'entregada' }).eq('id', OBRAS.a1Carlos);
    expect(await estadoObra(OBRAS.a1Carlos)).toBe('en_obra');
  });

  it('el PM no cambia el precio ni el estado de una orden de trabajo', async () => {
    const [ot] =
      await base`select id from ordenes_trabajo where obra_id = ${OBRAS.a1Carlos} and estado = 'emitida'`;
    await como('pm1A')
      .from('ordenes_trabajo_precios')
      .update({ precio: 99999 })
      .eq('orden_trabajo_id', ot!.id);
    await como('pm1A').from('ordenes_trabajo').update({ estado: 'pagada' }).eq('id', ot!.id);
    const [d] = await base`select o.estado, p.precio from ordenes_trabajo o
                           join ordenes_trabajo_precios p on p.orden_trabajo_id = o.id where o.id = ${ot!.id}`;
    expect(d).toEqual({ estado: 'emitida', precio: '2000.00' });
  });

  it('el PM no cierra el día en la obra de otro PM, ni a nombre de otro', async () => {
    const pm = como('pm1A');
    const otraObra = await pm.from('bitacora').insert({
      empresa_id: EMPRESAS.a, folio: 'BIT-9001', obra_id: OBRAS.a2Luis, dia: '2026-10-09',
      creado_por: 'a1000000-0000-4000-8000-000000000002',
    }); // prettier-ignore
    expect(otraObra.error?.message).toMatch(/row-level security/);
    const aNombreDeOtro = await pm.from('bitacora').insert({
      empresa_id: EMPRESAS.a, folio: 'BIT-9002', obra_id: OBRAS.a1Carlos, dia: '2026-10-09',
      creado_por: 'a1000000-0000-4000-8000-000000000003',
    }); // prettier-ignore
    expect(aNombreDeOtro.error?.message).toMatch(/row-level security/);
  });

  it('el PM sí cierra el día de su obra, a su nombre', async () => {
    const { error } = await como('pm1A').from('bitacora').insert({
      empresa_id: EMPRESAS.a, folio: 'BIT-9003', obra_id: OBRAS.a1Carlos, dia: '2026-10-09',
      creado_por: 'a1000000-0000-4000-8000-000000000002',
    }); // prettier-ignore
    try {
      expect(error).toBeNull();
    } finally {
      await base`delete from bitacora where folio = 'BIT-9003' and empresa_id = ${EMPRESAS.a}`;
    }
  });

  it('el PM no registra una compra como si fuera de la oficina', async () => {
    const [esp] = await base`select id from espacios where obra_id = ${OBRAS.a1Carlos} limit 1`;
    const { error } = await como('pm1A').from('gastos').insert({
      empresa_id: EMPRESAS.a, folio: 'GTO-9001', obra_id: OBRAS.a1Carlos, espacio_id: esp!.id, dia: '2026-10-09',
      proveedor: 'Lowe’s', monto: 5000, metodo_pago: 'tarjeta_empresa', origen: 'oficina',
      creado_por: 'a1000000-0000-4000-8000-000000000002',
    }); // prettier-ignore
    expect(error?.message).toMatch(/row-level security/);
  });

  it('nadie borra: ni el PM su propio cierre, ni el dueño un cobro', async () => {
    const antes = Number((await base`select count(*) from bitacora`)[0]!.count);
    const cobros = Number((await base`select count(*) from cobros`)[0]!.count);
    const pm = await como('pm1A').from('bitacora').delete().eq('obra_id', OBRAS.a1Carlos);
    const dueno = await como('duenoA').from('cobros').delete().eq('empresa_id', EMPRESAS.a);
    expect(pm.error?.message).toMatch(/permission denied/);
    expect(dueno.error?.message).toMatch(/permission denied/);
    expect(Number((await base`select count(*) from bitacora`)[0]!.count)).toBe(antes);
    expect(Number((await base`select count(*) from cobros`)[0]!.count)).toBe(cobros);
  });

  it('el dueño de A no crea ni edita nada en la empresa B', async () => {
    const crear = await como('duenoA').from('trabajadores').insert({
      empresa_id: EMPRESAS.b,
      nombre: 'Intruso',
      tipo_pago: 'hora',
    });
    expect(crear.error?.message).toMatch(/row-level security/);
    await como('duenoA').from('obras').update({ cliente: 'Cambiado por A' }).eq('id', OBRAS.b1);
    expect((await base`select cliente from obras where id = ${OBRAS.b1}`)[0]!.cliente).toBe('Familia Pérez');
  });

  it('el dueño no se pasa su obra a la otra empresa', async () => {
    await como('duenoA').from('obras').update({ empresa_id: EMPRESAS.b }).eq('id', OBRAS.a1Carlos);
    expect((await base`select empresa_id from obras where id = ${OBRAS.a1Carlos}`)[0]!.empresa_id).toBe(
      EMPRESAS.a,
    );
  });
});

describe('las fotos en Storage', () => {
  const marca = Date.now();
  const ruta = (empresa: string, obra: string) => `${empresa}/${obra}/prueba/${marca}.jpg`;
  const subidas: string[] = [];
  const foto = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });

  async function subir(u: Usuario, path: string) {
    const { error } = await como(u).storage.from('fotos').upload(path, foto);
    if (!error) subidas.push(path);
    return error;
  }
  const bajar = async (u: Usuario, path: string) =>
    (await como(u).storage.from('fotos').download(path)).error;

  afterAll(async () => {
    if (subidas.length) await clienteServicio().storage.from('fotos').remove(subidas);
  });

  it('el PM sube una foto a su obra y la puede ver', async () => {
    const p = ruta(EMPRESAS.a, OBRAS.a1Carlos);
    expect(await subir('pm1A', p)).toBeNull();
    expect(await bajar('pm1A', p)).toBeNull();
  });

  it('el PM no sube fotos a la obra de otro PM ni de otra empresa', async () => {
    expect(await subir('pm1A', ruta(EMPRESAS.a, OBRAS.a2Luis))).not.toBeNull();
    expect(await subir('pm1A', ruta(EMPRESAS.b, OBRAS.b1))).not.toBeNull();
  });

  it('el PM no ve las fotos de la obra de otro PM ni de otra empresa', async () => {
    const deLuis = ruta(EMPRESAS.a, OBRAS.a2Luis);
    const deB = ruta(EMPRESAS.b, OBRAS.b1);
    expect(await subir('pm2A', deLuis)).toBeNull();
    expect(await subir('pm1B', deB)).toBeNull();
    expect(await bajar('pm1A', deLuis)).not.toBeNull();
    expect(await bajar('pm1A', deB)).not.toBeNull();
  });

  it('el dueño ve las fotos de su empresa, no las de otra', async () => {
    expect(await bajar('duenoA', ruta(EMPRESAS.a, OBRAS.a2Luis))).toBeNull();
    expect(await bajar('duenoA', ruta(EMPRESAS.b, OBRAS.b1))).not.toBeNull();
  });

  it('una foto subida no se reemplaza', async () => {
    const p = ruta(EMPRESAS.a, OBRAS.a1Carlos);
    const { error } = await como('pm1A').storage.from('fotos').upload(p, foto, { upsert: true });
    expect(error).not.toBeNull();
  });
});
