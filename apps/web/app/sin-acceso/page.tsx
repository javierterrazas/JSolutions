import { getTranslations } from 'next-intl/server';
import { Marco, estilos } from '../componentes/marco';

export default async function SinAcceso() {
  const t = await getTranslations('sinAcceso');
  return (
    <Marco titulo={t('titulo')}>
      <p className={estilos.tarjeta}>{t('texto')}</p>
      <p className="text-sm text-slate-600">{t('baja')}</p>
    </Marco>
  );
}
