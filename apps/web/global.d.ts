// Los mensajes con tipos: una llave que no existe en es.json no compila.
import type { Idioma } from './i18n/idioma';
import type mensajes from './mensajes/es.json';

declare module 'next-intl' {
  interface AppConfig {
    Locale: Idioma;
    Messages: typeof mensajes;
  }
}
