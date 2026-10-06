import { getTranslations } from 'next-intl/server';
import { Marco, estilos } from '../../componentes/marco';

export default async function InvitacionInvalida() {
  const t = await getTranslations('invitacion');
  return (
    <Marco titulo={t('invalidaTitulo')}>
      <p className={estilos.tarjeta}>{t('invalidaTexto')}</p>
    </Marco>
  );
}
