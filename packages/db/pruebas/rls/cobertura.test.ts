// Lo que ninguna migración puede olvidar: RLS en cada tabla, y permisos cerrados para lo que existe y para lo que
// se cree después (revisión del paso 4, D-026). Recorre el esquema completo, así que también vigila las
// migraciones futuras.
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { conexionDePrueba } from '../conexion';
import { enTransaccionRevertida } from '../datos';

const { db, cliente } = conexionDePrueba();
afterAll(() => cliente.end());

// Las vistas del PM (D-013). Cada vista nueva se revisa a mano y se agrega aquí con su prueba en muralla.test.ts.
const VISTAS_APROBADAS = [
  'configuracion_pm',
  'empresa_actual_datos',
  'entregas_pm',
  'ordenes_cambio_pm',
  'subcontratistas_pm',
];

describe('cobertura de RLS', () => {
  it('es una base de Supabase: existen el esquema auth y los roles anon y authenticated', async () => {
    const r = await db.execute<{ auth: boolean; roles: number }>(sql`
      select to_regnamespace('auth') is not null as auth,
             (select count(*)::int from pg_roles where rolname in ('anon', 'authenticated')) as roles`);
    expect(r[0]).toEqual({ auth: true, roles: 2 });
  });

  it('toda tabla del esquema public tiene RLS activado', async () => {
    const sinRls = await db.execute<{ tabla: string }>(sql`
      select c.relname as tabla
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
        and not c.relrowsecurity
      order by 1`);
    expect(sinRls.map((t) => t.tabla)).toEqual([]);
  });
});

describe('permisos de lo que ya existe', () => {
  it('por la API nadie escribe, borra ni vacía una tabla; el servidor escribe pero nunca borra', async () => {
    const r = await cliente<{ permiso: string }[]>`
      select r.rolname || ' ' || p.privilege || ' ' || c.relname as permiso
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      cross join (values ('anon'), ('authenticated'), ('servidor_app')) as r(rolname)
      cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN'))
        as p(privilege)
      where n.nspname = 'public' and c.relkind = 'r'
        and has_table_privilege(r.rolname, c.oid, p.privilege)
        and not (r.rolname = 'servidor_app' and p.privilege in ('INSERT', 'UPDATE'))
      order by 1`;
    expect(r.map((x) => x.permiso)).toEqual([]);
  });

  it('sin sesión no se lee ninguna tabla ni vista', async () => {
    const r = await cliente<{ objeto: string }[]>`
      select c.relname as objeto from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'v', 'm') and has_table_privilege('anon', c.oid, 'SELECT')`;
    expect(r.map((x) => x.objeto)).toEqual([]);
  });

  it('ninguna función de public se puede llamar sin sesión (salvo disparadores, que no se llaman por la API)', async () => {
    const r = await cliente<{ funcion: string }[]>`
      select p.proname as funcion from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype
        and has_function_privilege('anon', p.oid, 'EXECUTE')`;
    expect(r.map((x) => x.funcion)).toEqual([]);
  });

  it('solo existen las vistas aprobadas, y todas con security_barrier', async () => {
    const r = await cliente<{ vista: string; barrera: boolean }[]>`
      select c.relname as vista,
             coalesce('security_barrier=true' = any(c.reloptions), false)
               or coalesce('security_invoker=true' = any(c.reloptions), false) as barrera
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('v', 'm') order by 1`;
    expect(r.map((v) => v.vista)).toEqual(VISTAS_APROBADAS);
    expect(r.filter((v) => !v.barrera)).toEqual([]);
  });
});

describe('lo que se cree después nace cerrado', () => {
  it('una función, una vista, una secuencia y una tabla nuevas no quedan abiertas para la API', () =>
    enTransaccionRevertida(cliente, async (tx) => {
      await tx`create function public.prueba_nueva() returns int language sql as 'select 1'`;
      await tx`create view public.prueba_vista as select 1 as uno`;
      await tx`create sequence public.prueba_secuencia`;
      await tx`create table public.prueba_tabla (id int)`;
      const [r] = await tx`
        select has_function_privilege('anon', 'public.prueba_nueva()', 'EXECUTE') as fn_anon,
               has_function_privilege('authenticated', 'public.prueba_nueva()', 'EXECUTE') as fn_auth,
               has_table_privilege('anon', 'public.prueba_vista', 'SELECT') as vista_anon,
               has_table_privilege('authenticated', 'public.prueba_vista', 'UPDATE') as vista_editable,
               has_sequence_privilege('anon', 'public.prueba_secuencia', 'USAGE') as secuencia_anon,
               has_table_privilege('authenticated', 'public.prueba_tabla', 'INSERT') as tabla_insert,
               has_table_privilege('authenticated', 'public.prueba_tabla', 'DELETE') as tabla_delete`;
      expect(r).toEqual({
        fn_anon: false,
        fn_auth: false,
        vista_anon: false,
        vista_editable: false,
        secuencia_anon: false,
        tabla_insert: false,
        tabla_delete: false,
      });
    }));
});
