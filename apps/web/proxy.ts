// En cada petición: renueva la sesión de Supabase Auth si su token venció, y la deja en las cookies de la
// respuesta. No decide quién entra: eso lo revisa cada página con el celular y el PIN (lib/acceso.ts).
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const OPCIONES_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
} as const;

export async function proxy(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !llave) return respuesta;
  const supabase = createServerClient(url, llave, {
    cookieOptions: OPCIONES_COOKIE,
    cookies: {
      getAll: () => peticion.cookies.getAll(),
      setAll(lista) {
        for (const { name, value } of lista) peticion.cookies.set(name, value);
        respuesta = NextResponse.next({ request: peticion });
        for (const { name, value, options } of lista)
          respuesta.cookies.set(name, value, { ...options, ...OPCIONES_COOKIE });
      },
    },
  });
  await supabase.auth.getClaims();
  return respuesta;
}

export const config = {
  // todo, menos los archivos de Next, los íconos, el manifiesto y el service worker
  matcher: ['/((?!_next/|iconos/|icon|apple-icon|manifest.webmanifest|sw.js).*)'],
};
