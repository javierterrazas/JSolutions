import { getTranslations } from 'next-intl/server';
import { NOMBRE_APP } from './marca';
import { SelectorDeIdioma } from './selector-de-idioma';

export default async function Inicio() {
  const t = await getTranslations();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-marca">{NOMBRE_APP}</h1>
        <p className="text-slate-600">{t('app.lema')}</p>
      </header>
      <p className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">{t('inicio.pronto')}</p>
      <SelectorDeIdioma />
    </main>
  );
}
