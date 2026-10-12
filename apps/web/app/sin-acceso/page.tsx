import { getTranslations } from 'next-intl/server';
import { Marco, estilos } from '../componentes/marco';
import { BorrarCopia } from './borrar-copia';
import { PegarInvitacion } from './pegar-invitacion';

export default async function SinAcceso() {
  const t = await getTranslations('sinAcceso');
  return (
    <Marco titulo={t('titulo')}>
      <BorrarCopia />
      <p className={estilos.tarjeta}>{t('texto')}</p>
      <PegarInvitacion />
      <p className="text-sm text-slate-600">{t('baja')}</p>
    </Marco>
  );
}
