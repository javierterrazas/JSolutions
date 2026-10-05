// Cambiar de idioma con un toque. Son formularios, así que funcionan aunque el JavaScript no haya cargado.
import { getLocale, getTranslations } from 'next-intl/server';
import { IDIOMAS } from '@/i18n/idioma';
import { cambiarIdioma } from './acciones/idioma';

export async function SelectorDeIdioma() {
  const [t, actual] = await Promise.all([getTranslations('idioma'), getLocale()]);
  return (
    <nav aria-label={t('etiqueta')} className="flex gap-2">
      {IDIOMAS.map((idioma) => (
        <form key={idioma} action={cambiarIdioma.bind(null, idioma)}>
          <button
            type="submit"
            lang={idioma}
            aria-pressed={idioma === actual}
            className="min-h-11 rounded-full border border-marca/30 px-4 text-sm font-medium text-marca aria-pressed:bg-marca aria-pressed:text-white"
          >
            {t(idioma)}
          </button>
        </form>
      ))}
    </nav>
  );
}
