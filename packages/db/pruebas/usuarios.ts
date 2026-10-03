// Los usuarios de prueba de supabase/seed.sql, y una sesión real de Supabase Auth para cada uno.
// Las pruebas de roles y de RLS entran como lo hará la app: correo y contraseña contra Auth, y consultas por la
// API con el token de esa sesión. Nada se simula.
import { execSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const CONTRASENA_DE_PRUEBA = 'ijm-prueba-2026';

export const USUARIOS = {
  duenoA: 'dueno@empresa-a.test',
  pm1A: 'pm1@empresa-a.test',
  pm2A: 'pm2@empresa-a.test',
  bajaA: 'baja@empresa-a.test',
  duenoB: 'dueno@empresa-b.test',
  pm1B: 'pm1@empresa-b.test',
  pm2B: 'pm2@empresa-b.test',
  sinEmpresa: 'sin-empresa@prueba.test',
} as const;

export const EMPRESAS = {
  a: 'e000000a-0000-4000-8000-000000000000',
  b: 'e000000b-0000-4000-8000-000000000000',
} as const;

export const OBRAS = {
  a1Carlos: 'a2000000-0000-4000-8000-000000000001',
  a2Luis: 'a2000000-0000-4000-8000-000000000002',
  a3CarlosEntregada: 'a2000000-0000-4000-8000-000000000003',
  b1: 'b2000000-0000-4000-8000-000000000001',
} as const;

interface Api {
  url: string;
  anonKey: string;
  serviceKey: string;
}

let api: Api | undefined;

/** La dirección y la llave pública de la API local: de las variables de entorno o de `supabase status`. */
function apiLocal(): Api {
  if (api) return api;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    api = {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    return api;
  }
  const salida = execSync('pnpm exec supabase status -o env', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const valor = (nombre: string) => {
    const m = salida.match(new RegExp(`^${nombre}="?([^"\\r\\n]*)"?`, 'm'));
    if (!m?.[1]) throw new Error(`supabase status no dio ${nombre}: ¿corre la base local (pnpm db:start)?`);
    return m[1];
  };
  api = { url: valor('API_URL'), anonKey: valor('ANON_KEY'), serviceKey: valor('SERVICE_ROLE_KEY') };
  return api;
}

/** Un cliente sin sesión, como el de alguien que todavía no entra. */
export function clienteAnonimo(): SupabaseClient {
  const { url, anonKey } = apiLocal();
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Inicia sesión con un usuario de prueba y devuelve su cliente. */
export async function entrarComo(correo: string): Promise<SupabaseClient> {
  const cliente = clienteAnonimo();
  const { error } = await cliente.auth.signInWithPassword({ email: correo, password: CONTRASENA_DE_PRUEBA });
  if (error) throw new Error(`No pudo entrar ${correo}: ${error.message}`);
  return cliente;
}

/** El cliente de servicio, que se salta RLS. Solo para preparar o limpiar lo que una prueba deja; nunca para
 * comprobar lo que un usuario puede ver. */
export function clienteServicio(): SupabaseClient {
  const { url, serviceKey } = apiLocal();
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
