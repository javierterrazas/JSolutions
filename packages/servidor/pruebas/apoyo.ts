// Lo común de las pruebas de la capa del servidor: la conexión como ijm_servidor (la de supabase/seed.sql, solo
// local) y una transacción a nombre de un usuario que se revierte al terminar, para dejar la base como estaba.
import { execSync } from 'node:child_process';
import { ErrorDeNegocio } from '@ijm/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { authAdmin, conectarServidor, tomarIdentidad, type Tx } from '../src/index';

export const URL_SERVIDOR_LOCAL = 'postgresql://ijm_servidor:ijm-servidor-local@127.0.0.1:54322/postgres';
export const servidor = conectarServidor(process.env.SERVIDOR_DATABASE_URL ?? URL_SERVIDOR_LOCAL, 5);

/** Los usuarios de prueba de supabase/seed.sql (user_id de Auth) y sus miembros. */
export const USUARIOS = {
  duenoA: 'a0000000-0000-4000-8000-000000000001',
  carlos: 'a0000000-0000-4000-8000-000000000002',
  luis: 'a0000000-0000-4000-8000-000000000003',
  duenoB: 'b0000000-0000-4000-8000-000000000001',
} as const;
export const MIEMBROS = {
  duenoA: 'a1000000-0000-4000-8000-000000000001',
  carlos: 'a1000000-0000-4000-8000-000000000002',
  luis: 'a1000000-0000-4000-8000-000000000003',
} as const;
export const OBRAS = {
  a1Carlos: 'a2000000-0000-4000-8000-000000000001',
  a2Luis: 'a2000000-0000-4000-8000-000000000002',
  a3Entregada: 'a2000000-0000-4000-8000-000000000003',
} as const;
export const EMPRESA_A = 'e000000a-0000-4000-8000-000000000000';

/** Cambia la identidad dentro de la misma transacción (para un caso con dos usuarios). */
export const como = (tx: Tx, userId: string) => tomarIdentidad(tx, { userId });

const REVERTIR = new Error('revertir');

/** Corre `fn` a nombre del usuario y revierte todo al final, pase o falle. */
export async function probarComo(userId: string, fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await servidor.sql.begin(async (tx) => {
      await tomarIdentidad(tx, { userId });
      await fn(tx);
      throw REVERTIR;
    });
  } catch (e) {
    if (e !== REVERTIR) throw e;
  }
}

/** El código del error de negocio que lanza `fn`, o null si no falla. Un error que no es de negocio rompe la prueba. */
export async function codigo(tx: Tx, fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await tx.savepoint(async () => {
      await fn();
    });
    return null;
  } catch (e) {
    if (e instanceof ErrorDeNegocio) return e.codigo;
    throw e;
  }
}

/** Un instante en Austin: "2026-10-12", 10 → 10 am de ese día. */
export const enAustin = (dia: string, hora = 10) =>
  new Date(`${dia}T${String(hora).padStart(2, '0')}:00:00-05:00`);

// ------------------------------------------------------------------ Storage
let api: { url: string; anon: string; servicio: string } | undefined;
function apiLocal() {
  if (api) return api;
  const salida = execSync('pnpm exec supabase status -o env', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const v = (n: string) => salida.match(new RegExp(`^${n}="?([^"\\r\\n]*)"?`, 'm'))![1]!;
  api = { url: v('API_URL'), anon: v('ANON_KEY'), servicio: v('SERVICE_ROLE_KEY') };
  return api;
}
const opciones = { auth: { persistSession: false, autoRefreshToken: false } };

/** El cliente de un usuario de prueba, con su sesión: así sube fotos el teléfono. */
export async function clienteDe(correo: string): Promise<SupabaseClient> {
  const c = createClient(apiLocal().url, apiLocal().anon, opciones);
  const { error } = await c.auth.signInWithPassword({ email: correo, password: 'ijm-prueba-2026' });
  if (error) throw error;
  return c;
}

/** El service role: aquí solo para firmar enlaces y limpiar lo que suben las pruebas. */
export const clienteServicio = () => createClient(apiLocal().url, apiLocal().servicio, opciones);

/** La API de Auth local, con la misma implementación que usa la app. */
export const authLocal = () => authAdmin(apiLocal().url, apiLocal().servicio);

/**
 * Los usuarios de Auth que crean las pruebas no se revierten con la transacción: se borran al final los de un
 * dominio propio de las pruebas.
 */
export const DOMINIO_DE_PRUEBA = '@acceso.prueba.test';
export async function borrarUsuariosDePrueba(): Promise<void> {
  const admin = clienteServicio().auth.admin;
  const { data, error } = await admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  for (const u of data.users.filter((x) => x.email?.endsWith(DOMINIO_DE_PRUEBA)))
    await admin.deleteUser(u.id);
}
