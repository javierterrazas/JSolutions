// Paso 3: cada usuario de prueba entra con Supabase Auth y las funciones de apoyo de las políticas devuelven su
// empresa, su rol y sus obras. Con sesiones reales y consultas por la API, como lo hará la app.
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conexionDePrueba } from '../conexion';
import { clienteAnonimo, EMPRESAS, entrarComo, OBRAS, USUARIOS } from '../usuarios';

const { cliente: base } = conexionDePrueba();
afterAll(() => base.end());

async function rpc(c: SupabaseClient, fn: string, args?: Record<string, unknown>) {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as unknown;
}

const quienSoy = async (c: SupabaseClient) => ({
  empresa: await rpc(c, 'empresa_actual'),
  rol: await rpc(c, 'rol_actual'),
  duenoOAdmin: await rpc(c, 'es_dueno_o_admin'),
});

const sesiones: Partial<Record<keyof typeof USUARIOS, SupabaseClient>> = {};
const como = (u: keyof typeof USUARIOS) => sesiones[u]!;

beforeAll(async () => {
  for (const u of Object.keys(USUARIOS) as (keyof typeof USUARIOS)[])
    sesiones[u] = await entrarComo(USUARIOS[u]);
});

describe('cada usuario de prueba entra y sabe quién es', () => {
  it('el dueño de A: empresa A, rol dueño, ve el negocio', async () => {
    expect(await quienSoy(como('duenoA'))).toEqual({ empresa: EMPRESAS.a, rol: 'dueno', duenoOAdmin: true });
  });

  it.each(['pm1A', 'pm2A'] as const)('%s: empresa A, rol PM, no ve el negocio', async (u) => {
    expect(await quienSoy(como(u))).toEqual({ empresa: EMPRESAS.a, rol: 'pm', duenoOAdmin: false });
  });

  it('la dueña de B: empresa B, rol dueño', async () => {
    expect(await quienSoy(como('duenoB'))).toEqual({ empresa: EMPRESAS.b, rol: 'dueno', duenoOAdmin: true });
  });

  it.each(['pm1B', 'pm2B'] as const)('%s: empresa B, rol PM', async (u) => {
    expect(await quienSoy(como(u))).toEqual({ empresa: EMPRESAS.b, rol: 'pm', duenoOAdmin: false });
  });

  it('el miembro de baja tiene cuenta en Auth, pero no es nadie en ninguna empresa', async () => {
    expect(await quienSoy(como('bajaA'))).toEqual({ empresa: null, rol: null, duenoOAdmin: false });
  });

  it('un usuario de Auth que no pertenece a ninguna empresa no es nadie', async () => {
    expect(await quienSoy(como('sinEmpresa'))).toEqual({ empresa: null, rol: null, duenoOAdmin: false });
  });

  it('sin sesión ni siquiera se puede preguntar', async () => {
    const { error } = await clienteAnonimo().rpc('empresa_actual');
    expect(error?.message).toMatch(/permission denied/);
  });
});

describe('las obras del PM', () => {
  const esPmDe = (u: keyof typeof USUARIOS, obra: string) => rpc(como(u), 'es_pm_de', { p_obra: obra });

  it('Carlos es PM de su obra en curso', async () => {
    expect(await esPmDe('pm1A', OBRAS.a1Carlos)).toBe(true);
  });

  it('Carlos no es PM de la obra de Luis', async () => {
    expect(await esPmDe('pm1A', OBRAS.a2Luis)).toBe(false);
  });

  it('Carlos deja de ver su obra cuando se entrega', async () => {
    expect(await esPmDe('pm1A', OBRAS.a3CarlosEntregada)).toBe(false);
  });

  it('un PM de otra empresa no es PM de las obras de A', async () => {
    expect(await esPmDe('pm1B', OBRAS.a1Carlos)).toBe(false);
    expect(await esPmDe('pm1B', OBRAS.b1)).toBe(true);
  });

  it('el dueño no es "PM de" ninguna obra: su acceso sale de su rol', async () => {
    expect(await esPmDe('duenoA', OBRAS.a1Carlos)).toBe(false);
  });
});

describe('el acceso se corta en ese instante', () => {
  it('dar de baja a un PM le quita su rol aunque su sesión siga abierta', async () => {
    const pm = como('pm2A');
    expect(await rpc(pm, 'rol_actual')).toBe('pm');
    await base`update miembros set activo = false where user_id = 'a0000000-0000-4000-8000-000000000003'`;
    try {
      expect(await quienSoy(pm)).toEqual({ empresa: null, rol: null, duenoOAdmin: false });
      expect(await rpc(pm, 'es_pm_de', { p_obra: OBRAS.a2Luis })).toBe(false);
    } finally {
      await base`update miembros set activo = true where user_id = 'a0000000-0000-4000-8000-000000000003'`;
    }
    expect(await rpc(pm, 'rol_actual')).toBe('pm');
  });

  it('desactivar una empresa deja fuera a todos sus miembros', async () => {
    await base`update empresas set activa = false where id = ${EMPRESAS.b}`;
    try {
      expect(await rpc(como('duenoB'), 'empresa_actual')).toBeNull();
      expect(await rpc(como('pm1B'), 'es_pm_de', { p_obra: OBRAS.b1 })).toBe(false);
      // la otra empresa no se entera
      expect(await rpc(como('duenoA'), 'empresa_actual')).toBe(EMPRESAS.a);
    } finally {
      await base`update empresas set activa = true where id = ${EMPRESAS.b}`;
    }
  });
});

describe('el rol admin', () => {
  it('ve lo mismo que el dueño, dinero incluido (por ahora: decisión pendiente 5 del plan)', async () => {
    const duena = como('duenoB');
    await base`update miembros set rol = 'admin' where user_id = 'b0000000-0000-4000-8000-000000000001'`;
    try {
      expect(await quienSoy(duena)).toEqual({ empresa: EMPRESAS.b, rol: 'admin', duenoOAdmin: true });
      const { data } = await duena.from('cobros').select('empresa_id');
      expect(data?.length).toBeGreaterThan(0);
      expect(data?.every((c) => c.empresa_id === EMPRESAS.b)).toBe(true);
    } finally {
      await base`update miembros set rol = 'dueno' where user_id = 'b0000000-0000-4000-8000-000000000001'`;
    }
  });
});
