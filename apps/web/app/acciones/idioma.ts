'use server';
// Cambiar el idioma de la app. Al poner la cookie, Next vuelve a mostrar la página ya en el idioma nuevo. Si hay un
// miembro con el celular abierto, se guarda también en él, para que lo siga en cualquier celular.
import { cambiarMiIdioma, enNombreDe, estadoDispositivo } from '@ijm/servidor';
import { cookies } from 'next/headers';
import { COOKIE_IDIOMA, esIdioma } from '@/i18n/idioma';
import { leerLlave } from '@/lib/acceso';
import { servidor } from '@/lib/servidor';
import { OPCIONES_COOKIE, usuarioDeLaSesion } from '@/lib/supabase';

const UN_ANO = 60 * 60 * 24 * 365;

export async function cambiarIdioma(idioma: string): Promise<void> {
  if (!esIdioma(idioma)) return;
  (await cookies()).set(COOKIE_IDIOMA, idioma, { ...OPCIONES_COOKIE, maxAge: UN_ANO });
  const sesion = await usuarioDeLaSesion();
  const llave = await leerLlave();
  if (!sesion || !llave) return;
  await enNombreDe(servidor(), { userId: sesion.userId }, async (tx) => {
    if ((await estadoDispositivo(tx, llave)) === 'abierto') await cambiarMiIdioma(tx, idioma);
  });
}
