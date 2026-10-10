// Las conexiones del servidor: la base (como ijm_servidor, D-026) y la API de Auth (con la llave secreta, D-027).
// Una por proceso. Las variables vienen de Vercel o de apps/web/.env.local; nunca del repositorio.
import 'server-only';
import { authAdmin, conectarServidor, type AuthAdmin, type FirmarEnlace, type Servidor } from '@ijm/servidor';
import { createClient } from '@supabase/supabase-js';

function variable(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable de entorno ${nombre} (ver .env.example)`);
  return v;
}

const global = globalThis as unknown as { ijmServidor?: Servidor; ijmAuth?: AuthAdmin };

export function servidor(): Servidor {
  global.ijmServidor ??= conectarServidor(variable('SERVIDOR_DATABASE_URL'), 5);
  return global.ijmServidor;
}

export function auth(): AuthAdmin {
  global.ijmAuth ??= authAdmin(variable('NEXT_PUBLIC_SUPABASE_URL'), variable('SUPABASE_SECRET_KEY'));
  return global.ijmAuth;
}

/**
 * Firma un enlace de pocos minutos a una foto de Storage (D-026). La llave secreta se usa solo para esto, y solo
 * después de que enlaceDeFoto revisó, con la identidad del usuario, que puede ver esa foto.
 */
export const firmarFoto: FirmarEnlace = async (ruta, segundos) => {
  const storage = createClient(variable('NEXT_PUBLIC_SUPABASE_URL'), variable('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage;
  const { data, error } = await storage.from('fotos').createSignedUrl(ruta, segundos);
  if (error || !data) throw new Error(`Storage: ${error?.message ?? 'sin enlace'}`);
  return data.signedUrl;
};

export const SUPABASE_URL = () => variable('NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_LLAVE_PUBLICA = () => variable('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
