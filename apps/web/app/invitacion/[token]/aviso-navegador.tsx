'use client';
// El aviso cuando la invitación se abrió dentro de Instagram, Facebook u otra red social (D-116): si se canjea ahí, el
// acceso se queda dentro de esa app. Dice cómo abrirla en el navegador; en Android, un botón la abre en Chrome; en
// cualquiera, copiar el enlace para pegarlo en Safari o Chrome.
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { estilos } from '../../componentes/marco';

export function AvisoNavegador({
  app,
  enlace,
  chrome,
}: {
  app: string;
  enlace: string;
  /** En Android: el enlace que abre la invitación en Chrome. */
  chrome: string | null;
}) {
  const t = useTranslations('invitacion.interno');
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    await navigator.clipboard.writeText(enlace);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4">
      <p className="text-lg font-bold text-amber-900">{t('titulo', { app })}</p>
      <p className="text-sm text-amber-900">{t('texto', { app })}</p>
      {chrome ? (
        <a href={chrome} className={`${estilos.boton} flex items-center justify-center`}>
          {t('abrirChrome')}
        </a>
      ) : (
        <p className="text-sm font-medium text-amber-900">{t('pasos')}</p>
      )}
      <button type="button" onClick={copiar} className={estilos.botonSecundario}>
        {copiado ? t('copiado') : t('copiar')}
      </button>
    </div>
  );
}
