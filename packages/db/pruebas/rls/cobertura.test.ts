// Una tabla sin RLS es una puerta abierta: esta prueba recorre el esquema y falla si alguna tabla no lo tiene.
// Las pruebas de la muralla financiera, con usuarios reales de Supabase Auth, llegan en el paso 4.
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { conexionDePrueba } from '../conexion';

const { db, cliente } = conexionDePrueba();
afterAll(() => cliente.end());

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
