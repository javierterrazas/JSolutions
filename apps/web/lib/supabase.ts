// La sesión de Supabase Auth del usuario, en cookies. Son httpOnly: el JavaScript de la página nunca ve los
// tokens; todo lo que lee o escribe pasa por el servidor.
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_LLAVE_PUBLICA, SUPABASE_URL } from './servidor';

export const OPCIONES_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
} as const;

export async function clienteSupabase() {
  const almacen = await cookies();
  return createServerClient(SUPABASE_URL(), SUPABASE_LLAVE_PUBLICA(), {
    cookieOptions: OPCIONES_COOKIE,
    cookies: {
      getAll: () => almacen.getAll(),
      setAll(lista) {
        try {
          for (const { name, value, options } of lista)
            almacen.set(name, value, { ...options, ...OPCIONES_COOKIE });
        } catch {
          // al mostrar una página no se pueden poner cookies; el proxy ya renovó la sesión
        }
      },
    },
  });
}

/** El usuario de la sesión, con su token verificado; o null. */
export async function usuarioDeLaSesion(): Promise<{ userId: string; sesionId: string | null } | null> {
  const { data } = await (await clienteSupabase()).auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  return { userId: c.sub, sesionId: typeof c.session_id === 'string' ? c.session_id : null };
}
