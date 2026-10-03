// El esquema de Drizzle se genera desde las migraciones (`pnpm db:esquema`). Si alguien cambia una migración y
// olvida regenerarlo, esta prueba falla: el código tipado y la base no pueden decir cosas distintas.
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { afterAll, describe, expect, it } from 'vitest';
import * as esquema from '../../src/esquema/index';
import { conexionDePrueba } from '../conexion';

const { cliente } = conexionDePrueba();
afterAll(() => cliente.end());

const tablasDrizzle = (Object.values(esquema) as unknown[])
  .filter((x): x is PgTable => x instanceof PgTable)
  .map((t) => getTableConfig(t));

describe('el esquema de Drizzle corresponde a la base', () => {
  it('tiene las mismas tablas', async () => {
    const r = await cliente<{ tabla: string }[]>`
      select table_name as tabla from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'`;
    expect(tablasDrizzle.map((t) => t.name).sort()).toEqual(r.map((t) => t.tabla).sort());
  });

  it('cada tabla tiene las mismas columnas, con los mismos nulos', async () => {
    const r = await cliente<{ tabla: string; columna: string; nulo: string }[]>`
      select table_name as tabla, column_name as columna, is_nullable as nulo
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name in (select table_name from information_schema.tables
                             where table_schema = 'public' and table_type = 'BASE TABLE')`;
    const enBase = r.map((c) => `${c.tabla}.${c.columna}${c.nulo === 'NO' ? ' not null' : ''}`).sort();
    const enDrizzle = tablasDrizzle
      .flatMap((t) => t.columns.map((c) => `${t.name}.${c.name}${c.notNull ? ' not null' : ''}`))
      .sort();
    expect(enDrizzle).toEqual(enBase);
  });
});
