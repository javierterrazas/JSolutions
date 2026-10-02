import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { conexionDePrueba } from '../conexion';

const { db, cliente } = conexionDePrueba();
afterAll(() => cliente.end());

describe('la base local', () => {
  it('responde', async () => {
    const r = await db.execute<{ uno: number }>(sql`select 1 as uno`);
    expect(r[0]?.uno).toBe(1);
  });

  it('es PostgreSQL 15 o más reciente', async () => {
    const r = await db.execute<{ v: string }>(sql`select current_setting('server_version_num') as v`);
    expect(Number(r[0]?.v)).toBeGreaterThanOrEqual(150000);
  });
});
