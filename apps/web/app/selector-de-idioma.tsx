// Cambiar de idioma con un toque, arriba a la derecha de cada pantalla (D-070). Son formularios, así que funcionan
// aunque el JavaScript no haya cargado.
import { getLocale, getTranslations } from 'next-intl/server';
import { IDIOMAS } from '@/i18n/idioma';
import { cambiarIdioma } from './acciones/idioma';

export async function SelectorDeIdioma() {
  const [t, actual] = await Promise.all([getTranslations('idioma'), getLocale()]);
  return (
    <nav
      aria-label={t('etiqueta')}
      className="flex overflow-hidden rounded-full border border-marca/40 bg-white text-xs font-bold"
    >
      {IDIOMAS.map((idioma) => (
        <form key={idioma} action={cambiarIdioma.bind(null, idioma)}>
          {/* se ve abreviado (ES, EN); el lector de pantalla dice el nombre completo */}
          <button
            type="submit"
            lang={idioma}
            aria-label={t(idioma)}
            aria-pressed={idioma === actual}
            className="min-h-8 min-w-10 px-2 text-marca uppercase aria-pressed:bg-marca aria-pressed:text-white"
          >
            {idioma}
          </button>
        </form>
      ))}
    </nav>
  );
}
