// El idioma y los mensajes de cada petición (next-intl, sin el idioma en la dirección: la PWA abre siempre en "/").
import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { COOKIE_IDIOMA, elegirIdioma } from './idioma';

export default getRequestConfig(async () => {
  const idioma = elegirIdioma(
    (await cookies()).get(COOKIE_IDIOMA)?.value,
    (await headers()).get('accept-language'),
  );
  return {
    locale: idioma,
    messages: (await import(`../mensajes/${idioma}.json`)).default,
    // la zona de la empresa piloto; desde el paso 2, la de la empresa del usuario (regla 5)
    timeZone: 'America/Chicago',
  };
});
