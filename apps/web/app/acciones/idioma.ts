'use server';
// Cambiar el idioma de la app. Al poner la cookie, Next vuelve a mostrar la página ya en el idioma nuevo.
import { cookies } from 'next/headers';
import { COOKIE_IDIOMA, esIdioma } from '@/i18n/idioma';

const UN_ANO = 60 * 60 * 24 * 365;

export async function cambiarIdioma(idioma: string): Promise<void> {
  if (!esIdioma(idioma)) return;
  (await cookies()).set(COOKIE_IDIOMA, idioma, {
    maxAge: UN_ANO,
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });
  // paso 2: también se guarda en el miembro (miembros.idioma), para que lo siga en otro dispositivo
}
